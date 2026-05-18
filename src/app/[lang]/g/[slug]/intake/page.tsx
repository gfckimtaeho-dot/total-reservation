import { requireGymStaff } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { IntakeFlow } from "./IntakeFlow";

// 고객 등록 + 서비스 발급 전용 화면 (사장/트레이너 공용 진입).
// 고객 등록은 사장님과 동일한 createMember(이메일+활성화 메일) 재사용.
// 발급은 회원권/횟수권/콤보 전체 카탈로그 → Sale + 인스턴스.
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
    />
  );
}
