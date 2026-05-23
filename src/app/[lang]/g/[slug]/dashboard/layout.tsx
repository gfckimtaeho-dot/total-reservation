import type { Metadata, Viewport } from "next";

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

// 운영 PWA standalone 모드에선 viewport-fit:cover 로 viewport 가 시스템 UI
// 영역까지 확장된다. 페이지 themeColor 도 다크로 명시 — Chrome PWA 상태바·
// 네비 영역의 동적 색을 다크로 잡아준다(manifest theme_color 와 별개 경로).
export const viewport: Viewport = {
  themeColor: "#09090b",
};

// 패스스루 레이아웃 — DOM 래퍼 없이 children + body 다크 강제 style 만.
// 왜 body bg 를 강제하나: globals.css 의 body 가 `bg-background`(= 흰색) 라,
// PWA standalone 에서 viewport 가 safe-area 까지 확장될 때 우측 등 시스템
// 영역에 body 흰색이 새 나간다. layout 안에 inline <style> 로 다크 강제 →
// 운영 영역에서만 적용되고 고객 영역(/me) 으로 이동 시 layout unmount 와
// 함께 자동 제거되므로 라이트 톤에는 영향 없음.
export default function StaffDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{`html,body{background-color:#09090b !important;}`}</style>
      {children}
    </>
  );
}
