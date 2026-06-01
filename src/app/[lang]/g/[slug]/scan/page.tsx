import { requireGymStaff } from "@/lib/auth/dal";
import { AccessScanner } from "./AccessScanner";

// 매장 출입 스캐너 단말(키오스크) 화면. 매장 신뢰 단말 가정이라 staff 세션으로
// 게이트하고(아무나 토큰 probe 못 하게), 실제 검증은 공개 endpoint
// POST /api/access/verify 가 담당. V1 은 게스트(Stay.id) 경로만 처리.
export default async function GymScanPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const user = await requireGymStaff(slug);
  const business = user.business!;

  return (
    <AccessScanner
      slug={slug}
      gymName={business.name}
      dashboardHref={`/${lang}/g/${slug}/dashboard`}
    />
  );
}
