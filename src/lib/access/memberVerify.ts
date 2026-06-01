// 회원/직원 헬스장 출입 검증 — QR = User.accessToken (32자 base64url).
//
// 디스패처(verifyAccess)가 token 으로 User 를 먼저 조회해 매칭되면 이 경로로 온다.
// 트레이너/매니저(STAFF)는 active+ACTIVE 면 통과. 회원(MEMBER)은 추가로 회원권
// 만료 검사(docs/access.md: 만료일 당일까지 허용, 다음날부터 거절).
//
// 거절 사유는 머신 코드(reason)로만 반환 — UI 번역은 스캐너 화면 책임.

import { prisma } from "@/lib/db/client";
import { gymTodayUtcMidnight } from "@/lib/calendar/gymTime";
import type { AccessOutcome, AccessReason, AccessResultValue } from "./types";

export type MemberVerifyReason = Extract<
  AccessReason,
  "INACTIVE" | "NO_MEMBERSHIP" | "MEMBERSHIP_EXPIRED"
>;

// 순수 판정 코어 — IO 없이 이미 조회한 값만 받아 결과를 낸다(테스트 가능).
// 우선순위: 계정 활성 -> 직원은 무조건 통과 -> 회원은 회원권 날짜창.
// 회원권 endDate 는 inclusive (만료일 당일까지 허용). 게스트(exclusive)와 다름.
export function decideMemberAccess(input: {
  active: boolean;
  status: string; // UserStatus. ACTIVE 만 통과(whitelist).
  isStaff: boolean; // role !== CUSTOMER (트레이너/매니저/사장)
  // 회원(MEMBER) 한정 — 환불 동결(refundedAt) 제외한 회원권 날짜창들.
  memberships: { startDate: Date; endDate: Date }[];
  today: Date; // 매장 타임존 기준 오늘 UTC 자정
}): { result: AccessResultValue; reason: MemberVerifyReason | null } {
  if (!input.active || input.status !== "ACTIVE") {
    return { result: "DENIED", reason: "INACTIVE" };
  }
  // 직원은 회원권 불필요 — 출퇴근/수업 운영을 위해 항상 통과.
  if (input.isStaff) return { result: "ALLOWED", reason: null };

  const today = input.today.getTime();
  const current = input.memberships.some(
    (m) => m.startDate.getTime() <= today && today <= m.endDate.getTime(),
  );
  if (current) return { result: "ALLOWED", reason: null };

  // 유효 회원권이 없을 때: 과거에 만료된 게 있으면 EXPIRED(amber), 아니면
  // 미발급/미시작으로 보고 NO_MEMBERSHIP(rose).
  const hadExpired = input.memberships.some((m) => m.endDate.getTime() < today);
  if (hadExpired) return { result: "EXPIRED", reason: "MEMBERSHIP_EXPIRED" };
  return { result: "DENIED", reason: "NO_MEMBERSHIP" };
}

// gym 은 디스패처가 이미 조회해 넘긴다. user 도 디스패처가 accessToken 으로 조회.
export async function verifyMemberAccess(
  gym: { id: string; timeZone: string },
  user: {
    id: string;
    gymId: string | null;
    name: string;
    role: string;
    status: string;
    active: boolean;
  },
): Promise<AccessOutcome> {
  const isStaff = user.role !== "CUSTOMER";
  const base = {
    kind: (isStaff ? "STAFF" : "MEMBER") as AccessOutcome["kind"],
    name: user.name,
    hotelName: null,
  };

  // 토큰은 유효하나 다른 매장 소속 계정 — 로그 남기지 않음(이 매장 컨텍스트 아님).
  if (user.gymId !== gym.id) {
    return { ...base, result: "DENIED", reason: "WRONG_GYM" };
  }

  let memberships: { startDate: Date; endDate: Date }[] = [];
  if (!isStaff) {
    memberships = await prisma.membership.findMany({
      where: { gymId: gym.id, userId: user.id, refundedAt: null },
      select: { startDate: true, endDate: true },
    });
  }

  const { result, reason } = decideMemberAccess({
    active: user.active,
    status: user.status,
    isStaff,
    memberships,
    today: gymTodayUtcMidnight(gym.timeZone),
  });

  // 성공/거절 모두 AccessLog 기록 (자유 운동 통계의 단일 소스). 영구 accessToken
  // 은 QrToken row 가 아니므로 qrTokenId 는 null.
  await prisma.accessLog.create({
    data: { gymId: gym.id, userId: user.id, result },
  });

  return { ...base, result, reason };
}
