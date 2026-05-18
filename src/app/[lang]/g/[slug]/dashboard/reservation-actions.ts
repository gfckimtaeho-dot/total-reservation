"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { ymd } from "@/lib/hours/status";

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
function todayKey(): string {
  const n = new Date();
  return ymd(new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())));
}

type Owned =
  | { ok: false; error: string }
  | {
      ok: true;
      gymId: string;
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
  return { ok: true, gymId, res };
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

  const tKey = todayKey();
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

  await prisma.reservation.update({
    where: { id: res.id },
    data: { startAt: newStart, endAt: newEnd },
  });
  revalidatePath(`/ko/g/${input.slug}/dashboard`);
  revalidatePath(`/en/g/${input.slug}/dashboard`);
  return { ok: true };
}

// 수업 완료 — status=COMPLETED + 완료시각 기록. 고객 일방취소+환불포기도
// 이걸로 마감(별도 취소 버튼 없음). 정산 산식은 Sale/payout 작업과 함께(후속).
export async function completeReservation(input: {
  slug: string;
  reservationId: string;
}): Promise<Result> {
  const owned = await loadOwned(input.slug, input.reservationId);
  if (!owned.ok) return { ok: false, error: owned.error };
  const { res } = owned;
  if (res.status === "COMPLETED") return { ok: true }; // 멱등 — 중복 차감 방지

  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id: res.id },
      data: { status: "COMPLETED", completedAt: new Date() },
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
        const deduct = Number(svc?.deductCount ?? 1);
        const next = Math.max(0, Number(pkg.remainingCount) - deduct);
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

export async function cancelReservation(input: {
  slug: string;
  reservationId: string;
}): Promise<Result> {
  const owned = await loadOwned(input.slug, input.reservationId);
  if (!owned.ok) return { ok: false, error: owned.error };
  const { res } = owned;

  if (dayKeyUtc(res.startAt) < todayKey()) {
    return { ok: false, error: "지난 예약은 취소할 수 없습니다" };
  }
  await prisma.reservation.update({
    where: { id: res.id },
    data: { status: "CANCELLED" },
  });
  revalidatePath(`/ko/g/${input.slug}/dashboard`);
  revalidatePath(`/en/g/${input.slug}/dashboard`);
  return { ok: true };
}
