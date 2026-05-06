import { requireGymStaff } from "@/lib/auth/dal";
import { getTheme } from "@/lib/theme";
import { DashboardNormal } from "./DashboardNormal";
import { DashboardBlack } from "./DashboardBlack";
import { DashboardWhite } from "./DashboardWhite";

export default async function GymDashboardPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const user = await requireGymStaff(slug);
  const business = user.business!;
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
