"use server";

import QRCode from "qrcode";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireGymCustomer } from "@/lib/auth/dal";
import { generateAccessToken } from "@/lib/auth/accessToken";
import {
  gymTodayUtcMidnight,
  gymTodayRange,
} from "@/lib/calendar/gymTime";
import {
  packageAvailableCount,
  pickBookablePackage,
} from "@/lib/packages/availability";
import {
  loadMeCalendarMonth,
  type MeCalendarMonth,
} from "@/lib/calendar/meCalendar";

export type AccessQrResult =
  | { ok: true; qr: string; expiresYmd: string }
  | { ok: false; reason: "noAccess" };

// 출입 자격은 "그 1명"에 대해 탭하는 순간 실시간 계산한다(cron 스냅샷 신뢰 X):
//   - 오늘 기준 유효한 회원권(endDate >= 오늘) 보유  → 발급
//   - 또는 오늘 예약(PT/단체수업)이 있음            → 그날 임시 발급
//   - 둘 다 아니면 거절(프런트 문의)
// 발급 토큰은 Manila 오늘 끝까지만 유효(QrToken). 같은 날 재탭은 재사용.
export async function requestAccessQr(
  slug: string,
): Promise<AccessQrResult> {
  const user = await requireGymCustomer(slug);
  const gymId = user.business!.id;
  const userId = user.id;

  const tz = user.business!.timeZone;
  const today = gymTodayUtcMidnight(tz);
  const { end: endOfDay } = gymTodayRange(tz);

  // 가장 늦게 끝나는 유효 회원권 — 표시용 "마지막 날"의 출처.
  const validMembership = await prisma.membership.findFirst({
    where: { userId, gymId, endDate: { gte: today } },
    orderBy: { endDate: "desc" },
    select: { endDate: true },
  });

  let eligible = Boolean(validMembership);
  if (!eligible) {
    const { start, end } = gymTodayRange(tz);
    const reservationToday = await prisma.reservation.findFirst({
      where: {
        customerUserId: userId,
        gymId,
        startAt: { gte: start, lt: end },
        status: { notIn: ["CANCELLED", "REJECTED"] },
      },
      select: { id: true },
    });
    eligible = Boolean(reservationToday);
  }

  if (!eligible) return { ok: false, reason: "noAccess" };

  // 오늘 아직 유효한 토큰이 있으면 재사용(탭마다 row 폭증 방지).
  const now = new Date();
  const existing = await prisma.qrToken.findFirst({
    where: {
      userId,
      gymId,
      usedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { issuedAt: "desc" },
    select: { token: true, expiresAt: true },
  });

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
    width: 320,
    margin: 1,
    color: { dark: "#0a0a0a", light: "#ffffff" },
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

// 1:1 신규 예약(고객 셀프). 정책:
//   - 본인 보유 + 1:1 권(service.capacity 1) + remainingCount > 0
//   - 권에 assignedStaff 가 있어야(없으면 프런트 안내)
//   - 새 시각은 내일 이후
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
        | "sameDayOrPast"
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

  const { end: todayEnd } = gymTodayRange(user.business!.timeZone);
  if (newStart < todayEnd) return { ok: false, reason: "sameDayOrPast" };

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

  // 과거 차단(당일 지난 슬롯도 포함)
  if (startAt.getTime() < Date.now()) {
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
//   - 본인 + 1:1 + 미래(내일이후 시작) 만 변경 가능
//   - 새 시간도 내일 이후(당일 잠금)
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
        | "sameDayOrPast"
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

  const { end: todayEnd } = gymTodayRange(user.business!.timeZone);
  if (res.startAt < todayEnd) {
    return { ok: false, reason: "sameDayOrPast" };
  }

  const newStart = new Date(newStartIso);
  if (Number.isNaN(newStart.getTime())) {
    return { ok: false, reason: "invalidTarget" };
  }
  if (newStart < todayEnd) {
    return { ok: false, reason: "sameDayOrPast" };
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

// 고객 대시보드 캘린더 월 네비게이션 — 클라이언트(MeCalendar)가 전달/다음달
// 버튼마다 호출. 페이지 전체를 다시 안 받고 캘린더만 갱신.
export async function meCalendarMonth(
  slug: string,
  year: number,
  month: number,
): Promise<MeCalendarMonth> {
  const user = await requireGymCustomer(slug);
  return loadMeCalendarMonth(
    user.business!.id,
    user.id,
    gymTodayUtcMidnight(user.business!.timeZone),
    year,
    month,
  );
}
