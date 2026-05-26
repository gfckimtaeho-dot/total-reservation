"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { pickBestPromo } from "@/lib/catalog/promo";
import { pickBookablePackage } from "@/lib/packages/availability";

// 신규 고객 등록 + 서비스(권) 발급 + 예약 추가. 트레이너가 직접 처리
// (사장은 운영 바빠 거의 안 함). 발급 = Sale 1건 + Package/Membership 인스턴스
// 동시 생성(매출 단일 소스). PT권 차감은 "수업 완료" 시점(reservation-actions).

type R = { ok: true; data?: unknown } | { ok: false; error: string };

function rev(slug: string, customerUserId?: string) {
  revalidatePath(`/ko/g/${slug}/dashboard`);
  revalidatePath(`/en/g/${slug}/dashboard`);
  revalidatePath(`/ko/g/${slug}/members`);
  revalidatePath(`/en/g/${slug}/members`);
  if (customerUserId) {
    revalidatePath(`/ko/g/${slug}/members/${customerUserId}`);
    revalidatePath(`/en/g/${slug}/members/${customerUserId}`);
  }
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

// /intake 고객 선택용 — 검색 + 페이징.
// q 빈 문자열이면 최근 등록 순 전체 list, q 있으면 그 안에서 검색.
// 잔여>0 권의 서비스명을 합쳐 row 표시(트레이너가 한눈에 어떤 권 있는지).
// take=limit+1 로 다음 페이지 여부(hasMore) 판단(별도 count 쿼리 회피).
export async function listRecentCustomers(input: {
  slug: string;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<R> {
  const auth = await requireGymStaff(input.slug);
  const gymId = auth.business!.id;
  const q = (input.q ?? "").trim();
  const limit = Math.min(500, Math.max(1, input.limit ?? 10));
  const offset = Math.max(0, input.offset ?? 0);
  const where = {
    gymId,
    role: "CUSTOMER" as const,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q } },
          ],
        }
      : {}),
  };
  const rows = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      phone: true,
      packages: {
        where: { remainingCount: { gt: 0 } },
        select: {
          remainingCount: true,
          service: { select: { name: true, capacity: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    skip: offset,
  });
  const hasMore = rows.length > limit;
  const sliced = hasMore ? rows.slice(0, limit) : rows;
  const formatted = sliced.map((u) => ({
    id: u.id,
    name: u.name,
    phone: u.phone,
    services: dedupServices(u.packages),
  }));
  return { ok: true, data: { rows: formatted, hasMore } };
}

// /intake "내 담당 고객" — 본인이 담당 트레이너로 발급된 Package 의 user 들 distinct.
// 사장/매니저는 본인이 staff 행이 없을 수 있어 빈 결과 반환(섹션 자체는 숨김 처리).
export async function listMyAssignedCustomers(input: {
  slug: string;
  limit?: number;
  offset?: number;
}): Promise<R> {
  const auth = await requireGymStaff(input.slug);
  const gymId = auth.business!.id;
  const limit = Math.min(500, Math.max(1, input.limit ?? 10));
  const offset = Math.max(0, input.offset ?? 0);

  const staff = await prisma.staff.findFirst({
    where: { gymId, userId: auth.id },
    select: { id: true },
  });
  if (!staff) {
    return { ok: true, data: { rows: [], hasMore: false } };
  }

  const rows = await prisma.user.findMany({
    where: {
      gymId,
      role: "CUSTOMER",
      packages: {
        some: { assignedStaffId: staff.id, remainingCount: { gt: 0 } },
      },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      packages: {
        where: { assignedStaffId: staff.id, remainingCount: { gt: 0 } },
        select: {
          remainingCount: true,
          serviceId: true,
          service: { select: { name: true, capacity: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    skip: offset,
  });
  const hasMore = rows.length > limit;
  const sliced = hasMore ? rows.slice(0, limit) : rows;

  // 카드 메트릭 확장 — 같은 service 내 left/upcoming/done/remain. 본인 담당
  // 예약만(staffId=staff.id) 한 번에 fetch 후 customer+service 별 분류.
  const customerIds = sliced.map((u) => u.id);
  const reservations = customerIds.length
    ? await prisma.reservation.findMany({
        where: {
          gymId,
          customerUserId: { in: customerIds },
          staffId: staff.id,
          status: { in: ["CONFIRMED", "PENDING_PAYMENT", "COMPLETED"] },
        },
        select: {
          customerUserId: true,
          serviceId: true,
          status: true,
          startAt: true,
        },
      })
    : [];
  const now = new Date();
  // key = `${customerUserId}::${serviceId}`
  const upcomingMap = new Map<string, number>();
  const doneMap = new Map<string, number>();
  for (const r of reservations) {
    const k = `${r.customerUserId}::${r.serviceId}`;
    if (r.status === "COMPLETED") {
      doneMap.set(k, (doneMap.get(k) ?? 0) + 1);
    } else if (r.startAt > now) {
      upcomingMap.set(k, (upcomingMap.get(k) ?? 0) + 1);
    }
  }

  const formatted = sliced.map((u) => ({
    id: u.id,
    name: u.name,
    phone: u.phone,
    services: dedupServicesWithCounts(
      u.id,
      u.packages,
      upcomingMap,
      doneMap,
    ),
  }));
  return { ok: true, data: { rows: formatted, hasMore } };
}

// service 단위 메트릭 — left/upcoming/done/remain. /my-clients 카드 표시용.
// 같은 service 권 여러 장이면 left(=remainingCount) 합산.
function dedupServicesWithCounts(
  customerUserId: string,
  packages: {
    remainingCount: number;
    serviceId: string;
    service: { name: string; capacity: number };
  }[],
  upcomingMap: Map<string, number>,
  doneMap: Map<string, number>,
): {
  serviceId: string;
  name: string;
  isGroup: boolean;
  left: number;
  upcoming: number;
  done: number;
  remain: number;
  // intake 등 기존 호출자 호환 — left 와 동치(잔여 횟수).
  remaining: number;
}[] {
  const m = new Map<
    string,
    { serviceId: string; name: string; isGroup: boolean; left: number }
  >();
  for (const p of packages) {
    const cur = m.get(p.serviceId) ?? {
      serviceId: p.serviceId,
      name: p.service.name,
      isGroup: p.service.capacity > 1,
      left: 0,
    };
    cur.left += p.remainingCount;
    m.set(p.serviceId, cur);
  }
  return Array.from(m.values())
    .map((s) => {
      const k = `${customerUserId}::${s.serviceId}`;
      const upcoming = upcomingMap.get(k) ?? 0;
      const done = doneMap.get(k) ?? 0;
      const remain = Math.max(0, s.left - upcoming);
      return { ...s, upcoming, done, remain, remaining: s.left };
    })
    .sort((a, b) =>
      a.isGroup === b.isGroup
        ? a.name.localeCompare(b.name)
        : a.isGroup
          ? 1
          : -1,
    );
}

// (deprecated 후보) 같은 service 권 여러 장이면 잔여 합산해 한 줄로. capacity > 1 = 단체 flag.
function dedupServices(
  packages: {
    remainingCount: number;
    service: { name: string; capacity: number };
  }[],
): { name: string; isGroup: boolean; remaining: number }[] {
  const m = new Map<
    string,
    { name: string; isGroup: boolean; remaining: number }
  >();
  for (const p of packages) {
    const isGroup = p.service.capacity > 1;
    const key = `${isGroup ? "G" : "P"}::${p.service.name}`;
    const inc = p.remainingCount;
    const cur = m.get(key) ?? {
      name: p.service.name,
      isGroup,
      remaining: 0,
    };
    cur.remaining += inc;
    m.set(key, cur);
  }
  return Array.from(m.values()).sort((a, b) =>
    a.isGroup === b.isGroup
      ? a.name.localeCompare(b.name)
      : a.isGroup
        ? 1
        : -1,
  );
}

// 팝오버용 — 그 고객의 서비스별 메트릭. 같은 service 권 여러 장은 합산.
// 트레이너가 셀 클릭 시 "잔여/예약중/완료/실제 잡을 수 있는 잔여" 한눈에.
//
// left      = remainingCount 합 (완료 시 차감됨)
// upcoming  = 본인 담당 미래 예약 카운트
// done      = 완료 예약 카운트 (= totalCount−remainingCount 와 일치하나 명시 카운트)
// remain    = max(0, left − upcoming)
export async function customerRemaining(input: {
  slug: string;
  customerUserId: string;
}): Promise<R> {
  const auth = await requireGymStaff(input.slug);
  const gymId = auth.business!.id;

  const staff = await prisma.staff.findFirst({
    where: { gymId, userId: auth.id },
    select: { id: true },
  });

  const [pkgs, reservations] = await Promise.all([
    prisma.package.findMany({
      where: { gymId, userId: input.customerUserId },
      select: {
        totalCount: true,
        remainingCount: true,
        serviceId: true,
        service: { select: { name: true } },
      },
    }),
    prisma.reservation.findMany({
      where: {
        gymId,
        customerUserId: input.customerUserId,
        // 트레이너는 본인 담당 예약만 카운트. OWNER/MANAGER 는 staff 없을 수
        // 있어 staffId 필터 생략(전체 카운트).
        ...(staff ? { staffId: staff.id } : {}),
        status: { in: ["CONFIRMED", "PENDING_PAYMENT", "COMPLETED"] },
      },
      select: { serviceId: true, status: true, startAt: true },
    }),
  ]);

  const now = new Date();
  const upcomingByService = new Map<string, number>();
  const doneByService = new Map<string, number>();
  for (const r of reservations) {
    if (r.status === "COMPLETED") {
      doneByService.set(r.serviceId, (doneByService.get(r.serviceId) ?? 0) + 1);
    } else if (r.startAt > now) {
      upcomingByService.set(
        r.serviceId,
        (upcomingByService.get(r.serviceId) ?? 0) + 1,
      );
    }
  }

  const bySvc = new Map<
    string,
    { service: string; serviceId: string; total: number; remaining: number }
  >();
  for (const p of pkgs) {
    const name = p.service?.name ?? "-";
    const cur = bySvc.get(p.serviceId) ?? {
      service: name,
      serviceId: p.serviceId,
      total: 0,
      remaining: 0,
    };
    cur.total += p.totalCount;
    cur.remaining += p.remainingCount;
    bySvc.set(p.serviceId, cur);
  }
  const result = [...bySvc.values()].map((s) => {
    const upcoming = upcomingByService.get(s.serviceId) ?? 0;
    const done = doneByService.get(s.serviceId) ?? 0;
    const remain = Math.max(0, s.remaining - upcoming);
    return { ...s, upcoming, done, remain };
  });
  return { ok: true, data: result };
}

type IssueItem = {
  kind: "PACKAGE" | "MEMBERSHIP" | "COMBO";
  planId: string;
};

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// 회원권 시작일 = 이어붙이기 정책. 기존 활성(미만료) 회원권 중 가장 늦은
// 종료일이 미래면 그 날부터 새 기간을 연속 부착(남은 일자 보존 + 신규 기간).
// 모두 만료/없으면 오늘부터. 시간기반 이용권이라 plan 종류 무관 누적.
async function nextMembershipStart(
  tx: TxClient,
  gymId: string,
  userId: string,
): Promise<Date> {
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const latest = await tx.membership.findFirst({
    where: { gymId, userId, endDate: { gte: today } },
    orderBy: { endDate: "desc" },
    select: { endDate: true },
  });
  return latest && latest.endDate.getTime() > today.getTime()
    ? latest.endDate
    : today;
}

// 발급 시 자동적용할 프로모션 1건 선택. 기간(startsAt~endsAt) 안 + active +
// scope 가 이 라인(회원권/수업권·plan)에 해당하는 것 중 **할인액 최대 1건**.
// 중첩 없음. 할인은 owner 수익에서만 차감(트레이너 payout 불변 — 보호 룰).
// 콤보는 scope enum 에 없어 대상 아님(번들가 그대로).
async function pickPromotion(
  tx: TxClient,
  gymId: string,
  lineKind: "MEMBERSHIP" | "PACKAGE",
  planId: string,
  listPricePhp: number,
): Promise<{ id: string; discountPhp: number } | null> {
  const now = new Date();
  const promos = await tx.promotion.findMany({
    where: {
      gymId,
      active: true,
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
    select: {
      id: true,
      scope: true,
      targetId: true,
      discountType: true,
      discountValue: true,
    },
  });
  return pickBestPromo(promos, lineKind, planId, listPricePhp);
}

// 발급 단일 소스 — 한 트랜잭션 안에서 Sale 1행 + 인스턴스 생성.
// issueService(1건)·issueCart(N건) 가 공유한다. 가격/payout 산식이 여기
// 한 곳에만 있어 매출 스냅샷이 절대 갈라지지 않음([[feedback-money-audit-log]]).
// 잘못된 plan 이면 throw → 호출부 트랜잭션 전체 롤백.
// 신규 Package 의 담당 트레이너 결정 — Phase 1 정책: 발급 자체로는 담당 X.
// 같은 고객+같은 서비스에 이미 담당이 잡힌 기존 권이 있으면 그 트레이너를
// 인계받아 일관성 유지. 없으면 null 로 시작해, 첫 예약 시점에 addReservation
// 이 자동 매핑한다(서비스 단위 1명 담당이라는 사용자 정책의 구현 근거).
async function inheritAssignedStaff(
  tx: TxClient,
  gymId: string,
  customerId: string,
  serviceId: string,
): Promise<string | null> {
  const existing = await tx.package.findFirst({
    where: {
      gymId,
      userId: customerId,
      serviceId,
      assignedStaffId: { not: null },
    },
    orderBy: { createdAt: "asc" },
    select: { assignedStaffId: true },
  });
  return existing?.assignedStaffId ?? null;
}

async function createSaleLine(
  tx: TxClient,
  ctx: {
    gymId: string;
    customerId: string;
    soldById: string;
  },
  item: IssueItem,
): Promise<void> {
  const { gymId, customerId, soldById } = ctx;

  if (item.kind === "PACKAGE") {
    const plan = await tx.packagePlan.findFirst({
      where: { id: item.planId, gymId },
      include: { service: { select: { payoutPhp: true } } },
    });
    if (!plan) throw new Error("수업 상품을 찾을 수 없습니다");
    const perPayout = plan.service.payoutPhp;
    const payoutLiab = perPayout * plan.sessionCount;
    const promo = await pickPromotion(
      tx,
      gymId,
      "PACKAGE",
      plan.id,
      plan.pricePhp,
    );
    const discount = promo?.discountPhp ?? 0;
    const totalPaid = plan.pricePhp - discount;
    const s = await tx.sale.create({
      data: {
        gymId,
        userId: customerId,
        saleType: "PACKAGE",
        sourcePlanId: plan.id,
        listPricePhp: plan.pricePhp,
        promotionId: promo?.id,
        promotionDiscountPhp: discount,
        totalPaidPhp: totalPaid,
        // 할인은 owner 수익에서만 차감 — 트레이너 payout 불변(보호 룰).
        payoutLiabilityPhp: payoutLiab,
        ownerRevenuePhp: totalPaid - payoutLiab,
        soldById,
      },
      select: { id: true },
    });
    const inheritedStaffId = await inheritAssignedStaff(
      tx,
      gymId,
      customerId,
      plan.serviceId,
    );
    await tx.package.create({
      data: {
        gymId,
        userId: customerId,
        serviceId: plan.serviceId,
        totalCount: plan.sessionCount,
        remainingCount: plan.sessionCount,
        pricePhp: plan.pricePhp,
        payoutPhp: perPayout,
        planId: plan.id,
        saleId: s.id,
        assignedStaffId: inheritedStaffId,
      },
    });
    return;
  }

  if (item.kind === "COMBO") {
    const combo = await tx.comboPlan.findFirst({
      where: { id: item.planId, gymId },
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
    if (!combo) throw new Error("콤보 상품을 찾을 수 없습니다");
    const items = combo.packageItems.map((it) => it.packagePlan);
    const listPrice =
      (combo.membershipPlan?.pricePhp ?? 0) +
      items.reduce((sum, p) => sum + p.pricePhp, 0);
    const payoutLiab = items.reduce(
      (sum, p) => sum + p.service.payoutPhp * p.sessionCount,
      0,
    );
    const s = await tx.sale.create({
      data: {
        gymId,
        userId: customerId,
        saleType: "COMBO",
        sourcePlanId: combo.id,
        listPricePhp: listPrice,
        promotionDiscountPhp: 0,
        totalPaidPhp: combo.pricePhp,
        payoutLiabilityPhp: payoutLiab,
        ownerRevenuePhp: combo.pricePhp - payoutLiab,
        soldById,
      },
      select: { id: true },
    });
    if (combo.membershipPlan) {
      const mStart = await nextMembershipStart(tx, gymId, customerId);
      await tx.membership.create({
        data: {
          gymId,
          userId: customerId,
          startDate: mStart,
          endDate: new Date(
            mStart.getTime() + combo.membershipPlan.durationDays * 86400000,
          ),
          pricePhp: combo.membershipPlan.pricePhp,
          planId: combo.membershipPlan.id,
          saleId: s.id,
        },
      });
    }
    for (const pp of items) {
      const inheritedStaffId = await inheritAssignedStaff(
        tx,
        gymId,
        customerId,
        pp.serviceId,
      );
      await tx.package.create({
        data: {
          gymId,
          userId: customerId,
          serviceId: pp.serviceId,
          totalCount: pp.sessionCount,
          remainingCount: pp.sessionCount,
          pricePhp: pp.pricePhp,
          payoutPhp: pp.service.payoutPhp,
          planId: pp.id,
          saleId: s.id,
          assignedStaffId: inheritedStaffId,
        },
      });
    }
    return;
  }

  // MEMBERSHIP
  const plan = await tx.membershipPlan.findFirst({
    where: { id: item.planId, gymId },
  });
  if (!plan) throw new Error("회원권 상품을 찾을 수 없습니다");
  // 이어붙이기: 기존 활성 회원권 잔여기간 뒤에 신규 기간 부착.
  const start = await nextMembershipStart(tx, gymId, customerId);
  const end = new Date(start.getTime() + plan.durationDays * 86400000);
  const promo = await pickPromotion(
    tx,
    gymId,
    "MEMBERSHIP",
    plan.id,
    plan.pricePhp,
  );
  const discount = promo?.discountPhp ?? 0;
  const totalPaid = plan.pricePhp - discount;
  const s = await tx.sale.create({
    data: {
      gymId,
      userId: customerId,
      saleType: "MEMBERSHIP",
      sourcePlanId: plan.id,
      listPricePhp: plan.pricePhp,
      promotionId: promo?.id,
      promotionDiscountPhp: discount,
      totalPaidPhp: totalPaid,
      payoutLiabilityPhp: 0,
      // 회원권 payout 0 → owner 수익 = 실수령액(할인 반영).
      ownerRevenuePhp: totalPaid,
      soldById,
    },
    select: { id: true },
  });
  await tx.membership.create({
    data: {
      gymId,
      userId: customerId,
      startDate: start,
      endDate: end,
      pricePhp: plan.pricePhp,
      planId: plan.id,
      saleId: s.id,
    },
  });
}

// 단건 발급 — PackagePlan(수업권)/MembershipPlan(기간권)/ComboPlan(콤보).
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

  try {
    await prisma.$transaction(async (tx) => {
      await createSaleLine(
        tx,
        { gymId, customerId: cust.id, soldById: auth.id },
        { kind: input.kind, planId: input.planId },
      );
      // 사장이 매장에서 직접 발급 = 정식 회원. magic link 첫 로그인 대기(PENDING)
      // 단계를 건너뛰어 사장 워크플로우에서 "활성화 클릭" 잉여 제거.
      await tx.user.updateMany({
        where: { id: cust.id, status: "PENDING" },
        data: { status: "ACTIVE" },
      });
      // 휴면/차단(active=false) 회원에게 다시 발급 = 운영 재개 의사 표시.
      // 빌런 차단 의도를 유지하려면 애초에 발급 자체를 하지 말 것.
      await tx.user.updateMany({
        where: { id: cust.id, active: false },
        data: { active: true },
      });
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message || "발급 실패" };
  }
  rev(input.slug, cust.id);
  return { ok: true };
}

// 장바구니 발급 — 회원권/수업권/콤보를 즉석으로 여러 건 담아 한 번에.
// 라인마다 독립 Sale 1행(saleType 별)으로 한 트랜잭션 동시 생성 →
// 항목별 plan·payout 스냅샷 보존(환불·만료·정산 추적 단위). 하나라도
// 실패하면 전체 롤백(부분 발급 금지).
export async function issueCart(input: {
  slug: string;
  customerUserId: string;
  items: IssueItem[];
}): Promise<R> {
  const auth = await requireGymStaff(input.slug);
  const gymId = auth.business!.id;

  if (!input.items.length)
    return { ok: false, error: "담긴 상품이 없습니다" };

  const cust = await prisma.user.findFirst({
    where: { id: input.customerUserId, gymId, role: "CUSTOMER" },
    select: { id: true },
  });
  if (!cust) return { ok: false, error: "고객을 찾을 수 없습니다" };

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of input.items) {
        await createSaleLine(
          tx,
          { gymId, customerId: cust.id, soldById: auth.id },
          item,
        );
      }
      // 사장이 매장에서 직접 발급 = 정식 회원. magic link 첫 로그인 대기(PENDING)
      // 단계를 건너뛰어 사장 워크플로우에서 "활성화 클릭" 잉여 제거.
      await tx.user.updateMany({
        where: { id: cust.id, status: "PENDING" },
        data: { status: "ACTIVE" },
      });
      // 휴면/차단(active=false) 회원에게 다시 발급 = 운영 재개 의사 표시.
      // 빌런 차단 의도를 유지하려면 애초에 발급 자체를 하지 말 것.
      await tx.user.updateMany({
        where: { id: cust.id, active: false },
        data: { active: true },
      });
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message || "발급 실패" };
  }
  rev(input.slug, cust.id);
  return { ok: true, data: { count: input.items.length } };
}

// 빈 슬롯 등록용 — 그 고객이 보유한 1:1 서비스(capacity 1) 권의 디테일.
// total = 발급된 총 회수, done = 완료 예약, upcoming = 미래 예약,
// free = total - done - upcoming = 아직 예약 안 잡은 자유 슬롯.
// free>0 인 서비스만 반환(예약 잡을 자리 있는 것).
export async function listBookableServices(input: {
  slug: string;
  customerUserId: string;
}): Promise<R> {
  const auth = await requireGymStaff(input.slug);
  const gymId = auth.business!.id;
  const pkgs = await prisma.package.findMany({
    where: {
      gymId,
      userId: input.customerUserId,
      service: { capacity: 1 },
      refundedAt: null,
    },
    select: {
      id: true,
      serviceId: true,
      totalCount: true,
      service: { select: { name: true } },
    },
  });
  if (pkgs.length === 0) {
    return { ok: true, data: [] };
  }

  const pkgIds = pkgs.map((p) => p.id);
  const rcounts = await prisma.reservation.groupBy({
    by: ["packageId", "status"],
    where: { packageId: { in: pkgIds } },
    _count: true,
  });
  const byPkg = new Map<string, { done: number; upcoming: number }>();
  for (const r of rcounts) {
    if (r.packageId == null) continue;
    const cur = byPkg.get(r.packageId) ?? { done: 0, upcoming: 0 };
    if (r.status === "COMPLETED") cur.done += r._count;
    else if (r.status === "PENDING_PAYMENT" || r.status === "CONFIRMED")
      cur.upcoming += r._count;
    byPkg.set(r.packageId, cur);
  }

  type Agg = {
    serviceId: string;
    name: string;
    total: number;
    done: number;
    upcoming: number;
    free: number;
  };
  const m = new Map<string, Agg>();
  for (const p of pkgs) {
    const cur = m.get(p.serviceId) ?? {
      serviceId: p.serviceId,
      name: p.service?.name ?? "-",
      total: 0,
      done: 0,
      upcoming: 0,
      free: 0,
    };
    cur.total += p.totalCount;
    const rc = byPkg.get(p.id) ?? { done: 0, upcoming: 0 };
    cur.done += rc.done;
    cur.upcoming += rc.upcoming;
    m.set(p.serviceId, cur);
  }
  for (const v of m.values()) {
    v.free = v.total - v.done - v.upcoming;
  }

  return {
    ok: true,
    data: [...m.values()]
      .filter((v) => v.free > 0)
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// 예약 추가 — 트레이너가 고른 서비스의 잔여 권을 FIFO 로 골라 연결.
export async function addReservation(input: {
  slug: string;
  customerUserId: string;
  serviceId: string;
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

  const service = await prisma.service.findFirst({
    where: { id: input.serviceId, gymId, active: true },
    select: { durationMin: true, deductCount: true, capacity: true },
  });
  if (!service) return { ok: false, error: "프로그램을 찾을 수 없습니다" };

  // 고른 서비스의 잔여 권 — 같은 서비스 권이 여럿이면 가장 오래된 것부터.
  // 잔여는 있으나 미완료 예약으로 모두 선점된 권은 건너뛴다(초과 예약 차단).
  const pkg = await pickBookablePackage(
    gymId,
    input.customerUserId,
    input.serviceId,
    service.deductCount,
  );
  if (!pkg) {
    return { ok: false, error: "이 프로그램으로 더 예약할 잔여 횟수가 없습니다" };
  }

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

  await prisma.$transaction(async (tx) => {
    const r = await tx.reservation.create({
      data: {
        gymId,
        serviceId: input.serviceId,
        staffId: staff.id,
        customerUserId: input.customerUserId,
        startAt,
        endAt,
        status: "CONFIRMED",
        packageId: pkg.id,
      },
      select: { id: true },
    });
    // 트레이너가 건 예약도 고객 셀프·단체 등록과 동일하게 ReservationLog
    // CREATED 를 남긴다 — 감사 일관성(이게 빠져 액션 로그가 비어 있었음).
    await tx.reservationLog.create({
      data: {
        gymId,
        reservationId: r.id,
        action: "CREATED",
        actorUserId: auth.id,
      },
    });
    // Phase 1 자동 담당 매핑 — 서비스 단위로 처음 등록된 트레이너 = 담당.
    // 1:1(capacity=1) 권에서만, 같은 고객+서비스의 모든 권이 미지정(null)일
    // 때에 한해 일괄 set. 기존에 다른 트레이너가 담당이면 손대지 않는다
    // (인계는 /me/holdings 의 명시적 트레이너 변경 흐름으로만).
    if (service.capacity === 1) {
      await tx.package.updateMany({
        where: {
          gymId,
          userId: input.customerUserId,
          serviceId: input.serviceId,
          assignedStaffId: null,
        },
        data: { assignedStaffId: staff.id },
      });
    }
  });
  rev(input.slug);
  return { ok: true };
}
