"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { ymd } from "@/lib/hours/status";
import { gymTodayUtcMidnight } from "@/lib/calendar/gymTime";

// 트레이너 예약 변경/취소. 규칙:
//  - 과거 예약(시작일 < 오늘, UTC-naive 기준)은 변경·취소 불가.
//  - 새 시각도 과거일 수 없음.
//  - 본인(담당 staff) 예약만 / OWNER·MANAGER 는 전체 허용.
//  - 같은 트레이너의 다른 활성 예약과 겹치면 거부.
// 시스템 전반과 동일하게 UTC 파츠 = 달력일·시각.

type Result = { ok: true } | { ok: false; error: string };

function dayKeyUtc(d: Date): string {
  return ymd(
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())),
  );
}
// 매장 타임존 기준 오늘 — UTC-naive 저장과 같은 기준으로 비교.
function todayKey(timeZone: string): string {
  return ymd(gymTodayUtcMidnight(timeZone));
}

type Owned =
  | { ok: false; error: string }
  | {
      ok: true;
      gymId: string;
      timeZone: string;
      actorUserId: string;
      res: NonNullable<
        Awaited<ReturnType<typeof prisma.reservation.findFirst>>
      >;
    };

async function loadOwned(
  slug: string,
  reservationId: string,
): Promise<Owned> {
  const auth = await requireGymStaff(slug);
  const gymId = auth.business!.id;
  const res = await prisma.reservation.findFirst({
    where: { id: reservationId, gymId },
  });
  if (!res) return { ok: false, error: "예약을 찾을 수 없습니다" };
  if (auth.role !== "OWNER" && auth.role !== "MANAGER") {
    const staff = await prisma.staff.findFirst({
      where: { userId: auth.id, gymId },
      select: { id: true },
    });
    if (!staff || staff.id !== res.staffId) {
      return { ok: false, error: "본인 예약만 변경할 수 있습니다" };
    }
  }
  return {
    ok: true,
    gymId,
    timeZone: auth.business!.timeZone,
    actorUserId: auth.id,
    res,
  };
}

export async function rescheduleReservation(input: {
  slug: string;
  reservationId: string;
  year: number;
  month: number; // 1-12
  day: number;
  startMin: number;
}): Promise<Result> {
  const owned = await loadOwned(input.slug, input.reservationId);
  if (!owned.ok) return { ok: false, error: owned.error };
  const { gymId, res } = owned;

  const tKey = todayKey(owned.timeZone);
  if (dayKeyUtc(res.startAt) < tKey) {
    return { ok: false, error: "지난 예약은 변경할 수 없습니다" };
  }

  const durationMs = res.endAt.getTime() - res.startAt.getTime();
  const newStart = new Date(
    Date.UTC(
      input.year,
      input.month - 1,
      input.day,
      Math.floor(input.startMin / 60),
      input.startMin % 60,
      0,
    ),
  );
  // 현재 시각 이전으로는 이동 금지 (오늘이라도 이미 지난 슬롯 차단).
  if (newStart.getTime() < Date.now()) {
    return { ok: false, error: "지난 시간으로는 옮길 수 없습니다" };
  }
  const newEnd = new Date(newStart.getTime() + durationMs);

  const clash = await prisma.reservation.findFirst({
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
  if (clash) return { ok: false, error: "그 시간에 이미 다른 예약이 있습니다" };

  // 트레이너 일정변경 — 당일 변경도 분쟁 소지가 있어 ReservationLog 로 흔적을 남긴다.
  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id: res.id },
      data: { startAt: newStart, endAt: newEnd },
    });
    await tx.reservationLog.create({
      data: {
        gymId,
        reservationId: res.id,
        action: "CHANGED_BY_STAFF",
        actorUserId: owned.actorUserId,
      },
    });
  });
  revalidatePath(`/ko/g/${input.slug}/dashboard`);
  revalidatePath(`/en/g/${input.slug}/dashboard`);
  return { ok: true };
}

// 수업 완료 — status=COMPLETED + 완료시각 기록. 고객 일방취소+환불포기도
// 이걸로 마감(별도 취소 버튼 없음). 정산 산식은 Sale/payout 작업과 함께(후속).
// note(운동 부위 메모) 는 옵션 — 빈/미지정이면 null. 길이 80 자 cap (placeholder
// 가 짧은 라벨 유도). 사후 수정은 updateReservationNote 별도 액션에서.
export async function completeReservation(input: {
  slug: string;
  reservationId: string;
  note?: string;
}): Promise<Result> {
  const owned = await loadOwned(input.slug, input.reservationId);
  if (!owned.ok) return { ok: false, error: owned.error };
  const { res } = owned;
  if (res.status === "COMPLETED") return { ok: true }; // 멱등 — 중복 차감 방지

  // 완료는 당일 수업만 — 미래·과거 회차는 완료 처리 불가.
  if (dayKeyUtc(res.startAt) !== todayKey(owned.timeZone)) {
    return { ok: false, error: "당일 수업만 완료 처리할 수 있습니다" };
  }

  const note = input.note?.trim() || null;
  const cappedNote = note && note.length > 80 ? note.slice(0, 80) : note;

  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id: res.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        completionNote: cappedNote,
      },
    });
    // 연결된 권에서 deductCount 만큼 차감(원본 totalCount 는 불변, 잔여만 ↓).
    if (res.packageId) {
      const svc = await tx.service.findUnique({
        where: { id: res.serviceId },
        select: { deductCount: true },
      });
      const pkg = await tx.package.findUnique({
        where: { id: res.packageId },
        select: { remainingCount: true },
      });
      if (pkg) {
        const deduct = svc?.deductCount ?? 1;
        const next = Math.max(0, pkg.remainingCount - deduct);
        await tx.package.update({
          where: { id: res.packageId },
          data: { remainingCount: next },
        });
      }
    }
  });

  revalidatePath(`/ko/g/${input.slug}/dashboard`);
  revalidatePath(`/en/g/${input.slug}/dashboard`);
  return { ok: true };
}

// 트레이너 예약 취소 — 당일도 허용(트레이너 재량). 정책:
//  - 지난 예약(시작일 < 오늘)은 취소 불가.
//  - 완료/노쇼 처리된 예약은 취소 불가(완료 취소 먼저).
//  - 이미 취소/거절이면 멱등 ok.
//  - 횟수는 손대지 않는다 — 차감은 완료 시에만이라 미완료 취소는 복구할
//    몫이 없다(고객 cancelReservation 과 동일 모델). 사고 등 고객 무귀책
//    상황에서 고객이 횟수를 잃지 않는다.
//  - ReservationLog(CANCELLED_BY_STAFF) 로 누가 언제 취소했는지 흔적을 남긴다.
export async function cancelReservation(input: {
  slug: string;
  reservationId: string;
}): Promise<Result> {
  const owned = await loadOwned(input.slug, input.reservationId);
  if (!owned.ok) return { ok: false, error: owned.error };
  const { gymId, res } = owned;

  if (dayKeyUtc(res.startAt) < todayKey(owned.timeZone)) {
    return { ok: false, error: "지난 예약은 취소할 수 없습니다" };
  }
  if (res.status === "COMPLETED" || res.status === "NO_SHOW") {
    return { ok: false, error: "완료·노쇼 처리된 예약입니다" };
  }
  if (res.status === "CANCELLED" || res.status === "REJECTED") {
    return { ok: true }; // 이미 취소됨 — 멱등
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
        action: "CANCELLED_BY_STAFF",
        actorUserId: owned.actorUserId,
      },
    });
  });
  revalidatePath(`/ko/g/${input.slug}/dashboard`);
  revalidatePath(`/en/g/${input.slug}/dashboard`);
  return { ok: true };
}

// 수업 완료 취소(당일 한정) — 실수로 완료한 예약을 되돌림.
// status COMPLETED → CONFIRMED, 차감했던 권 1회분 환불(totalCount 초과 금지).
export async function uncompleteReservation(input: {
  slug: string;
  reservationId: string;
}): Promise<Result> {
  const owned = await loadOwned(input.slug, input.reservationId);
  if (!owned.ok) return { ok: false, error: owned.error };
  const { res } = owned;
  if (res.status !== "COMPLETED") {
    return { ok: false, error: "완료된 예약이 아닙니다" };
  }
  if (dayKeyUtc(res.startAt) !== todayKey(owned.timeZone)) {
    return { ok: false, error: "당일 수업만 완료를 취소할 수 있습니다" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id: res.id },
      // 완료 취소 시 메모도 함께 비움 — 다시 완료할 때 새로 적도록.
      data: {
        status: "CONFIRMED",
        completedAt: null,
        completionNote: null,
      },
    });
    // 완료 시 차감했던 만큼 환불 — 원본 totalCount 초과 금지.
    if (res.packageId) {
      const svc = await tx.service.findUnique({
        where: { id: res.serviceId },
        select: { deductCount: true },
      });
      const pkg = await tx.package.findUnique({
        where: { id: res.packageId },
        select: { remainingCount: true, totalCount: true },
      });
      if (pkg) {
        const deduct = svc?.deductCount ?? 1;
        const next = Math.min(
          pkg.totalCount,
          pkg.remainingCount + deduct,
        );
        await tx.package.update({
          where: { id: res.packageId },
          data: { remainingCount: next },
        });
      }
    }
  });
  revalidatePath(`/ko/g/${input.slug}/dashboard`);
  revalidatePath(`/en/g/${input.slug}/dashboard`);
  return { ok: true };
}
