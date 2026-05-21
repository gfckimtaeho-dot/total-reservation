import type { Metadata } from "next";

// 고객 영역(/me 및 하위: holdings, reservations)은 매장 전용 PWA manifest 를
// 링크한다. 전역 app/manifest.ts 는 제거됐으므로(파일 기반 manifest 는
// metadata.manifest 보다 우선순위가 높아 override 불가), 여기서 매장별
// 동적 manifest 라우트를 가리킨다. PwaCard 설치 안내가 이 영역에만 있어
// 고객 PWA 의 시작점이 항상 그 매장 고객 영역이 된다.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  return { manifest: `/${lang}/g/${slug}/manifest.webmanifest` };
}

// 패스스루 레이아웃 — DOM 래퍼 없이 children 그대로. manifest 메타데이터만
// 이 세그먼트에 부여하는 게 목적.
export default function CustomerAreaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
