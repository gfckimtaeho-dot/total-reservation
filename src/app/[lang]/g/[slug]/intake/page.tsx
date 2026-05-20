import { redirect } from "next/navigation";
import { requireGymStaff } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { IntakeFlow } from "./IntakeFlow";

// 발급은 두 경로로 진입한다.
//   - 트레이너: 본인 dashboard 헤더 "발급" 버튼 → /intake 풀스크린 (이 페이지)
//   - 사장: 회원관리 → 회원 row 클릭 → 회원 상세에 임베드된 발급 섹션
// 사장이 /intake 를 직접 URL 로 들어오면 회원관리로 보낸다 (회원 먼저 고르는
// 흐름이 일관성).
export default async function IntakePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; slug: string }>;
  searchParams: Promise<{ customer?: string }>;
}) {
  const { lang, slug } = await params;
  const sp = await searchParams;
  const auth = await requireGymStaff(slug);
  const gymId = auth.business!.id;

  if (auth.role !== "TRAINER") {
    redirect(`/${lang}/g/${slug}/members`);
  }

  const [memberships, packages, combos, preset] = await Promise.all([
    prisma.membershipPlan.findMany({
      where: { gymId, active: true },
      select: { id: true, name: true, pricePhp: true, durationDays: true },
      orderBy: { pricePhp: "asc" },
    }),
    prisma.packagePlan.findMany({
      where: { gymId, active: true },
      select: {
        id: true,
        name: true,
        pricePhp: true,
        sessionCount: true,
        service: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.comboPlan.findMany({
      where: { gymId, active: true },
      select: {
        id: true,
        name: true,
        pricePhp: true,
        membershipPlan: { select: { name: true } },
        packageItems: {
          select: { packagePlan: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    sp.customer
      ? prisma.user.findFirst({
          where: { id: sp.customer, gymId, role: "CUSTOMER" },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
  ]);

  const now = new Date();
  const promotions = await prisma.promotion.findMany({
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

  return (
    <IntakeFlow
      slug={slug}
      lang={lang}
      preset={preset}
      memberships={memberships}
      packages={packages.map((p) => ({
        id: p.id,
        name: p.name,
        pricePhp: p.pricePhp,
        sessionCount: p.sessionCount,
        serviceName: p.service.name,
      }))}
      combos={combos.map((c) => ({
        id: c.id,
        name: c.name,
        pricePhp: c.pricePhp,
        parts: [
          ...(c.membershipPlan ? [c.membershipPlan.name] : []),
          ...c.packageItems.map((it) => it.packagePlan.name),
        ],
      }))}
      promotions={promotions}
    />
  );
}
