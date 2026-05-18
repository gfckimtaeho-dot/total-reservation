import { loadShowcaseDataBySlug } from "@/lib/catalog/showcaseData";
import { PreviewToggle } from "./PreviewToggle";

// 상품 소개(showcase) 디자인 비교 프리뷰.
// 실데이터(seed gym = stronghealth)로 Dark / Light 두 컨셉을 렌더.
// 컨셉 확정 후 실 라우트 /g/[slug]/showcase 가 Showcase 컴포넌트를 재사용.
const PREVIEW_SLUG = "stronghealth";

export default async function ShowcasePreviewPage() {
  const data = await loadShowcaseDataBySlug(PREVIEW_SLUG);

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-sm text-zinc-400">
        gym &quot;{PREVIEW_SLUG}&quot; not found — seed 데이터 확인 필요
      </div>
    );
  }

  return <PreviewToggle data={data} />;
}
