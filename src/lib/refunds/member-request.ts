import { prisma } from "@/lib/db/client";
import { gymTodayUtcMidnight, gymTodayRange } from "@/lib/calendar/gymTime";
import { OPEN_STATUSES } from "@/lib/packages/availability";

// 회원 변심 환불(T17) 산식 + 신청 생성 — 카운터(사장/매니저)가 회원 대면 후 등록.
// 2026-09-23: 고객 셀프 신청(/me/holdings/refund) 폐기. 환불은 오프라인 대면으로만
// 접수하고, 기록은 사장 회원 상세에서 이 모듈로 남긴다. docs/customer.md 참고.
//
// 산식: 환불 = 올림( 환불대상 × 단위가 × 0.5 )
//   수업권: 단위=회. 환불대상 = 잔여 − 당일예약(완료 취급). 단위가 = 정가/총회.
//   회원권: 단위=일. 환불대상 = 잔여일. 단위가 = 정가/총일.
// 당일 예약은 신청 시 취소하지 않는다 — 그날 트레이너가 완료 처리하므로 "사용"으로
// 친다. 미래(내일 이후) 예약만 신청 시 취소된다. 신청 시 권은 refundedAt 으로 동결.

const MS_DAY = 24 * 60 * 60 * 1000;

export type RefundKindArg = "PACKAGE" | "MEMBERSHIP";

export type RefundPreview =
  | {
      ok: true;
      kind: RefundKindArg;
      memberName: string;
      serviceName: string;
      trainerName: string | null;
      paidPhp: number;
      // 수업권은 회 단위, 회원권은 일 단위.
      totalUnits: number;
      completedUnits: number;
      todayUnits: number;
      refundUnits: number;
      refundPhp: number;
    }
  | { ok: false; reason: "invalid" | "alreadyRefunded" };

type Computed = Extract<RefundPreview, { ok: true }> & {
  paidPerUnit: number;
};

type GymCtx = { gymId: string; timeZone: string };

// 환불 내역 계산 — 미리보기와 제출이 같은 로직을 쓰도록 단일 함수.
// 권이 이 매장 소속인지만 검사한다(호출자는 이미 매장 스태프 인증 통과).
export async function computeMemberRefund(
  gym: GymCtx,
  kind: RefundKindArg,
  id: string,
): Promise<
  | { ok: false; reason: "invalid" | "alreadyRefunded" }
  | { ok: true; data: Computed; userId: string }
> {
  const { gymId, timeZone } = gym;

  if (kind === "PACKAGE") {
    const pkg = await prisma.package.findUnique({
      where: { id },
      select: {
        id: true,
        gymId: true,
        userId: true,
        totalCount: true,
        remainingCount: true,
        pricePhp: true,
        refundedAt: true,
        user: { select: { name: true } },
        // 표시 이름은 상품명(PackagePlan) 우선 — plan 없으면 서비스명 폴백.
        plan: { select: { name: true } },
        service: { select: { name: true, deductCount: true } },
        assignedStaff: { select: { user: { select: { name: true } } } },
      },
    });
    if (!pkg || pkg.gymId !== gymId) return { ok: false, reason: "invalid" };
    if (pkg.refundedAt) return { ok: false, reason: "alreadyRefunded" };

    // 오늘 예약(완료 취급) — 당일 범위의 미완료 예약.
    const { start, end } = gymTodayRange(timeZone);
    const todayResvCount = await prisma.reservation.count({
      where: {
        gymId,
        packageId: pkg.id,
        startAt: { gte: start, lt: end },
        status: { in: [...OPEN_STATUSES] },
      },
    });
    const deduct = pkg.service.deductCount;
    const completedUnits = pkg.totalCount - pkg.remainingCount;
    const todayUnits = todayResvCount * deduct;
    const refundUnits = Math.max(0, pkg.remainingCount - todayUnits);
    const paidPerUnit = pkg.pricePhp / pkg.totalCount;
    const refundPhp = Math.ceil(refundUnits * paidPerUnit * 0.5);

    return {
      ok: true,
      userId: pkg.userId,
      data: {
        ok: true,
        kind: "PACKAGE",
        memberName: pkg.user.name,
        serviceName: pkg.plan?.name ?? pkg.service.name,
        trainerName: pkg.assignedStaff?.user.name ?? null,
        paidPhp: pkg.pricePhp,
        totalUnits: pkg.totalCount,
        completedUnits,
        todayUnits,
        refundUnits,
        refundPhp,
        paidPerUnit,
      },
    };
  }

  // ── MEMBERSHIP ──
  const m = await prisma.membership.findUnique({
    where: { id },
    select: {
      id: true,
      gymId: true,
      userId: true,
      startDate: true,
      endDate: true,
      pricePhp: true,
      refundedAt: true,
      user: { select: { name: true } },
      plan: { select: { name: true } },
    },
  });
  if (!m || m.gymId !== gymId) return { ok: false, reason: "invalid" };
  if (m.refundedAt) return { ok: false, reason: "alreadyRefunded" };

  const todayMid = gymTodayUtcMidnight(timeZone);
  const totalDays = Math.max(
    1,
    Math.round((m.endDate.getTime() - m.startDate.getTime()) / MS_DAY),
  );
  const remainingDays = Math.max(
    0,
    Math.min(
      totalDays,
      Math.round((m.endDate.getTime() - todayMid.getTime()) / MS_DAY),
    ),
  );
  const elapsedDays = totalDays - remainingDays;
  const paidPerUnit = m.pricePhp / totalDays;
  const refundPhp = Math.ceil(remainingDays * paidPerUnit * 0.5);

  return {
    ok: true,
    userId: m.userId,
    data: {
      ok: true,
      kind: "MEMBERSHIP",
      memberName: m.user.name,
      serviceName: m.plan?.name ?? "회원권",
      trainerName: null,
      paidPhp: m.pricePhp,
      totalUnits: totalDays,
      completedUnits: elapsedDays,
      todayUnits: 0,
      refundUnits: remainingDays,
      refundPhp,
      paidPerUnit,
    },
  };
}

export type RefundPayout = {
  method: "BANK_TRANSFER" | "IN_PERSON";
  bankName?: string;
  bankAccount?: string;
  accountHolder?: string;
};

export type SubmitRefundResult =
  | { ok: true; refundId: string }
  | {
      ok: false;
      reason: "invalid" | "alreadyRefunded" | "nothingToRefund" | "missingBank";
    };

// 환불 신청 생성 — RefundRequest(PENDING) + 권 동결 + 미래 예약 취소.
// actorUserId = 등록한 스태프. 지급 완료는 /refunds 의 completeRefund 가 마감.
export async function createMemberRefundRequest(
  gym: GymCtx,
  kind: RefundKindArg,
  id: string,
  payout: RefundPayout,
  actorUserId: string,
): Promise<SubmitRefundResult> {
  const r = await computeMemberRefund(gym, kind, id);
  if (!r.ok) return { ok: false, reason: r.reason };
  const { data, userId } = r;
  const { gymId, timeZone } = gym;
  if (data.refundUnits <= 0) return { ok: false, reason: "nothingToRefund" };

  const bankName = payout.bankName?.trim() || null;
  const bankAccount = payout.bankAccount?.trim() || null;
  const accountHolder = payout.accountHolder?.trim() || null;
  if (
    payout.method === "BANK_TRANSFER" &&
    (!bankName || !bankAccount || !accountHolder)
  ) {
    return { ok: false, reason: "missingBank" };
  }

  // 미래(내일 이후) 예약 — 신청 시 취소. 당일 예약은 그대로(완료 취급).
  const { end: todayEnd } = gymTodayRange(timeZone);
  const futureResvIds =
    kind === "PACKAGE"
      ? (
          await prisma.reservation.findMany({
            where: {
              gymId,
              packageId: id,
              startAt: { gte: todayEnd },
              status: { in: [...OPEN_STATUSES] },
            },
            select: { id: true },
          })
        ).map((x) => x.id)
      : [];

  const now = new Date();
  const refundId = await prisma.$transaction(async (tx) => {
    const created = await tx.refundRequest.create({
      data: {
        gymId,
        userId,
        kind,
        packageId: kind === "PACKAGE" ? id : null,
        membershipId: kind === "MEMBERSHIP" ? id : null,
        serviceName: data.serviceName,
        trainerName: data.trainerName,
        paidPhp: data.paidPhp,
        refundPhp: data.refundPhp,
        totalUnits: data.totalUnits,
        completedUnits: data.completedUnits,
        todayUnits: data.todayUnits,
        refundUnits: data.refundUnits,
        payoutMethod: payout.method,
        bankName,
        bankAccount,
        accountHolder,
        reason: "CUSTOMER_REQUEST",
      },
      select: { id: true },
    });
    // 권 동결.
    if (kind === "PACKAGE") {
      await tx.package.update({ where: { id }, data: { refundedAt: now } });
    } else {
      await tx.membership.update({ where: { id }, data: { refundedAt: now } });
    }
    // 미래 예약 취소 + 로그(스태프가 대신 취소).
    if (futureResvIds.length > 0) {
      await tx.reservation.updateMany({
        where: { id: { in: futureResvIds } },
        data: { status: "CANCELLED" },
      });
      await tx.reservationLog.createMany({
        data: futureResvIds.map((rid) => ({
          gymId,
          reservationId: rid,
          action: "CANCELLED_BY_STAFF" as const,
          actorUserId,
        })),
      });
    }
    return created.id;
  });

  return { ok: true, refundId };
}
