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
import { loadTrainerCalendar } from "@/lib/calendar/trainerCalendarPro";

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
      // 비활성 사유 — off: 트레이너 휴무 요일, leave: 휴가, full: 예약 마감
      reason: "off" | "leave" | "full" | null;
    }
  | {
      kind: "group";
      scheduleId: string;
      serviceName: string;
      startMin: number;
    };

export type MeDayBookingResult = {
  hasPasses: boolean; // 잔여 있는 권을 하나라도 보유 (안내 문구 분기용)
  options: MeDayOption[];
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

export async function loadMeDayBooking(
  slug: string,
  dateKey: string, // "YYYY-MM-DD"
): Promise<MeDayBookingResult> {
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

  const packages = await prisma.package.findMany({
    where: { gymId, userId: user.id, remainingCount: { gt: 0 } },
    select: {
      id: true,
      assignedStaffId: true,
      assignedStaff: {
        select: { user: { select: { name: true } } },
      },
      service: { select: { id: true, name: true, capacity: true } },
    },
    orderBy: { createdAt: "asc" }, // FIFO
  });
  const hasPasses = packages.length > 0;
  const options: MeDayOption[] = [];

  // --- 1:1 — 서비스별 1장(FIFO), 트레이너별로 묶어 캘린더 1회만 로드.
  // 그날 불가하면 빼지 않고 available:false + 사유로 노출. ---
  const seenSvc = new Set<string>();
  const byTrainer = new Map<
    string,
    { packageId: string; serviceName: string; trainerName: string }[]
  >();
  for (const p of packages) {
    if (p.service.capacity !== 1 || !p.assignedStaffId) continue;
    if (seenSvc.has(p.service.id)) continue;
    seenSvc.add(p.service.id);
    const arr = byTrainer.get(p.assignedStaffId) ?? [];
    arr.push({
      packageId: p.id,
      serviceName: p.service.name,
      trainerName: p.assignedStaff?.user.name ?? "",
    });
    byTrainer.set(p.assignedStaffId, arr);
  }
  for (const [staffId, pkgs] of byTrainer) {
    const cal = await loadTrainerCalendar(
      gymId,
      staffId,
      "",
      business.timeZone,
    );
    const day = cal.days.find(
      (x) => x.year === y && x.month === mon && x.day === d,
    );
    let available = false;
    let reason: "off" | "leave" | "full" | null = null;
    if (!day || day.state === "closed") {
      reason = "off";
    } else if (day.state === "off") {
      // GridDay.reason 이 있으면 휴가, 없으면 정기 휴무 요일.
      reason = day.reason ? "leave" : "off";
    } else if (day.cells.some((c) => c.kind === "free")) {
      available = true;
    } else {
      reason = "full";
    }
    for (const pk of pkgs) {
      options.push({
        kind: "oneToOne",
        packageId: pk.packageId,
        serviceName: pk.serviceName,
        trainerName: pk.trainerName,
        available,
        reason,
      });
    }
  }

  // --- 단체 — 그 날 회차 + 정원 여유 + 미등록 ---
  const groupServiceIds = [
    ...new Set(
      packages
        .filter((p) => p.service.capacity > 1)
        .map((p) => p.service.id),
    ),
  ];
  if (groupServiceIds.length > 0) {
    const wd = ME_WEEKDAY[dayUtcMid.getUTCDay()]!;
    const schedules = await prisma.scheduledClass.findMany({
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
    });
    for (const sc of schedules) {
      if (sc.kind === "ONE_OFF") {
        if (!sc.specificDate || ymdUtc(sc.specificDate) !== dateKey) {
          continue;
        }
      } else if (!sc.weekdays.includes(wd)) {
        continue;
      }
      const dayResvs = await prisma.reservation.findMany({
        where: {
          gymId,
          scheduledClassId: sc.id,
          startAt: { gte: dayUtcMid, lt: dayEnd },
          status: { notIn: ["CANCELLED", "REJECTED"] },
        },
        select: { customerUserId: true },
      });
      if (dayResvs.some((r) => r.customerUserId === user.id)) continue;
      if (dayResvs.length >= sc.service.capacity) continue;
      options.push({
        kind: "group",
        scheduleId: sc.id,
        serviceName: sc.service.name,
        startMin: sc.startMinute,
      });
    }
  }

  // 단체수업(시간순) -> 1:1 가능 -> 1:1 비활성 순.
  const sortKey = (o: MeDayOption): number =>
    o.kind === "group" ? o.startMin : o.available ? 100000 : 100001;
  options.sort((a, b) => sortKey(a) - sortKey(b));
  return { hasPasses, options };
}
