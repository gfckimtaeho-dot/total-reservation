"use server";

import QRCode from "qrcode";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireGymCustomer } from "@/lib/auth/dal";
import { generateAccessToken } from "@/lib/auth/accessToken";
import {
  gymTodayUtcMidnight,
  gymTodayRange,
  gymNowUtcNaive,
} from "@/lib/calendar/gymTime";

// PT 예약 사전 룰 — 신규/변경은 "현재 시각 + 1시간 이후" 슬롯만. 트레이너가
// 갑작스러운 요청에 휘둘리지 않도록 1시간 버퍼. 단체수업은 별도(수업 시작 전).
const PT_BOOK_BUFFER_MS = 60 * 60 * 1000;
import {
  packageAvailableCount,
  pickBookablePackage,
  OPEN_STATUSES,
} from "@/lib/packages/availability";
import { loadTrainerDayAvailability } from "@/lib/calendar/trainerCalendarPro";

export type AccessQrResult =
  | { ok: true; qr: string; expiresYmd: string }
  | { ok: false; reason: "noAccess" | "blocked" };

// 출입 자격은 "그 1명"에 대해 탭하는 순간 실시간 계산한다(cron 스냅샷 신뢰 X):
//   - User.active=false (사장 차단/휴면 토글)          → blocked
//   - 오늘 기준 유효한 회원권(endDate >= 오늘) 보유    → 발급
//   - 또는 오늘 예약(PT/단체수업)이 있음              → 그날 임시 발급
//   - 둘 다 아니면 noAccess (프런트 문의)
// 발급 토큰은 Manila 오늘 끝까지만 유효(QrToken). 같은 날 재탭은 재사용.
export async function requestAccessQr(
  slug: string,
): Promise<AccessQrResult> {
  const user = await requireGymCustomer(slug);
  // 비활성(빌런/휴면) 회원 차단 — 회원권/예약 유무 무관하게 즉시 거절.
  // 로그인/세션은 유지(자신의 권/예약 조회는 가능). QR만 막아 출입 봉쇄.
  if (!user.active) return { ok: false, reason: "blocked" };
  const gymId = user.business!.id;
  const userId = user.id;

  const tz = user.business!.timeZone;
  const today = gymTodayUtcMidnight(tz);
  const { start: startOfDay, end: endOfDay } = gymTodayRange(tz);

  // 자격 판정 = 회원권 OR 오늘 예약. 둘 다 OR 조건이라 동시에 fetch + 결과 합산
  // → 한 왕복 절약 (기존 순차 await -> 병렬 Promise.all). qrToken 재사용 조회도
  // 자격과 독립적이라 같은 배치에 묶어 한 번에 처리.
  const now = new Date();
  const [validMembership, reservationToday, existing] = await Promise.all([
    prisma.membership.findFirst({
      // 환불 신청/완료된 회원권은 동결(refundedAt) — endDate가 살아있어도 QR 자격 X.
      where: {
        userId,
        gymId,
        endDate: { gte: today },
        refundedAt: null,
      },
      orderBy: { endDate: "desc" },
      select: { endDate: true },
    }),
    prisma.reservation.findFirst({
      where: {
        customerUserId: userId,
        gymId,
        startAt: { gte: startOfDay, lt: endOfDay },
        status: { notIn: ["CANCELLED", "REJECTED"] },
      },
      select: { id: true },
    }),
    prisma.qrToken.findFirst({
      where: {
        userId,
        gymId,
        usedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { issuedAt: "desc" },
      select: { token: true, expiresAt: true },
    }),
  ]);
  const eligible = Boolean(validMembership) || Boolean(reservationToday);

  if (!eligible) return { ok: false, reason: "noAccess" };

  let token: string;
  let expiresAt: Date;
  if (existing) {
    token = existing.token;
    expiresAt = existing.expiresAt;
  } else {
    token = generateAccessToken();
    expiresAt = endOfDay;
    await prisma.qrToken.create({
      data: {
        gymId,
        userId,
        token,
        nonce: generateAccessToken(),
        expiresAt,
      },
    });
  }

  const qr = await QRCode.toDataURL(token, {
    // 인식률 개선 — 더 큰 해상도 + quiet zone(여백) 2모듈로 스캐너가 코드 경계를
    // 더 안정적으로 잡게 한다. 색은 순수 흑백(#000/#fff) 최대 대비.
    width: 512,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });

  // 표시용 유효일: 회원권 보유 시 회원권 마지막 날, 예약 임시발급이면 그날(토큰 만료일).
  const displayExpiry = validMembership?.endDate ?? expiresAt;
  return {
    ok: true,
    qr,
    expiresYmd: displayExpiry.toISOString().slice(0, 10),
  };
}

// 1:1 예약 취소(고객 셀프). 정책:
//   - 본인 예약(customerUserId === user.id)만
//   - 1:1만 (capacity 1, scheduledClassId null) — 단체 취소는 별도 흐름
//   - 당일/과거 잠금 — 시작이 "오늘"이면 불가 (전화 안내), 과거도 불가
//   - 통과 시: status=CANCELLED + ReservationLog
//   - remainingCount 는 손대지 않는다 — 잔여는 "완료" 시점에만 차감되므로
//     미완료 예약 취소는 복구할 차감분이 없다(+1 하면 무료 1회를 주는 셈).
//     단체 취소(cancelGroupEnrollment)와 동일 모델.
export type CancelResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "notFound"
        | "notOwner"
        | "notPersonal"
        | "sameDayOrPast"
        | "alreadyClosed";
    };

export async function cancelReservation(
  slug: string,
  reservationId: string,
): Promise<CancelResult> {
  const user = await requireGymCustomer(slug);
  const gymId = user.business!.id;

  const res = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      service: { select: { capacity: true } },
    },
  });
  if (!res || res.gymId !== gymId) return { ok: false, reason: "notFound" };
  if (res.customerUserId !== user.id) return { ok: false, reason: "notOwner" };
  if (res.scheduledClassId !== null || res.service.capacity !== 1) {
    return { ok: false, reason: "notPersonal" };
  }
  if (["CANCELLED", "REJECTED", "COMPLETED", "NO_SHOW"].includes(res.status)) {
    return { ok: false, reason: "alreadyClosed" };
  }

  // 당일/과거 잠금: startAt < 내일 자정(Manila) 이면 거부.
  const { end: todayEnd } = gymTodayRange(user.business!.timeZone);
  if (res.startAt < todayEnd) {
    return { ok: false, reason: "sameDayOrPast" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id: res.id },
      data: { status: "CANCELLED" },
    });
    await tx.reservationLog.create({
      data: {
        gymId,
        reservationId: res.id,
        action: "CANCELLED_BY_CUSTOMER",
        actorUserId: user.id,
      },
    });
  });

  revalidatePath(`/ko/g/${slug}/me`);
  revalidatePath(`/en/g/${slug}/me`);
  return { ok: true };
}

// 단체수업 등록 취소(고객 셀프). 1:1 cancelReservation 과 같은 모델 —
// 단체 예약(scheduledClassId 있음)만, 당일/과거 잠금, 잔여는 손대지 않음
// (완료 시에만 차감). status=CANCELLED + ReservationLog.
export type CancelGroupResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "notFound"
        | "notOwner"
        | "notGroup"
        | "sameDayOrPast"
        | "alreadyClosed";
    };

export async function cancelGroupEnrollment(
  slug: string,
  reservationId: string,
): Promise<CancelGroupResult> {
  const user = await requireGymCustomer(slug);
  const gymId = user.business!.id;

  const res = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      gymId: true,
      customerUserId: true,
      scheduledClassId: true,
      status: true,
      startAt: true,
    },
  });
  if (!res || res.gymId !== gymId) return { ok: false, reason: "notFound" };
  if (res.customerUserId !== user.id) return { ok: false, reason: "notOwner" };
  if (res.scheduledClassId === null) return { ok: false, reason: "notGroup" };
  if (["CANCELLED", "REJECTED", "COMPLETED", "NO_SHOW"].includes(res.status)) {
    return { ok: false, reason: "alreadyClosed" };
  }

  const { end: todayEnd } = gymTodayRange(user.business!.timeZone);
  if (res.startAt < todayEnd) {
    return { ok: false, reason: "sameDayOrPast" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id: res.id },
      data: { status: "CANCELLED" },
    });
    await tx.reservationLog.create({
      data: {
        gymId,
        reservationId: res.id,
        action: "CANCELLED_BY_CUSTOMER",
        actorUserId: user.id,
      },
    });
  });

  revalidatePath(`/ko/g/${slug}/me`);
  revalidatePath(`/en/g/${slug}/me`);
  return { ok: true };
}

// 1:1 신규 예약(고객 셀프). 정책:
//   - 본인 보유 + 1:1 권(service.capacity 1) + remainingCount > 0
//   - 권에 assignedStaff 가 있어야(없으면 프런트 안내)
//   - 새 시각은 매장 현재시각 + 1시간 이후 (PT_BOOK_BUFFER)
//   - 같은 staff 충돌 거부 (1:1 정원 1)
//   - status=CONFIRMED + ReservationLog CREATED. remainingCount 는 완료 시 차감(트레이너 측 모델과 일관).
export type CreateResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "notFound"
        | "notOwner"
        | "notPersonal"
        | "noRemaining"
        | "noTrainer"
        | "tooSoon"
        | "invalidTarget"
        | "conflict";
    };

export async function createReservation(
  slug: string,
  packageId: string,
  newStartIso: string,
): Promise<CreateResult> {
  const user = await requireGymCustomer(slug);
  const gymId = user.business!.id;

  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
    include: {
      service: {
        select: { capacity: true, durationMin: true, deductCount: true },
      },
    },
  });
  if (!pkg || pkg.gymId !== gymId) return { ok: false, reason: "notFound" };
  if (pkg.userId !== user.id) return { ok: false, reason: "notOwner" };
  // 환불 동결 권은 예약 불가.
  if (pkg.refundedAt) return { ok: false, reason: "notFound" };
  if (pkg.service.capacity !== 1)
    return { ok: false, reason: "notPersonal" };
  // 잔여 초과 예약 차단 — remainingCount 만 보면 미완료 예약이 장차
  // 소진할 몫을 무시하게 된다. 미완료 예약분을 뺀 가용으로 판정.
  const deduct = pkg.service.deductCount;
  const available = await packageAvailableCount(
    pkg.id,
    pkg.remainingCount,
    deduct,
  );
  if (available < deduct) return { ok: false, reason: "noRemaining" };
  if (!pkg.assignedStaffId) return { ok: false, reason: "noTrainer" };

  const newStart = new Date(newStartIso);
  if (Number.isNaN(newStart.getTime()))
    return { ok: false, reason: "invalidTarget" };

  // PT 신규: 매장 현재시각 + 1시간 이후만. 사장 결정 (당일도 허용 + 1h 버퍼).
  const gymNow = gymNowUtcNaive(user.business!.timeZone);
  const earliestStart = new Date(gymNow.getTime() + PT_BOOK_BUFFER_MS);
  if (newStart < earliestStart) return { ok: false, reason: "tooSoon" };

  const newEnd = new Date(
    newStart.getTime() + pkg.service.durationMin * 60_000,
  );

  const conflict = await prisma.reservation.findFirst({
    where: {
      gymId,
      staffId: pkg.assignedStaffId,
      status: { notIn: ["CANCELLED", "REJECTED"] },
      startAt: { lt: newEnd },
      endAt: { gt: newStart },
    },
    select: { id: true },
  });
  if (conflict) return { ok: false, reason: "conflict" };

  await prisma.$transaction(async (tx) => {
    const r = await tx.reservation.create({
      data: {
        gymId,
        serviceId: pkg.serviceId,
        staffId: pkg.assignedStaffId!,
        customerUserId: user.id,
        startAt: newStart,
        endAt: newEnd,
        status: "CONFIRMED",
        packageId: pkg.id,
      },
      select: { id: true },
    });
    await tx.reservationLog.create({
      data: {
        gymId,
        reservationId: r.id,
        action: "CREATED",
        actorUserId: user.id,
      },
    });
  });

  revalidatePath(`/ko/g/${slug}/me`);
  revalidatePath(`/en/g/${slug}/me`);
  return { ok: true };
}

// 단체 수업 등록(고객 셀프). 정책:
//   - 본인 + 그 service 의 단체 권(service.capacity > 1) + 잔여 > 0
//   - schedule.active + 유효 기간 + 그 날짜에 RECURRING/ONE_OFF 매칭
//   - occurrence 정원(그 날의 비-DEAD reservation 수) < schedule.service.capacity
//   - 본인이 그 occurrence(같은 schedule + 같은 day)에 중복 등록 차단
//   - status=CONFIRMED + scheduledClassId 연결 + 가장 오래된 단체 권(FIFO)을 packageId 로 연결
//     (잔여는 완료 시 차감 — 1:1 예약과 동일 모델)
export type JoinClassResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "notFound"
        | "inactiveSchedule"
        | "outOfRange"
        | "noPack"
        | "alreadyJoined"
        | "classFull"
        | "pastSession";
    };

export async function joinScheduledClass(
  slug: string,
  scheduleId: string,
  year: number,
  month: number,
  day: number,
): Promise<JoinClassResult> {
  const user = await requireGymCustomer(slug);
  const gymId = user.business!.id;

  const sched = await prisma.scheduledClass.findUnique({
    where: { id: scheduleId },
    include: {
      service: {
        select: { capacity: true, durationMin: true, deductCount: true },
      },
    },
  });
  if (!sched || sched.gymId !== gymId)
    return { ok: false, reason: "notFound" };
  if (!sched.active) return { ok: false, reason: "inactiveSchedule" };
  if (sched.service.capacity <= 1) return { ok: false, reason: "notFound" };

  // 그 날짜가 schedule 유효 기간 + RECURRING/ONE_OFF 매칭인지 검증
  const occUtcMid = new Date(Date.UTC(year, month - 1, day));
  if (occUtcMid < sched.validFrom) return { ok: false, reason: "outOfRange" };
  if (sched.validUntil && occUtcMid > sched.validUntil) {
    return { ok: false, reason: "outOfRange" };
  }
  if (sched.kind === "ONE_OFF") {
    if (
      !sched.specificDate ||
      sched.specificDate.getUTCFullYear() !== year ||
      sched.specificDate.getUTCMonth() + 1 !== month ||
      sched.specificDate.getUTCDate() !== day
    ) {
      return { ok: false, reason: "outOfRange" };
    }
  } else {
    const WEEKDAY = [
      "SUN",
      "MON",
      "TUE",
      "WED",
      "THU",
      "FRI",
      "SAT",
    ] as const;
    const wd = WEEKDAY[occUtcMid.getUTCDay()]!;
    if (!sched.weekdays.includes(wd))
      return { ok: false, reason: "outOfRange" };
  }

  // 시각 — schedule.startMinute 을 그 day 의 UTC-naive Manila 로
  const h = Math.floor(sched.startMinute / 60);
  const m = sched.startMinute % 60;
  const startAt = new Date(Date.UTC(year, month - 1, day, h, m, 0));
  const endAt = new Date(startAt.getTime() + sched.service.durationMin * 60_000);

  // 단체수업: 수업 시작 전이면 OK. 매장 타임존(UTC-naive)으로 비교 — startAt 과
  // 같은 표현이라 직접 비교. 이전엔 Date.now() 직접 비교라 타임존 무시 버그가 있었음.
  const gymNow = gymNowUtcNaive(user.business!.timeZone);
  if (startAt < gymNow) {
    return { ok: false, reason: "pastSession" };
  }

  // 정원: 그 occurrence 의 비-DEAD reservation 수
  const dayStart = new Date(Date.UTC(year, month - 1, day));
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const enrolled = await prisma.reservation.count({
    where: {
      gymId,
      scheduledClassId: scheduleId,
      status: { notIn: ["CANCELLED", "REJECTED"] },
      startAt: { gte: dayStart, lt: dayEnd },
    },
  });
  if (enrolled >= sched.service.capacity) {
    return { ok: false, reason: "classFull" };
  }

  // 본인 중복 등록 차단(같은 occurrence)
  const mine = await prisma.reservation.findFirst({
    where: {
      gymId,
      customerUserId: user.id,
      scheduledClassId: scheduleId,
      status: { notIn: ["CANCELLED", "REJECTED"] },
      startAt: { gte: dayStart, lt: dayEnd },
    },
    select: { id: true },
  });
  if (mine) return { ok: false, reason: "alreadyJoined" };

  // 본인 보유 단체 권(해당 service) FIFO 1장 선택 — 잔여는 있으나
  // 미완료 예약으로 모두 선점된 권은 건너뛴다(초과 예약 차단).
  const pkg = await pickBookablePackage(
    gymId,
    user.id,
    sched.serviceId,
    sched.service.deductCount,
  );
  if (!pkg) return { ok: false, reason: "noPack" };

  await prisma.$transaction(async (tx) => {
    const r = await tx.reservation.create({
      data: {
        gymId,
        serviceId: sched.serviceId,
        staffId: sched.staffId ?? (await fallbackStaffId(tx, gymId)),
        customerUserId: user.id,
        startAt,
        endAt,
        status: "CONFIRMED",
        packageId: pkg.id,
        scheduledClassId: sched.id,
      },
      select: { id: true },
    });
    await tx.reservationLog.create({
      data: {
        gymId,
        reservationId: r.id,
        action: "CREATED",
        actorUserId: user.id,
      },
    });
  });

  revalidatePath(`/ko/g/${slug}/me`);
  revalidatePath(`/en/g/${slug}/me`);
  return { ok: true };
}

// schedule.staffId 가 null 인 경우(강사 미지정 단체수업)에도 Reservation.staffId
// 는 not-null 컬럼이라 임시 staff 가 필요. 매장의 아무 staff 1명을 폴백으로 — 정산은
// 단체수업의 강사 결정 로직(향후)이 진실이라 이 폴백은 표시용일 뿐.
async function fallbackStaffId(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  gymId: string,
): Promise<string> {
  const any = await tx.staff.findFirst({ where: { gymId }, select: { id: true } });
  if (!any) throw new Error("매장에 등록된 트레이너가 없습니다");
  return any.id;
}

// 1:1 예약 변경(고객 셀프). 정책:
//   - 본인 + 1:1 + 시작 1시간 이상 남은 예약만 변경 가능
//   - 새 시각도 매장 현재 + 1시간 이후
//   - 같은 staff 의 같은 길이로만 이동 (다른 트레이너/다른 서비스 불가)
//   - 새 시각 슬롯에 다른 비-DEAD 예약이 있으면 충돌 거부
export type MoveResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "notFound"
        | "notOwner"
        | "notPersonal"
        | "tooSoon"
        | "invalidTarget"
        | "conflict"
        | "alreadyClosed";
    };

export async function moveReservation(
  slug: string,
  reservationId: string,
  newStartIso: string,
): Promise<MoveResult> {
  const user = await requireGymCustomer(slug);
  const gymId = user.business!.id;

  const res = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      service: { select: { capacity: true } },
    },
  });
  if (!res || res.gymId !== gymId) return { ok: false, reason: "notFound" };
  if (res.customerUserId !== user.id) return { ok: false, reason: "notOwner" };
  if (res.scheduledClassId !== null || res.service.capacity !== 1) {
    return { ok: false, reason: "notPersonal" };
  }
  if (["CANCELLED", "REJECTED", "COMPLETED", "NO_SHOW"].includes(res.status)) {
    return { ok: false, reason: "alreadyClosed" };
  }

  // PT 변경: 기존/새 시각 모두 매장 현재 + 1시간 이후. (당일 변경 허용)
  const gymNow = gymNowUtcNaive(user.business!.timeZone);
  const earliestStart = new Date(gymNow.getTime() + PT_BOOK_BUFFER_MS);
  if (res.startAt < earliestStart) {
    return { ok: false, reason: "tooSoon" };
  }

  const newStart = new Date(newStartIso);
  if (Number.isNaN(newStart.getTime())) {
    return { ok: false, reason: "invalidTarget" };
  }
  if (newStart < earliestStart) {
    return { ok: false, reason: "tooSoon" };
  }
  const durationMs = res.endAt.getTime() - res.startAt.getTime();
  const newEnd = new Date(newStart.getTime() + durationMs);

  // 같은 staff 의 다른 비-DEAD 예약과 겹치면 거부 (자기 자신은 제외).
  const conflict = await prisma.reservation.findFirst({
    where: {
      gymId,
      staffId: res.staffId,
      id: { not: res.id },
      status: { notIn: ["CANCELLED", "REJECTED"] },
      startAt: { lt: newEnd },
      endAt: { gt: newStart },
    },
    select: { id: true },
  });
  if (conflict) return { ok: false, reason: "conflict" };

  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id: res.id },
      data: { startAt: newStart, endAt: newEnd },
    });
    await tx.reservationLog.create({
      data: {
        gymId,
        reservationId: res.id,
        action: "CHANGED_BY_CUSTOMER",
        actorUserId: user.id,
      },
    });
  });

  revalidatePath(`/ko/g/${slug}/me`);
  revalidatePath(`/en/g/${slug}/me`);
  return { ok: true };
}

// 데이 시트(미래 날짜) 예약 후보 — 그 날 "실제로" 예약 가능한 것만 추린다.
//   1:1: 담당 트레이너가 그 날 근무 + 빈 슬롯이 하나라도 있어야 노출.
//   단체: 그 날 수업 회차가 있고 정원 여유 + 본인 미등록이어야 노출.
// 같은 서비스 1:1 권이 여럿이면 먼저 산 1장(FIFO)만 후보로 — 차감도 그것부터.
// 1:1 은 그날 불가해도 빼지 않고 사유와 함께 비활성으로 노출한다 —
// 고객은 트레이너 휴무 요일을 모르므로, 안 보이면 오히려 당황한다.
export type MeDayOption =
  | {
      kind: "oneToOne";
      packageId: string;
      serviceName: string;
      trainerName: string;
      available: boolean;
      // 비활성 사유 — off: 트레이너 휴무 요일, leave: 휴가, full: 예약 마감,
      // exhausted: 그 서비스 권의 예약 가능 횟수를 모두 소진,
      // noTrainer: 권에 담당 트레이너 미지정(고객이 먼저 선택해야 함).
      reason: "off" | "leave" | "full" | "exhausted" | "noTrainer" | null;
    }
  | {
      kind: "group";
      scheduleId: string;
      serviceName: string;
      startMin: number;
    };

export type MeDayEvent = {
  id: string;
  kind: "pt" | "group";
  startMin: number;
  label: string;
  staffName: string;
  status: string;
};

export type MeDaySheetData = {
  events: MeDayEvent[]; // 그 날 본인 예약 (시간순)
  hasPasses: boolean; // 잔여 있는 권 보유 (안내 문구 분기용)
  options: MeDayOption[]; // 그 날 예약 후보 (미래 한정)
};

const ME_WEEKDAY = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
] as const;

function ymdUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// 데이 시트 데이터 — 그 날 본인 예약 + (미래면) 예약 후보.
// 트레이너 캘린더/회차 인원 조회를 병렬화 — 시트 여는 체감 속도 핵심.
export async function loadMeDaySheet(
  slug: string,
  dateKey: string, // "YYYY-MM-DD"
): Promise<MeDaySheetData> {
  const user = await requireGymCustomer(slug);
  const business = user.business!;
  const gymId = business.id;

  const [y, mon, d] = dateKey.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const dayUtcMid = new Date(Date.UTC(y, mon - 1, d));
  const dayEnd = new Date(dayUtcMid.getTime() + 24 * 60 * 60 * 1000);
  const todayUtcMid = gymTodayUtcMidnight(business.timeZone);
  const isPast = dayUtcMid.getTime() < todayUtcMid.getTime();
  const isToday = dayUtcMid.getTime() === todayUtcMid.getTime();
  // 오늘은 신규 정책상 예약 가능 (사장 결정: PT 1h 버퍼 / 단체 시작시각 전).
  const gymNow = gymNowUtcNaive(business.timeZone);
  const gymNowMin = isToday
    ? gymNow.getUTCHours() * 60 + gymNow.getUTCMinutes()
    : -1;

  // 데이 시트 응답속도 = DB 왕복 횟수 × 왕복지연. 왕복을 줄이고 겹친다.
  //
  // events 쿼리는 곧바로 출발시키되 await 는 끝까지 미룬다 — 다음 트립을
  // 막는 건 packages 뿐이라, events 는 트립 2·3 과 겹쳐 임계경로서 빠진다.
  const eventsPromise = prisma.reservation.findMany({
    where: {
      gymId,
      customerUserId: user.id,
      startAt: { gte: dayUtcMid, lt: dayEnd },
      status: { notIn: ["CANCELLED", "REJECTED"] },
    },
    select: {
      id: true,
      startAt: true,
      scheduledClassId: true,
      status: true,
      service: { select: { name: true, capacity: true } },
      staff: { select: { user: { select: { name: true } } } },
    },
    orderBy: { startAt: "asc" },
  });
  const toEvents = (
    rows: Awaited<typeof eventsPromise>,
  ): MeDayEvent[] =>
    rows.map((r) => ({
      id: r.id,
      kind:
        r.scheduledClassId !== null || (r.service?.capacity ?? 1) !== 1
          ? "group"
          : "pt",
      startMin:
        r.startAt.getUTCHours() * 60 + r.startAt.getUTCMinutes(),
      label: r.service?.name ?? "서비스",
      staffName: r.staff?.user.name ?? "",
      status: r.status,
    }));

  // 트립 1 — 보유 권. 다음 트립을 막는 유일한 선행 조회.
  const pkgs = await prisma.package.findMany({
    where: {
      gymId,
      userId: user.id,
      remainingCount: { gt: 0 },
      refundedAt: null, // 환불 동결 권 제외
    },
    select: {
      id: true,
      remainingCount: true,
      assignedStaffId: true,
      assignedStaff: { select: { user: { select: { name: true } } } },
      service: {
        select: {
          id: true,
          name: true,
          capacity: true,
          deductCount: true,
        },
      },
    },
    orderBy: { createdAt: "asc" }, // FIFO
  });

  // 과거 날짜는 예약 후보 계산 불필요 — 예약은 오늘부터.
  if (isPast) {
    return {
      events: toEvents(await eventsPromise),
      hasPasses: false,
      options: [],
    };
  }

  const hasPasses = pkgs.length > 0;
  const options: MeDayOption[] = [];

  // 권 없는 사용자는 옵션 계산 자체가 의미 없음 — 트립 2 의 4 쿼리(트레이너
  // 가용성·schedule·openCount·groupEnroll) 모두 skip. UI 는 "권 없음" 안내.
  if (!hasPasses) {
    return { events: toEvents(await eventsPromise), hasPasses, options };
  }

  // 1:1 — 서비스별로 묶는다(pkgs 가 createdAt asc 라 FIFO 순서 유지).
  // assignedStaffId 가 null 인 권(사장 발급 직후 + 트레이너 첫 예약 전)도 옵션에
  // 노출해 트레이너 선택 화면으로 유도한다. 노출 안 하면 고객이 권을 가지고도
  // 영구히 self-book 진입조차 못 하는 회귀가 생김(Phase 1 매핑 흐름의 사각).
  type Pkg1to1 = (typeof pkgs)[number];
  const svc1to1 = new Map<string, Pkg1to1[]>();
  for (const p of pkgs) {
    if (p.service.capacity !== 1) continue;
    const arr = svc1to1.get(p.service.id) ?? [];
    arr.push(p);
    svc1to1.set(p.service.id, arr);
  }
  const oneToOnePkgs = [...svc1to1.values()].flat();
  const staffIds = [
    ...new Set(
      oneToOnePkgs
        .map((p) => p.assignedStaffId)
        .filter((id): id is string => id !== null),
    ),
  ];
  const oneToOnePkgIds = oneToOnePkgs.map((p) => p.id);
  const groupServiceIds = [
    ...new Set(
      pkgs.filter((p) => p.service.capacity > 1).map((p) => p.service.id),
    ),
  ];

  // 트립 2 — 마지막 왕복. 각 쿼리는 해당 카테고리 권이 있을 때만 실행.
  //  - 트레이너 가용성: 1:1 권 있을 때
  //  - 단체수업 schedule + groupEnroll: 단체 권 있을 때
  //  - openCounts: 1:1 권 있을 때
  // 단체만/1:1만 가진 사용자는 절반의 쿼리를 절약 — Neon 왕복 1개당 100~300ms.
  const hasGroup = groupServiceIds.length > 0;
  const hasOneToOne = staffIds.length > 0;
  const [avails, schedules, openCounts, groupEnrollRows] =
    await Promise.all([
      hasOneToOne
        ? Promise.all(
            staffIds.map((id) =>
              loadTrainerDayAvailability(gymId, id, dayUtcMid),
            ),
          )
        : Promise.resolve([]),
      hasGroup
        ? prisma.scheduledClass.findMany({
            where: {
              gymId,
              active: true,
              serviceId: { in: groupServiceIds },
              validFrom: { lte: dayUtcMid },
              OR: [{ validUntil: null }, { validUntil: { gte: dayUtcMid } }],
            },
            select: {
              id: true,
              kind: true,
              weekdays: true,
              specificDate: true,
              startMinute: true,
              service: { select: { name: true, capacity: true } },
            },
          })
        : Promise.resolve([]),
      hasOneToOne
        ? prisma.reservation.groupBy({
            by: ["packageId"],
            where: {
              packageId: { in: oneToOnePkgIds },
              status: { in: [...OPEN_STATUSES] },
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      hasGroup
        ? prisma.reservation.findMany({
            where: {
              gymId,
              startAt: { gte: dayUtcMid, lt: dayEnd },
              status: { notIn: ["CANCELLED", "REJECTED"] },
              scheduledClass: { serviceId: { in: groupServiceIds } },
            },
            select: { scheduledClassId: true, customerUserId: true },
          })
        : Promise.resolve([]),
    ]);
  const availByStaff = new Map(staffIds.map((id, i) => [id, avails[i]]));
  const openByPkg = new Map(
    openCounts.map((g) => [g.packageId, g._count._all]),
  );

  // 1:1 옵션 — 서비스별 1줄. 예약 여유 있는 권(FIFO·미완료 예약 선점분
  // 차감)이 없으면 "전부 소진", 트레이너가 그날 안 되면 사유로 비활성.
  for (const [, svcPkgs] of svc1to1) {
    const display = svcPkgs[0]!;
    const deduct = display.service.deductCount;
    const bookable =
      svcPkgs.find(
        (p) =>
          p.remainingCount - (openByPkg.get(p.id) ?? 0) * deduct >=
          deduct,
      ) ?? null;
    let available = false;
    let reason:
      | "off"
      | "leave"
      | "full"
      | "exhausted"
      | "noTrainer"
      | null = null;
    if (!bookable) {
      reason = "exhausted";
    } else if (!bookable.assignedStaffId) {
      // 사장 발급 후 트레이너 첫 예약 전 — 고객이 트레이너를 선택해야
      // 비로소 매핑되어 예약 가능해진다. 옵션 클릭하면 트레이너 선택 화면
      // 으로 자연스럽게 안내되도록 페이지 측에서 분기.
      reason = "noTrainer";
    } else {
      const av = availByStaff.get(bookable.assignedStaffId);
      if (!av || av.state === "closed") {
        reason = "off";
      } else if (av.state === "off") {
        reason = av.onLeave ? "leave" : "off";
      } else if (av.hasFree) {
        available = true;
      } else {
        reason = "full";
      }
    }
    options.push({
      kind: "oneToOne",
      packageId: (bookable ?? display).id,
      serviceName: display.service.name,
      trainerName: (bookable ?? display).assignedStaff?.user.name ?? "",
      available,
      reason,
    });
  }

  // 단체수업 — 그날 열리는 회차를, 트립 2 에서 받은 등록 현황으로
  // 정원·본인등록 판정(추가 왕복 없음).
  const wd = ME_WEEKDAY[dayUtcMid.getUTCDay()]!;
  const enrolledByClass = new Map<string, string[]>();
  for (const r of groupEnrollRows) {
    if (!r.scheduledClassId) continue;
    const arr = enrolledByClass.get(r.scheduledClassId) ?? [];
    arr.push(r.customerUserId);
    enrolledByClass.set(r.scheduledClassId, arr);
  }
  for (const sc of schedules) {
    const runsToday =
      sc.kind === "ONE_OFF"
        ? sc.specificDate != null && ymdUtc(sc.specificDate) === dateKey
        : sc.weekdays.includes(wd);
    if (!runsToday) continue;
    // 오늘 회차는 시작시각 이후면 제외 — joinScheduledClass 의 pastSession 룰과 일치.
    if (isToday && sc.startMinute <= gymNowMin) continue;
    const enrolled = enrolledByClass.get(sc.id) ?? [];
    if (enrolled.includes(user.id)) continue; // 이미 등록
    if (enrolled.length >= sc.service.capacity) continue; // 정원 마감
    options.push({
      kind: "group",
      scheduleId: sc.id,
      serviceName: sc.service.name,
      startMin: sc.startMinute,
    });
  }

  // 단체수업(시간순) -> 1:1 가능 -> 1:1 비활성 순.
  const sortKey = (o: MeDayOption): number =>
    o.kind === "group" ? o.startMin : o.available ? 100000 : 100001;
  options.sort((a, b) => sortKey(a) - sortKey(b));
  // events 는 위 트립들과 겹쳐 흘렀으므로 여기선 보통 이미 끝나 있다.
  return { events: toEvents(await eventsPromise), hasPasses, options };
}
