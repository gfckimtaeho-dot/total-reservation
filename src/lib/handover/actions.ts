"use server";

// 1:1 PT(capacity=1 service) 트레이너 양도 — server action.
// 스펙: docs/handover.md. 결정: decision_pt_handover (환불 없음, 일괄, 시스템 메시지 자동).

import { prisma } from "@/lib/db/client";
import { verifySession } from "@/lib/auth/dal";
import { revalidatePath } from "next/cache";
import {
  checkStaffAvailability,
  weekdayOfUtcDate,
} from "@/lib/booking/staffAvailability";
import { insertSystemMessage } from "@/lib/chat/system";

type R<T = unknown> = ({ ok: true } & T) | { ok: false; error: string };

type Result = {
  packagesUpdated: number;
  reservationsTransferred: number;
  reservationsCancelled: number;
};

// 일반 흐름:
// 1) 권한 — 트레이너는 본인 담당만, OWNER/MANAGER 는 매장 전체.
// 2) 같은 (customer, service) 의 활성 Package.assignedStaffId 일괄 갱신.
// 3) 미래 예약 충돌 검사 → 충돌 없으면 staffId 갱신, 충돌이면 status=CANCELLED + 권 +1 복귀.
// 4) ChatThread.staffUserId 갱신(있으면) + 시스템 메시지.
//
// 모두 한 트랜잭션. 중간 실패 시 일관성 보장.
export async function handoverServiceAssignment(input: {
  slug: string;
  customerId: string;
  serviceId: string;
  toStaffUserId: string;
}): Promise<R<Result>> {
  const user = await verifySession();
  if (!user || !user.business || user.business.slug !== input.slug) {
    return { ok: false, error: "로그인이 필요합니다" };
  }
  if (
    user.role !== "OWNER" &&
    user.role !== "MANAGER" &&
    user.role !== "TRAINER"
  ) {
    return { ok: false, error: "권한이 없습니다" };
  }
  const gymId = user.gymId!;

  // service 검증 — 1:1 (capacity=1) 만.
  const service = await prisma.service.findFirst({
    where: { id: input.serviceId, gymId },
    select: { id: true, name: true, capacity: true, durationMin: true },
  });
  if (!service) return { ok: false, error: "서비스를 찾을 수 없습니다" };
  if (service.capacity !== 1) {
    return {
      ok: false,
      error: "단체 수업은 트레이너 양도가 불가합니다",
    };
  }

  // 받는 트레이너 — active TRAINER, 본인 제외, 같은 매장.
  const toStaff = await prisma.staff.findFirst({
    where: {
      gymId,
      userId: input.toStaffUserId,
      role: "TRAINER",
      user: { active: true, status: "ACTIVE" },
    },
    select: {
      id: true,
      userId: true,
      weeklyOffDays: true,
      workStartMin: true,
      workEndMin: true,
      breakStartMin: true,
      breakEndMin: true,
      user: { select: { id: true, name: true, active: true } },
    },
  });
  if (!toStaff) {
    return { ok: false, error: "받을 트레이너를 찾을 수 없습니다" };
  }
  if (toStaff.userId === user.id) {
    return { ok: false, error: "본인에게 양도할 수 없습니다" };
  }

  // 트레이너 권한 — 본인이 (customer, service) Package 중 하나라도 담당이어야.
  if (user.role === "TRAINER") {
    const myStaff = await prisma.staff.findFirst({
      where: { gymId, userId: user.id },
      select: { id: true },
    });
    if (!myStaff) return { ok: false, error: "트레이너 정보 없음" };
    const owned = await prisma.package.findFirst({
      where: {
        gymId,
        userId: input.customerId,
        serviceId: input.serviceId,
        assignedStaffId: myStaff.id,
      },
      select: { id: true },
    });
    if (!owned) {
      return { ok: false, error: "본인이 담당인 권만 양도할 수 있습니다" };
    }
  }

  // 충돌 검사용 — 새 트레이너의 기존 예약 시각 set.
  const futureNow = new Date();
  const targetReservations = await prisma.reservation.findMany({
    where: {
      gymId,
      customerUserId: input.customerId,
      serviceId: input.serviceId,
      status: { in: ["CONFIRMED", "PENDING_PAYMENT"] },
      startAt: { gte: futureNow },
    },
    select: {
      id: true,
      startAt: true,
      endAt: true,
      packageId: true,
    },
  });

  const toStaffExistingReservations = await prisma.reservation.findMany({
    where: {
      gymId,
      staffId: toStaff.id,
      status: { in: ["CONFIRMED", "PENDING_PAYMENT"] },
      startAt: { gte: futureNow },
    },
    select: { startAt: true, endAt: true },
  });

  // StaffLeave (개인 휴가) 도 충돌 사유. 검사할 날짜 범위만 쿼리.
  const reservationDates = targetReservations.map((r) => r.startAt);
  const minDate = reservationDates.length
    ? new Date(Math.min(...reservationDates.map((d) => d.getTime())))
    : null;
  const maxDate = reservationDates.length
    ? new Date(Math.max(...reservationDates.map((d) => d.getTime())))
    : null;
  const toStaffLeaves = minDate && maxDate
    ? await prisma.staffLeave.findMany({
        where: {
          staffId: toStaff.id,
          startDate: { lte: maxDate },
          endDate: { gte: minDate },
        },
        select: { startDate: true, endDate: true },
      })
    : [];

  // 충돌 분류 (트랜잭션 밖에서 미리 결정 — 트랜잭션 안에서 빠르게 처리).
  const conflicts: string[] = [];
  const transfers: string[] = [];
  for (const r of targetReservations) {
    const conflict = detectConflict({
      startAt: r.startAt,
      endAt: r.endAt,
      staff: {
        weeklyOffDays: toStaff.weeklyOffDays,
        workStartMin: toStaff.workStartMin,
        workEndMin: toStaff.workEndMin,
        breakStartMin: toStaff.breakStartMin,
        breakEndMin: toStaff.breakEndMin,
      },
      existing: toStaffExistingReservations,
      leaves: toStaffLeaves,
    });
    if (conflict) conflicts.push(r.id);
    else transfers.push(r.id);
  }
  const conflictReservations = targetReservations.filter((r) =>
    conflicts.includes(r.id),
  );

  // 트랜잭션 실행.
  const out = await prisma.$transaction(async (tx) => {
    // 0) 양도 직전 옛 담당 트레이너 User.id 수집 — 시스템 메시지 대상 thread 식별용.
    const beforePkgs = await tx.package.findMany({
      where: {
        gymId,
        userId: input.customerId,
        serviceId: input.serviceId,
        remainingCount: { gt: 0 },
      },
      select: { assignedStaff: { select: { userId: true } } },
    });
    const fromStaffUserIds = new Set<string>();
    for (const p of beforePkgs) {
      if (p.assignedStaff?.userId) fromStaffUserIds.add(p.assignedStaff.userId);
    }

    // 1) Package 일괄 갱신.
    const pkgUpd = await tx.package.updateMany({
      where: {
        gymId,
        userId: input.customerId,
        serviceId: input.serviceId,
        remainingCount: { gt: 0 },
      },
      data: { assignedStaffId: toStaff.id },
    });

    // 2) 충돌 없는 예약 staffId 갱신.
    if (transfers.length > 0) {
      await tx.reservation.updateMany({
        where: { id: { in: transfers } },
        data: { staffId: toStaff.id },
      });
      for (const rid of transfers) {
        await tx.reservationLog.create({
          data: {
            gymId,
            reservationId: rid,
            action: "CHANGED_BY_STAFF",
            actorUserId: user.id,
          },
        });
      }
    }

    // 3) 충돌 예약 자동 취소 + Package.remainingCount +1 복귀.
    for (const r of conflictReservations) {
      await tx.reservation.update({
        where: { id: r.id },
        data: { status: "CANCELLED" },
      });
      await tx.reservationLog.create({
        data: {
          gymId,
          reservationId: r.id,
          action: "CANCELLED_BY_HANDOVER",
          actorUserId: user.id,
        },
      });
      // 권 차감 복귀 — 해당 예약이 차감한 packageId 가 있을 때만 (1:1 PT 는 항상 있음).
      if (r.packageId) {
        await tx.package.update({
          where: { id: r.packageId },
          data: { remainingCount: { increment: 1 } },
        });
      }
    }

    // 4) ChatThread 처리 — service 단위 양도 vs thread 가 trainer 페어 단위 1개라
    //    부수 효과를 일으키지 않도록 다음 규칙으로 좁힌다:
    //    - 새 트레이너 ↔ customer thread: find or create + 시스템 메시지 1줄.
    //    - 옛 담당 트레이너(이번 양도 직전 assignedStaff) ↔ customer thread:
    //      thread close 하지 않음 (다른 service 담당으로 여전히 연결돼 있을 수 있음).
    //      시스템 메시지만 1줄 박아 변경 사실을 trail 로 남김.
    //    - 그 외 다른 트레이너 thread (이번 양도와 무관) 는 건드리지 않음.
    let toThread = await tx.chatThread.findFirst({
      where: {
        gymId,
        kind: "TRAINER",
        customerId: input.customerId,
        staffUserId: toStaff.userId,
      },
      select: { id: true },
    });
    if (!toThread) {
      toThread = await tx.chatThread.create({
        data: {
          gymId,
          kind: "TRAINER",
          customerId: input.customerId,
          staffUserId: toStaff.userId,
        },
        select: { id: true },
      });
    }
    await insertSystemMessage(tx, {
      threadId: toThread.id,
      actorId: user.id,
      body: `${service.name} 담당 트레이너가 ${toStaff.user.name}으로 변경되었습니다.`,
    });

    // 옛 담당 트레이너 식별 — 양도 직전 Package.assignedStaff. fromStaffUserIds
    // 는 1명일 수도 N명일 수도 (드물게 같은 service 의 여러 권이 서로 다른
    // 트레이너로 매핑된 비정상 케이스). 모두 시스템 메시지 1줄.
    if (fromStaffUserIds.size > 0) {
      const fromThreads = await tx.chatThread.findMany({
        where: {
          gymId,
          kind: "TRAINER",
          customerId: input.customerId,
          staffUserId: { in: Array.from(fromStaffUserIds) },
        },
        select: { id: true, staffUserId: true },
      });
      for (const th of fromThreads) {
        if (th.staffUserId === toStaff.userId) continue; // 같은 사람일 리 없지만 방어.
        await insertSystemMessage(tx, {
          threadId: th.id,
          actorId: user.id,
          body: `${service.name} 담당이 ${toStaff.user.name}으로 변경되었습니다.`,
        });
      }
    }

    return {
      packagesUpdated: pkgUpd.count,
      reservationsTransferred: transfers.length,
      reservationsCancelled: conflictReservations.length,
    };
  });

  // revalidate.
  revalidatePath(`/${input.slug}/my-clients`);
  revalidatePath(`/${input.slug}/my-clients/${input.customerId}`);
  revalidatePath(`/${input.slug}/members/${input.customerId}`);
  revalidatePath(`/${input.slug}/chat`);

  return { ok: true, ...out };
}

// 단일 예약이 새 트레이너의 가용성에 충돌하는지. 충돌 시 사유 문자열 반환, OK 면 null.
function detectConflict(input: {
  startAt: Date;
  endAt: Date;
  staff: {
    weeklyOffDays: import("@/generated/prisma/enums").Weekday[];
    workStartMin: number | null;
    workEndMin: number | null;
    breakStartMin: number | null;
    breakEndMin: number | null;
  };
  existing: { startAt: Date; endAt: Date }[];
  leaves: { startDate: Date; endDate: Date }[];
}): string | null {
  const weekday = weekdayOfUtcDate(input.startAt);
  const startMin = input.startAt.getUTCHours() * 60 + input.startAt.getUTCMinutes();
  const endMin = input.endAt.getUTCHours() * 60 + input.endAt.getUTCMinutes();

  // 정기 가용성.
  const r = checkStaffAvailability({
    weekday,
    startMin,
    endMin,
    staff: input.staff,
  });
  if (!r.ok) return r.reason;

  // 휴가 기간.
  for (const lv of input.leaves) {
    if (input.startAt <= lv.endDate && input.endAt >= lv.startDate) {
      return "staffOnLeave";
    }
  }

  // 기존 예약 시간 겹침.
  for (const ex of input.existing) {
    if (input.startAt < ex.endAt && input.endAt > ex.startAt) {
      return "existingReservationOverlap";
    }
  }

  return null;
}

// UI 에서 "받을 트레이너 후보" 리스트 조회. 본인/현재담당 제외.
export async function listHandoverCandidates(input: {
  slug: string;
  excludeUserId: string; // 본인 (트레이너) 또는 현재 담당
}): Promise<R<{ candidates: { userId: string; name: string }[] }>> {
  const user = await verifySession();
  if (!user || !user.business || user.business.slug !== input.slug) {
    return { ok: false, error: "로그인이 필요합니다" };
  }
  const gymId = user.gymId!;
  const rows = await prisma.staff.findMany({
    where: {
      gymId,
      role: "TRAINER",
      user: { active: true, status: "ACTIVE", id: { not: input.excludeUserId } },
    },
    select: {
      user: { select: { id: true, name: true } },
    },
    orderBy: { user: { name: "asc" } },
  });
  return {
    ok: true,
    candidates: rows.map((r) => ({ userId: r.user.id, name: r.user.name })),
  };
}
