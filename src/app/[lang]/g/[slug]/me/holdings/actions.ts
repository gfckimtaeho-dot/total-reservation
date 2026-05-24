"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireGymCustomer } from "@/lib/auth/dal";
import { gymTodayRange } from "@/lib/calendar/gymTime";
import { loadTrainerCalendar } from "@/lib/calendar/trainerCalendarPro";
import type { ReservationStatus } from "@/generated/prisma/enums";

// 트레이너 변경 + 충돌 건 재예약 서버 액션.
//
// 핵심 모델:
//  - Package.assignedStaffId 는 "소프트 기본값"(스키마 참조). 변경은 곧 이
//    기본값 교체 + 미래 1:1 예약의 staffId 재배정을 뜻한다.
//  - 트레이너 실적/지급은 Reservation.staffId 단위 집계라(trainerPerf.ts),
//    staffId 를 옮기면 앞으로 진행할 세션 실적이 새 트레이너에게 정확히 간다.
//    이미 완료(COMPLETED)된 세션은 그대로 둬 과거 실적이 흔들리지 않는다.
//  - 같은 시각에 새 트레이너가 비어 있으면 시간 그대로 staffId 만 교체(자동
//    변경). 비어 있지 않으면(예약/휴게/휴일/근무시간 밖) 옛 트레이너로 남겨
//    "재예약 필요" 상태로 둔다 — 재예약은 고객이 빈 슬롯을 고를 때 처리.

const DEAD_OR_DONE: ReservationStatus[] = [
  "CANCELLED",
  "REJECTED",
  "COMPLETED",
  "NO_SHOW",
];
const TRAINER_ROLES = ["TRAINER", "MANAGER"];

export type ResvBrief = {
  id: string;
  startIso: string;
  serviceName: string;
};

export type TrainerChangePreview =
  | {
      ok: true;
      trainerName: string;
      autoMovable: ResvBrief[];
      conflicts: ResvBrief[];
    }
  | { ok: false; reason: "invalid" };

export type ApplyTrainerChangeResult =
  | { ok: true; movedCount: number; conflictCount: number }
  | { ok: false; reason: "invalid" };

export type RebookResult =
  | { ok: true; remaining: number }
  | { ok: false; reason: "invalid" | "conflict" | "sameDayOrPast" };

type FutureResv = {
  id: string;
  startAt: Date;
  endAt: Date;
  serviceId: string;
  service: { name: string };
};

// 패키지의 미래 1:1 예약(내일 이후, CONFIRMED/PENDING). 단체수업 예약
// (scheduledClassId 있음)은 수업에 시간·트레이너가 묶여 있어 제외한다.
async function futurePersonalReservations(
  gymId: string,
  packageId: string,
  todayEnd: Date,
): Promise<FutureResv[]> {
  return prisma.reservation.findMany({
    where: {
      gymId,
      packageId,
      scheduledClassId: null,
      status: { notIn: DEAD_OR_DONE },
      startAt: { gte: todayEnd },
    },
    select: {
      id: true,
      startAt: true,
      endAt: true,
      serviceId: true,
      service: { select: { name: true } },
    },
    orderBy: { startAt: "asc" },
  });
}

// 한 시각이 트레이너 캘린더에서 "예약 가능(free)"한지. free 의 의미:
//   - 영업일 + 트레이너 업무일 (day.state === "open" — 휴무/휴가/매장휴일 아님)
//   - 영업시간 ∩ 트레이너 근무시간 안
//   - 트레이너 휴게시간 아님
//   - 그 슬롯에 기존 예약 없음
// loadTrainerCalendar 가 위 넷을 모두 반영해 셀 kind 를 계산하므로 그대로 신뢰.
function isSlotFree(
  cal: Awaited<ReturnType<typeof loadTrainerCalendar>>,
  startAt: Date,
): boolean {
  const y = startAt.getUTCFullYear();
  const m = startAt.getUTCMonth() + 1;
  const d = startAt.getUTCDate();
  const startMin = startAt.getUTCHours() * 60 + startAt.getUTCMinutes();
  const day = cal.days.find(
    (x) => x.year === y && x.month === m && x.day === d,
  );
  if (!day || day.state !== "open") return false;
  const slotIdx = cal.slotAxis.indexOf(startMin);
  if (slotIdx < 0) return false;
  return day.cells[slotIdx]?.kind === "free";
}

// 각 미래 예약을 후보 트레이너의 캘린더에 비춰 자동변경/충돌로 분류.
function classify(
  reservations: FutureResv[],
  cal: Awaited<ReturnType<typeof loadTrainerCalendar>>,
): { autoMovable: ResvBrief[]; conflicts: ResvBrief[] } {
  const autoMovable: ResvBrief[] = [];
  const conflicts: ResvBrief[] = [];
  for (const r of reservations) {
    const brief: ResvBrief = {
      id: r.id,
      startIso: r.startAt.toISOString(),
      serviceName: r.service.name,
    };
    (isSlotFree(cal, r.startAt) ? autoMovable : conflicts).push(brief);
  }
  return { autoMovable, conflicts };
}

// 패키지 소유/1:1 검증 + 후보 트레이너 검증. 통과 시 둘 다 반환.
async function loadChangeContext(
  slug: string,
  packageId: string,
  newStaffId: string,
) {
  const user = await requireGymCustomer(slug);
  const business = user.business!;
  const gymId = business.id;

  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
    select: {
      id: true,
      gymId: true,
      userId: true,
      serviceId: true,
      assignedStaffId: true,
      refundedAt: true,
      service: { select: { capacity: true } },
    },
  });
  if (
    !pkg ||
    pkg.gymId !== gymId ||
    pkg.userId !== user.id ||
    pkg.service.capacity !== 1 ||
    pkg.refundedAt // 환불 동결 권은 트레이너 변경 불가
  ) {
    return null;
  }

  const staff = await prisma.staff.findUnique({
    where: { id: newStaffId },
    select: {
      id: true,
      gymId: true,
      role: true,
      user: { select: { name: true } },
    },
  });
  if (
    !staff ||
    staff.gymId !== gymId ||
    !TRAINER_ROLES.includes(staff.role) ||
    staff.id === pkg.assignedStaffId
  ) {
    return null;
  }

  return { user, business, gymId, pkg, staff };
}

// 트레이너 변경 미리보기 — 새 트레이너 선택 직후 호출. 미래 예약을 자동변경/
// 충돌로 분류해 확인 모달이 전체 그림을 한 번에 보여주도록 한다.
export async function classifyTrainerChange(
  slug: string,
  packageId: string,
  newStaffId: string,
): Promise<TrainerChangePreview> {
  const ctx = await loadChangeContext(slug, packageId, newStaffId);
  if (!ctx) return { ok: false, reason: "invalid" };

  const { business, gymId, staff } = ctx;
  const { end: todayEnd } = gymTodayRange(business.timeZone);
  const reservations = await futurePersonalReservations(
    gymId,
    packageId,
    todayEnd,
  );
  const cal = await loadTrainerCalendar(
    gymId,
    newStaffId,
    staff.user.name,
    business.timeZone,
  );
  const { autoMovable, conflicts } = classify(reservations, cal);
  return { ok: true, trainerName: staff.user.name, autoMovable, conflicts };
}

// 트레이너 변경 확정 — Package.assignedStaffId 교체 + 자동변경 가능한 미래
// 예약의 staffId 재배정(트랜잭션). 충돌 건은 옛 트레이너로 남겨 둔다.
export async function applyTrainerChange(
  slug: string,
  packageId: string,
  newStaffId: string,
): Promise<ApplyTrainerChangeResult> {
  const ctx = await loadChangeContext(slug, packageId, newStaffId);
  if (!ctx) return { ok: false, reason: "invalid" };

  const { user, business, gymId, staff } = ctx;
  const { end: todayEnd } = gymTodayRange(business.timeZone);
  const reservations = await futurePersonalReservations(
    gymId,
    packageId,
    todayEnd,
  );
  const cal = await loadTrainerCalendar(
    gymId,
    newStaffId,
    staff.user.name,
    business.timeZone,
  );
  const { autoMovable } = classify(reservations, cal);
  const autoIds = new Set(autoMovable.map((r) => r.id));

  let movedCount = 0;
  await prisma.$transaction(async (tx) => {
    // Phase 1 정책 — 담당은 "고객+서비스" 단위. 한 권만 옮기지 않고 같은
    // 고객+서비스의 모든 권을 한꺼번에 교체해 권마다 담당이 달라지는 정합성
    // 깨짐을 막는다. 환불 동결(refundedAt) 권은 제외.
    await tx.package.updateMany({
      where: {
        gymId: ctx.gymId,
        userId: ctx.user.id,
        serviceId: ctx.pkg.serviceId,
        refundedAt: null,
      },
      data: { assignedStaffId: newStaffId },
    });
    for (const r of reservations) {
      if (!autoIds.has(r.id)) continue;
      // 분류 시점 이후 새 트레이너에 예약이 끼어들었을 race 를 막는 최종
      // 확인 — 충돌이 생겼으면 옮기지 않고 옛 트레이너로 남긴다.
      const conflict = await tx.reservation.findFirst({
        where: {
          gymId,
          staffId: newStaffId,
          id: { not: r.id },
          status: { notIn: ["CANCELLED", "REJECTED"] },
          startAt: { lt: r.endAt },
          endAt: { gt: r.startAt },
        },
        select: { id: true },
      });
      if (conflict) continue;
      await tx.reservation.update({
        where: { id: r.id },
        data: { staffId: newStaffId },
      });
      await tx.reservationLog.create({
        data: {
          gymId,
          reservationId: r.id,
          action: "CHANGED_BY_CUSTOMER",
          actorUserId: user.id,
        },
      });
      movedCount++;
    }
  });

  revalidatePath(`/ko/g/${slug}/me`);
  revalidatePath(`/en/g/${slug}/me`);
  revalidatePath(`/ko/g/${slug}/me/holdings`);
  revalidatePath(`/en/g/${slug}/me/holdings`);
  return {
    ok: true,
    movedCount,
    conflictCount: reservations.length - movedCount,
  };
}

// 충돌 건 재예약 — 옛 트레이너 예약 취소 + 새 트레이너 예약 생성을 한
// 트랜잭션에서 원자적으로. 횟수는 완료 시 차감 모델이라 취소/생성이 횟수
// 중립(cancelReservation 주석과 동일 근거).
export async function rebookOnNewTrainer(
  slug: string,
  packageId: string,
  oldReservationId: string,
  newStartIso: string,
): Promise<RebookResult> {
  const user = await requireGymCustomer(slug);
  const business = user.business!;
  const gymId = business.id;

  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
    select: {
      id: true,
      gymId: true,
      userId: true,
      assignedStaffId: true,
    },
  });
  if (
    !pkg ||
    pkg.gymId !== gymId ||
    pkg.userId !== user.id ||
    !pkg.assignedStaffId
  ) {
    return { ok: false, reason: "invalid" };
  }
  const newStaffId = pkg.assignedStaffId;

  const old = await prisma.reservation.findUnique({
    where: { id: oldReservationId },
    select: {
      id: true,
      gymId: true,
      customerUserId: true,
      packageId: true,
      scheduledClassId: true,
      status: true,
      staffId: true,
      startAt: true,
      endAt: true,
      serviceId: true,
    },
  });
  if (
    !old ||
    old.gymId !== gymId ||
    old.customerUserId !== user.id ||
    old.packageId !== packageId ||
    old.scheduledClassId !== null ||
    DEAD_OR_DONE.includes(old.status) ||
    old.staffId === newStaffId
  ) {
    return { ok: false, reason: "invalid" };
  }

  const { end: todayEnd } = gymTodayRange(business.timeZone);
  if (old.startAt < todayEnd) return { ok: false, reason: "invalid" };

  const newStart = new Date(newStartIso);
  if (Number.isNaN(newStart.getTime()) || newStart < todayEnd) {
    return { ok: false, reason: "sameDayOrPast" };
  }
  const durationMs = old.endAt.getTime() - old.startAt.getTime();
  const newEnd = new Date(newStart.getTime() + durationMs);

  // 새 트레이너 캘린더로 슬롯 유효성 검증 — 업무일·근무시간·휴게·빈자리.
  // UI 가 빈 슬롯만 노출하지만 서버 액션 단독으로도 견고하도록 재검증.
  const cal = await loadTrainerCalendar(
    gymId,
    newStaffId,
    "",
    business.timeZone,
  );
  if (!isSlotFree(cal, newStart)) return { ok: false, reason: "conflict" };

  // 캘린더 스냅샷 이후 끼어든 예약을 막는 최종 확인(race guard).
  const conflict = await prisma.reservation.findFirst({
    where: {
      gymId,
      staffId: newStaffId,
      status: { notIn: ["CANCELLED", "REJECTED"] },
      startAt: { lt: newEnd },
      endAt: { gt: newStart },
    },
    select: { id: true },
  });
  if (conflict) return { ok: false, reason: "conflict" };

  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id: old.id },
      data: { status: "CANCELLED" },
    });
    await tx.reservationLog.create({
      data: {
        gymId,
        reservationId: old.id,
        action: "CANCELLED_BY_CUSTOMER",
        actorUserId: user.id,
      },
    });
    const created = await tx.reservation.create({
      data: {
        gymId,
        serviceId: old.serviceId,
        staffId: newStaffId,
        customerUserId: user.id,
        startAt: newStart,
        endAt: newEnd,
        status: "CONFIRMED",
        packageId,
      },
      select: { id: true },
    });
    await tx.reservationLog.create({
      data: {
        gymId,
        reservationId: created.id,
        action: "CREATED",
        actorUserId: user.id,
      },
    });
  });

  // 남은 재예약 = 이 패키지의 미래 1:1 예약 중 아직 새 트레이너가 아닌 것.
  const remaining = await prisma.reservation.count({
    where: {
      gymId,
      packageId,
      scheduledClassId: null,
      status: { notIn: DEAD_OR_DONE },
      startAt: { gte: todayEnd },
      staffId: { not: newStaffId },
    },
  });

  revalidatePath(`/ko/g/${slug}/me`);
  revalidatePath(`/en/g/${slug}/me`);
  revalidatePath(`/ko/g/${slug}/me/holdings`);
  revalidatePath(`/en/g/${slug}/me/holdings`);
  return { ok: true, remaining };
}
