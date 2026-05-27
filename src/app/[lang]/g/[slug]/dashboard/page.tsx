import { requireGymStaff } from "@/lib/auth/dal";
import { ensureAccessToken } from "@/lib/auth/accessToken";
import { prisma } from "@/lib/db/client";
import { ActiveSessionGuard } from "@/components/ActiveSessionGuard";
import { DashboardWhite } from "./DashboardWhite";
import { DashboardTrainer } from "./DashboardTrainer";

export default async function GymDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; slug: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  const { lang, slug } = await params;
  const sp = await searchParams;
  const user = await requireGymStaff(slug);
  const business = user.business!;

  // 트레이너는 단일 다크 테마 + 본인 시점 화면. 사장/매니저는 White Pastel 단일.
  if (user.role === "TRAINER") {
    const accessToken = await ensureAccessToken(user.id);
    const dayParam = parseInt(sp.day ?? "", 10);
    const selectedDay = Number.isFinite(dayParam) ? dayParam : 0;
    const staff = await prisma.staff.findFirst({
      where: { userId: user.id, gymId: business.id },
      select: { id: true, weeklyOffDays: true },
    });
    return (
      <>
        <ActiveSessionGuard
          pingUrl="/api/auth/ping-active"
          logoutUrl={`/${lang}/g/${slug}/login`}
        />
        <DashboardTrainer
          lang={lang}
          slug={slug}
          gymId={business.id}
          userId={user.id}
          staffId={staff?.id ?? null}
          businessName={business.name}
          trainerName={user.name}
          accessToken={accessToken}
          timeZone={business.timeZone}
          selectedDay={selectedDay}
          weeklyOffDays={staff?.weeklyOffDays ?? []}
        />
      </>
    );
  }

  return (
    <>
      <ActiveSessionGuard
        pingUrl="/api/auth/ping-active"
        logoutUrl={`/${lang}/g/${slug}/login`}
      />
      <DashboardWhite
        lang={lang}
        slug={slug}
        gymId={business.id}
        businessName={business.name}
        timeZone={business.timeZone}
      />
    </>
  );
}
