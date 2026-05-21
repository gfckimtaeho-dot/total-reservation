import type { Metadata } from "next";

// 운영 영역(/dashboard)은 매장 운영 PWA manifest 를 링크한다(?area=staff).
// 전역 app/manifest.ts 는 제거됐으므로(파일 기반 manifest 는 라우트별
// metadata.manifest 보다 우선순위가 높아 override 불가) 여기서 지정.
// 설치 시 시작점이 그 매장 대시보드가 되고, 고객 manifest(me/layout)와
// id 가 달라 같은 매장이라도 별개 앱으로 설치된다.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  return {
    manifest: `/${lang}/g/${slug}/manifest.webmanifest?area=staff`,
  };
}

// 패스스루 레이아웃 — DOM 래퍼 없이 children 그대로. manifest 메타데이터만
// 이 세그먼트에 부여하는 게 목적.
export default function StaffDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
