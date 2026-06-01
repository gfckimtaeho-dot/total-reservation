// 호텔 게스트 헬스장 출입 검증 (모델 B — 헬스장이 호텔 Stay 를 live read).
//
// 스캐너가 QR(=호텔 Stay.id)을 읽어 (slug, token) 으로 호출. 이 함수는 cross-DB
// 로 호텔 Stay 를 직접 조회해 제휴·숙박기간을 검증하고 GuestAccessLog 를 남긴다.
// 호텔 DB 에 게스트/출입권을 복제(insert)하지 않으므로 연장/조기퇴실/취소는
// 호텔이 자기 Stay.checkOutDate 만 갱신하면 헬스장이 자동 반영. docs/access.md.
//
// 거절 사유는 머신 코드(reason)로만 반환 — UI 번역은 호출 측(스캐너 화면) 책임.

import { prisma } from "@/lib/db/client";
import { hotelDb } from "@/lib/hotel-db";
import { gymTodayUtcMidnight } from "@/lib/calendar/gymTime";
import type { AccessOutcome, AccessReason, AccessResultValue } from "./types";

// 게스트 경로가 낼 수 있는 사유만 추린 부분집합 (순수 코어 시그니처 명세용).
export type GuestVerifyReason = Extract<
  AccessReason,
  | "STAY_NOT_FOUND"
  | "NOT_AFFILIATED"
  | "NOT_OPTED_IN"
  | "NOT_YET"
  | "CHECKED_OUT"
>;

// 순수 판정 코어 — IO 없이 이미 조회한 값만 받아 결과를 낸다(테스트 가능).
// 호출 측이 affiliation/Stay 를 cross-DB 로 조회해 넘긴다. 우선순위:
// 제휴 -> gymOptIn -> 체크아웃 status -> 날짜창. checkOutDate 는 exclusive.
export function decideGuestAccess(input: {
  affiliationActive: boolean;
  gymOptIn: boolean;
  status: string; // 호텔 StayStatus. whitelist 판정이라 string 으로 받는다.
  checkInDate: Date;
  checkOutDate: Date;
  today: Date; // 매장 타임존 기준 오늘 UTC 자정
}): { result: AccessResultValue; reason: GuestVerifyReason | null } {
  if (!input.affiliationActive) return { result: "DENIED", reason: "NOT_AFFILIATED" };
  if (!input.gymOptIn) return { result: "DENIED", reason: "NOT_OPTED_IN" };
  // status whitelist: ACTIVE 만 통과. CHECKED_OUT(조기퇴실 포함) 및 향후 추가될
  // 어떤 status 든 안전하게 거절(호텔 측 권고). 호텔이 live 갱신 = 동기화 0.
  if (input.status !== "ACTIVE") return { result: "EXPIRED", reason: "CHECKED_OUT" };

  const today = input.today.getTime();
  if (today < input.checkInDate.getTime()) return { result: "DENIED", reason: "NOT_YET" };
  if (today >= input.checkOutDate.getTime()) return { result: "EXPIRED", reason: "CHECKED_OUT" };
  return { result: "ALLOWED", reason: null };
}

// gym 은 디스패처(verifyAccess)가 이미 조회해 넘긴다 (slug -> gym 중복 조회 방지).
export async function verifyGuestAccess(
  gym: { id: string; timeZone: string },
  token: string,
): Promise<AccessOutcome> {
  const base = {
    kind: "GUEST" as const,
    name: null,
    hotelName: null,
  };

  // 호텔 Stay live read (cross-DB). token == Stay.id (cuid).
  // 게스트명은 Stay -> reservation -> customer 경로. gymOptIn/status 는 호텔이
  // 단일 소스로 갱신하는 출입 계약 필드(기획서 15).
  const stay = await hotelDb.stay.findUnique({
    where: { id: token },
    select: {
      id: true,
      hotelId: true,
      checkInDate: true,
      checkOutDate: true,
      status: true,
      gymOptIn: true,
      reservation: { select: { customer: { select: { name: true } } } },
      business: { select: { name: true } },
    },
  });
  if (!stay) {
    // 게스트/호텔 컨텍스트가 없어 로그 생략 (의미 있는 게스트 출입 시도 아님).
    return { ...base, result: "DENIED", reason: "STAY_NOT_FOUND" };
  }

  const guestName = stay.reservation?.customer?.name ?? null;
  const hotelName = stay.business?.name ?? null;

  const affiliation = await prisma.gymHotelAffiliation.findUnique({
    where: { gymId_hotelId: { gymId: gym.id, hotelId: stay.hotelId } },
    select: { active: true },
  });

  const { result, reason } = decideGuestAccess({
    affiliationActive: !!affiliation?.active,
    gymOptIn: stay.gymOptIn,
    status: stay.status,
    checkInDate: stay.checkInDate,
    checkOutDate: stay.checkOutDate,
    today: gymTodayUtcMidnight(gym.timeZone),
  });

  // 거절도 기록 — 여기서부턴 호텔 컨텍스트가 있다.
  await prisma.guestAccessLog.create({
    data: {
      gymId: gym.id,
      hotelId: stay.hotelId,
      stayId: stay.id,
      guestName,
      result,
    },
  });
  return { kind: "GUEST", name: guestName, hotelName, result, reason };
}
