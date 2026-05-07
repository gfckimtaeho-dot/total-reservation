import { requireGymStaff } from "@/lib/auth/dal";
import { getTheme } from "@/lib/theme";
import { ensureAccessToken } from "@/lib/auth/accessToken";
import { prisma } from "@/lib/db/client";
import { DashboardNormal } from "./DashboardNormal";
import { DashboardBlack } from "./DashboardBlack";
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

  // 트레이너는 단일 다크 테마 + 본인 시점 화면. 사장/매니저는 기존 테마 선택권.
  if (user.role === "TRAINER") {
    const accessToken = await ensureAccessToken(user.id);
    const dayParam = parseInt(sp.day ?? "", 10);
    const selectedDay = Number.isFinite(dayParam) ? dayParam : 0;
    const staff = await prisma.staff.findFirst({
      where: { userId: user.id, gymId: business.id },
      select: { weeklyOffDays: true },
    });
    return (
      <DashboardTrainer
        lang={lang}
        slug={slug}
        businessName={business.name}
        trainerName={user.name}
        accessToken={accessToken}
        selectedDay={selectedDay}
        weeklyOffDays={staff?.weeklyOffDays ?? []}
      />
    );
  }

  const theme = await getTheme();
  const props = {
    lang,
    slug,
    businessName: business.name,
  };

  if (theme === "black") return <DashboardBlack {...props} />;
  if (theme === "white") return <DashboardWhite {...props} />;
  return <DashboardNormal {...props} />;
}
