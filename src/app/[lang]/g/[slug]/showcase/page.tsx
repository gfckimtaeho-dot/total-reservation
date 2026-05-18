import { requireGymStaff } from "@/lib/auth/dal";
import { loadShowcaseData } from "@/lib/catalog/showcaseData";
import { Showcase } from "@/components/showcase/Showcase";

// 고객 대면 상품 소개 — 트레이너가 태블릿으로 보여주는 풀스크린 발표 모드.
// 앱 chrome 0 (사이드바·네비 없음). 회원권~이벤트 가로 5패널 스와이프.
// concept: 디자인 컨셉 확정 후 이 한 줄만 교체 (Showcase 컴포넌트 prop).
// 프리뷰 비교: /[lang]/preview/showcase (Dark/Light 토글).
const CONCEPT = "dark" as const;

export default async function GymShowcasePage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const auth = await requireGymStaff(slug);
  const business = auth.business!;
  const data = await loadShowcaseData(business.id, business.name);

  return (
    <Showcase
      data={data}
      concept={CONCEPT}
      exitHref={`/${lang}/g/${slug}/dashboard`}
    />
  );
}
