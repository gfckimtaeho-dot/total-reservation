"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";

// 신규 고객 등록 + 서비스(권) 발급 + 예약 추가. 트레이너가 직접 처리
// (사장은 운영 바빠 거의 안 함). 발급 = Sale 1건 + Package/Membership 인스턴스
// 동시 생성(매출 단일 소스). PT권 차감은 "수업 완료" 시점(reservation-actions).

type R = { ok: true; data?: unknown } | { ok: false; error: string };

function rev(slug: string) {
  revalidatePath(`/ko/g/${slug}/dashboard`);
  revalidatePath(`/en/g/${slug}/dashboard`);
}

export async function registerCustomer(input: {
  slug: string;
  name: string;
  phone?: string;
}): Promise<R> {
  const auth = await requireGymStaff(input.slug);
  const gymId = auth.business!.id;
  const name = input.name.trim();
  if (!name) return { ok: false, error: "이름을 입력해 주세요" };
  const phone = input.phone?.trim() || null;
  const user = await prisma.user.create({
    data: {
      gymId,
      name,
      phone,
      role: "CUSTOMER",
      status: "ACTIVE",
    },
    select: { id: true, name: true },
  });
  rev(input.slug);
  return { ok: true, data: user };
}

export async function searchCustomers(input: {
  slug: string;
  q: string;
}): Promise<R> {
  const auth = await requireGymStaff(input.slug);
  const gymId = auth.business!.id;
  const q = input.q.trim();
  const rows = await prisma.user.findMany({
    where: {
      gymId,
      role: "CUSTOMER",
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
            ],
          }
        : {}),
    },
    select: { id: true, name: true, phone: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return { ok: true, data: rows };
}

// 서비스 발급 — PackagePlan(횟수권) 또는 MembershipPlan(기간권).
// Sale 스냅샷 + 인스턴스 생성. 가격/payout 은 plan·service 에서 박제.
export async function issueService(input: {
  slug: string;
  customerUserId: string;
  kind: "PACKAGE" | "MEMBERSHIP" | "COMBO";
  planId: string;
}): Promise<R> {
  const auth = await requireGymStaff(input.slug);
  const gymId = auth.business!.id;

  const cust = await prisma.user.findFirst({
    where: { id: input.customerUserId, gymId, role: "CUSTOMER" },
    select: { id: true },
  });
  if (!cust) return { ok: false, error: "고객을 찾을 수 없습니다" };

  if (input.kind === "PACKAGE") {
    const plan = await prisma.packagePlan.findFirst({
      where: { id: input.planId, gymId },
      include: { service: { select: { payoutPhp: true } } },
    });
    if (!plan) return { ok: false, error: "횟수권 상품을 찾을 수 없습니다" };
    const perPayout = plan.service.payoutPhp;
    const sale = await prisma.$transaction(async (tx) => {
      const s = await tx.sale.create({
        data: {
          gymId,
          userId: cust.id,
          saleType: "PACKAGE",
          sourcePlanId: plan.id,
          listPricePhp: plan.pricePhp,
          promotionDiscountPhp: 0,
          totalPaidPhp: plan.pricePhp,
          payoutLiabilityPhp: perPayout * plan.sessionCount,
          ownerRevenuePhp: plan.pricePhp - perPayout * plan.sessionCount,
          soldById: auth.id,
        },
        select: { id: true },
      });
      await tx.package.create({
        data: {
          gymId,
          userId: cust.id,
          serviceId: plan.serviceId,
          totalCount: plan.sessionCount,
          remainingCount: plan.sessionCount,
          pricePhp: plan.pricePhp,
          payoutPhp: perPayout,
          planId: plan.id,
          saleId: s.id,
        },
      });
      return s;
    });
    rev(input.slug);
    return { ok: true, data: { saleId: sale.id } };
  }

  if (input.kind === "COMBO") {
    const combo = await prisma.comboPlan.findFirst({
      where: { id: input.planId, gymId },
      include: {
        membershipPlan: true,
        packageItems: {
          include: {
            packagePlan: {
              include: { service: { select: { payoutPhp: true } } },
            },
          },
        },
      },
    });
    if (!combo) return { ok: false, error: "콤보 상품을 찾을 수 없습니다" };
    const items = combo.packageItems.map((it) => it.packagePlan);
    const listPrice =
      (combo.membershipPlan?.pricePhp ?? 0) +
      items.reduce((s, p) => s + p.pricePhp, 0);
    const payoutLiab = items.reduce(
      (s, p) => s + p.service.payoutPhp * p.sessionCount,
      0,
    );
    const now = new Date();
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    await prisma.$transaction(async (tx) => {
      const s = await tx.sale.create({
        data: {
          gymId,
          userId: cust.id,
          saleType: "COMBO",
          sourcePlanId: combo.id,
          listPricePhp: listPrice,
          promotionDiscountPhp: 0,
          totalPaidPhp: combo.pricePhp,
          payoutLiabilityPhp: payoutLiab,
          ownerRevenuePhp: combo.pricePhp - payoutLiab,
          soldById: auth.id,
        },
        select: { id: true },
      });
      if (combo.membershipPlan) {
        await tx.membership.create({
          data: {
            gymId,
            userId: cust.id,
            startDate: start,
            endDate: new Date(
              start.getTime() +
                combo.membershipPlan.durationDays * 86400000,
            ),
            pricePhp: combo.membershipPlan.pricePhp,
            planId: combo.membershipPlan.id,
            saleId: s.id,
          },
        });
      }
      for (const pp of items) {
        await tx.package.create({
          data: {
            gymId,
            userId: cust.id,
            serviceId: pp.serviceId,
            totalCount: pp.sessionCount,
            remainingCount: pp.sessionCount,
            pricePhp: pp.pricePhp,
            payoutPhp: pp.service.payoutPhp,
            planId: pp.id,
            saleId: s.id,
          },
        });
      }
    });
    rev(input.slug);
    return { ok: true };
  }

  const plan = await prisma.membershipPlan.findFirst({
    where: { id: input.planId, gymId },
  });
  if (!plan) return { ok: false, error: "회원권 상품을 찾을 수 없습니다" };
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const end = new Date(start.getTime() + plan.durationDays * 86400000);
  await prisma.$transaction(async (tx) => {
    const s = await tx.sale.create({
      data: {
        gymId,
        userId: cust.id,
        saleType: "MEMBERSHIP",
        sourcePlanId: plan.id,
        listPricePhp: plan.pricePhp,
        promotionDiscountPhp: 0,
        totalPaidPhp: plan.pricePhp,
        payoutLiabilityPhp: 0,
        ownerRevenuePhp: plan.pricePhp,
        soldById: auth.id,
      },
      select: { id: true },
    });
    await tx.membership.create({
      data: {
        gymId,
        userId: cust.id,
        startDate: start,
        endDate: end,
        pricePhp: plan.pricePhp,
        planId: plan.id,
        saleId: s.id,
      },
    });
  });
  rev(input.slug);
  return { ok: true };
}

// 예약 추가 — FIFO 로 잔여>0 인 그 서비스 권을 골라 연결. 권 없으면 차단.
export async function addReservation(input: {
  slug: string;
  customerUserId: string;
  year: number;
  month: number;
  day: number;
  startMin: number;
}): Promise<R> {
  const auth = await requireGymStaff(input.slug);
  const gymId = auth.business!.id;
  const staff = await prisma.staff.findFirst({
    where: { userId: auth.id, gymId },
    select: { id: true },
  });
  if (!staff) return { ok: false, error: "트레이너 정보를 찾을 수 없습니다" };

  // FIFO: 먼저 산, 잔여>0 인 권(서비스 무관 가장 오래된 것) → 그 권의 서비스로.
  const pkg = await prisma.package.findFirst({
    where: {
      gymId,
      userId: input.customerUserId,
      remainingCount: { gt: 0 },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, serviceId: true },
  });
  if (!pkg) {
    return {
      ok: false,
      error: "잔여 횟수권이 없습니다. 먼저 권을 발급해 주세요.",
    };
  }
  const service = await prisma.service.findFirst({
    where: { id: pkg.serviceId, gymId },
    select: { durationMin: true },
  });
  if (!service) return { ok: false, error: "서비스를 찾을 수 없습니다" };
  const serviceId = pkg.serviceId;

  const startAt = new Date(
    Date.UTC(
      input.year,
      input.month - 1,
      input.day,
      Math.floor(input.startMin / 60),
      input.startMin % 60,
      0,
    ),
  );
  if (startAt.getTime() < Date.now()) {
    return { ok: false, error: "지난 시간에는 예약할 수 없습니다" };
  }
  const endAt = new Date(startAt.getTime() + service.durationMin * 60000);

  const clash = await prisma.reservation.findFirst({
    where: {
      gymId,
      staffId: staff.id,
      status: { notIn: ["CANCELLED", "REJECTED"] },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    select: { id: true },
  });
  if (clash) return { ok: false, error: "그 시간에 이미 예약이 있습니다" };

  await prisma.reservation.create({
    data: {
      gymId,
      serviceId,
      staffId: staff.id,
      customerUserId: input.customerUserId,
      startAt,
      endAt,
      status: "CONFIRMED",
      packageId: pkg.id,
    },
  });
  rev(input.slug);
  return { ok: true };
}
