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
// 3) 미래 예약 충돌 검사 → 충돌 없으면 staffId 갱신, 충돌이면 status=CANCELLED.
//    remainingCount 는 건드리지 않음 — 예약 생성/취소는 잔여를 바꾸지 않고
//    완료 시점에만 차감하는 정책. (me/actions.ts L127 참조)
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
  if (!service) return { ok: false, error: "프로그램을 찾을 수 없습니다" };
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

    // 3) 충돌 예약 자동 취소. remainingCount 는 변경하지 않음 —
    //    예약 생성 시 차감하지 않는 정책(완료 시점에만 차감)이라 취소 시 복귀도 없음.
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
    }

    // 4) ChatThread 처리 — 양도 알림은 두 채널로 발송한다:
    //    - 새 트레이너 ↔ 회원 TRAINER thread: find or create + 시스템 메시지 1줄.
    //      새 트레이너 입장 알림(본인 sidebar 채팅 뱃지) + 회원 입장 새 thread 시작 안내.
    //    - 회원 ↔ 매장 STORE thread: front desk 통지 시스템 메시지 1줄.
    //      "시스템 = 매장(front desk)" 도메인 관점([[decision-chat-scope-phase1]] 보강).
    //    옛 담당 TRAINER thread 에는 시스템 메시지 발송하지 않는다 — 회원이 다시
    //    열어볼 이유 없는 thread 에 unread 가 영구 잔존하는 문제 방지.
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

    // STORE thread find or create — 회원이 매장 채팅을 한 번도 안 열었어도
    // front desk 양도 통지를 받게 한다.
    let storeThread = await tx.chatThread.findFirst({
      where: {
        gymId,
        kind: "STORE",
        customerId: input.customerId,
      },
      select: { id: true },
    });
    if (!storeThread) {
      storeThread = await tx.chatThread.create({
        data: {
          gymId,
          kind: "STORE",
          customerId: input.customerId,
          staffUserId: null,
        },
        select: { id: true },
      });
    }
    await insertSystemMessage(tx, {
      threadId: storeThread.id,
      actorId: user.id,
      body: `[담당 변경] ${service.name} 담당 트레이너가 ${toStaff.user.name}으로 변경되었습니다.`,
    });

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
