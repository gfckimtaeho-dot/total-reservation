import { prisma } from "@/lib/db/client";

// 고객 대면 상품 소개(showcase) 데이터 로더.
// /products(사장용)와 동일한 카탈로그를 읽지만, 고객에게 보일 정보만 추려
// 가공한다. 사장 마진·트레이너 payout 등 내부 수치는 절대 포함하지 않는다.
// 실 라우트(/g/[slug]/showcase)와 프리뷰가 공유.

export type ShowcaseMembership = {
  id: string;
  name: string;
  durationDays: number;
  pricePhp: number;
};

export type ShowcaseService = {
  id: string;
  name: string;
  durationMin: number;
  capacity: number;
  pricePhp: number;
};

export type ShowcasePackage = {
  id: string;
  name: string;
  serviceName: string;
  sessionCount: number;
  pricePhp: number;
  // 정가(서비스 1회가 × 회수). 할인 수업권이면 pricePhp < listPhp.
  listPhp: number;
};

export type ShowcaseCombo = {
  id: string;
  name: string;
  membershipName: string | null;
  packageNames: string[];
  pricePhp: number;
  // 콤보에 묶인 항목들의 정상가 합.
  listPhp: number;
};

export type ShowcasePromotion = {
  id: string;
  name: string;
  scope: string;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  startsAt: Date;
  endsAt: Date;
};

export type ShowcaseData = {
  gymName: string;
  memberships: ShowcaseMembership[];
  services: ShowcaseService[];
  packages: ShowcasePackage[];
  combos: ShowcaseCombo[];
  promotions: ShowcasePromotion[];
};

export async function loadShowcaseDataBySlug(
  slug: string,
): Promise<ShowcaseData | null> {
  const business = await prisma.business.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!business) return null;
  return loadShowcaseData(business.id, business.name);
}

export async function loadShowcaseData(
  gymId: string,
  gymName: string,
): Promise<ShowcaseData> {
  const [membershipPlans, services, packagePlans, comboPlans, promotions] =
    await Promise.all([
      prisma.membershipPlan.findMany({
        where: { gymId, active: true },
        orderBy: { pricePhp: "asc" },
      }),
      prisma.service.findMany({
        where: { gymId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.packagePlan.findMany({
        where: { gymId, active: true },
        orderBy: { createdAt: "asc" },
        include: { service: true },
      }),
      prisma.comboPlan.findMany({
        where: { gymId, active: true },
        orderBy: { createdAt: "asc" },
        include: {
          membershipPlan: true,
          packageItems: {
            include: { packagePlan: { include: { service: true } } },
          },
        },
      }),
      prisma.promotion.findMany({
        where: { gymId, active: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

  // 1:1(capacity=1) 서비스/수업권을 단체(capacity>1)보다 먼저 표시.
  // 수업권은 같은 서비스끼리 묶이고, 그 안에서 횟수 낮은 것부터 (PT 5→10→20).
  services.sort((a, b) => a.capacity - b.capacity);
  packagePlans.sort((a, b) => {
    if (a.service.capacity !== b.service.capacity) {
      return a.service.capacity - b.service.capacity;
    }
    if (a.service.name !== b.service.name) {
      return a.service.name.localeCompare(b.service.name);
    }
    return a.sessionCount - b.sessionCount;
  });

  return {
    gymName,
    memberships: membershipPlans.map((m) => ({
      id: m.id,
      name: m.name,
      durationDays: m.durationDays,
      pricePhp: m.pricePhp,
    })),
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      durationMin: s.durationMin,
      capacity: s.capacity,
      pricePhp: s.pricePhp,
    })),
    packages: packagePlans.map((p) => ({
      id: p.id,
      name: p.name,
      serviceName: p.service.name,
      sessionCount: p.sessionCount,
      pricePhp: p.pricePhp,
      listPhp: p.service.pricePhp * p.sessionCount,
    })),
    combos: comboPlans.map((c) => {
      const pkgListSum = c.packageItems.reduce(
        (sum, it) =>
          sum +
          it.packagePlan.service.pricePhp * it.packagePlan.sessionCount,
        0,
      );
      const membershipList = c.membershipPlan?.pricePhp ?? 0;
      return {
        id: c.id,
        name: c.name,
        membershipName: c.membershipPlan?.name ?? null,
        packageNames: c.packageItems.map((it) => it.packagePlan.name),
        pricePhp: c.pricePhp,
        listPhp: membershipList + pkgListSum,
      };
    }),
    promotions: promotions.map((p) => ({
      id: p.id,
      name: p.name,
      scope: p.scope,
      discountType: p.discountType,
      discountValue: p.discountValue,
      startsAt: p.startsAt,
      endsAt: p.endsAt,
    })),
  };
}
