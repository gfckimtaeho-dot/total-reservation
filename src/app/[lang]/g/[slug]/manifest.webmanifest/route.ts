import { prisma } from "@/lib/db/client";

// 매장별 PWA manifest (동적 라우트 핸들러).
//
// 왜 동적인가: 전역 app/manifest.ts 는 start_url 이 "/" 라, 고객이든 트레이너든
// 홈화면 설치를 해도 설치된 앱이 SaaS 본사 랜딩으로 열렸다. 멀티테넌시라
// 매장마다, 또 역할(고객/운영)마다 시작점이 달라야 하는데, 파일 기반
// manifest 는 라우트별 metadata.manifest 보다 우선순위가 높아 override 가
// 불가능하다. 그래서 전역 app/manifest.ts 를 제거하고 이 동적 라우트로 대체.
//
// 두 변형:
//   기본(고객)        — start_url /me,        me/layout.tsx 가 링크
//   ?area=staff(운영) — start_url /dashboard, dashboard/layout.tsx 가 링크
// id 가 달라 같은 매장이라도 고객용/운영용이 각각 독립 설치된다.
//
// 경로에 점(.)이 있어 proxy.ts 미들웨어 매처에서 자동 제외된다(로케일
// prefix 불필요 — lang 은 이미 URL 에 있음).
export async function GET(
  req: Request,
  { params }: { params: Promise<{ lang: string; slug: string }> },
) {
  const { lang, slug } = await params;
  const sp = new URL(req.url).searchParams;
  const area = sp.get("area");
  const isStaff = area === "staff";
  const isScan = area === "scan";
  const scanKey = sp.get("key") ?? "";

  const business = await prisma.business.findUnique({
    where: { slug },
    select: { name: true },
  });
  if (!business) {
    return new Response("Not found", { status: 404 });
  }

  const base = `/${lang}/g/${slug}`;
  // 진입점: 고객은 그 매장 고객 영역, 운영은 그 매장 대시보드, 스캐너는 무인 키
  // 링크. 세션 기반(고객/운영)은 가드가 로그인으로 보내고, 스캐너는 키로만 열린다.
  // 스캐너를 "홈 화면에 추가"하면 주소창 없는 standalone 키오스크로 바로 진입.
  const entry = isScan
    ? `${base}/scan/${scanKey}`
    : isStaff
      ? `${base}/dashboard`
      : `${base}/me`;
  // 홈화면 아이콘 이름 = 매장명. 운영용은 " 운영", 스캐너는 " 출입" suffix 로 구분.
  const name = isScan
    ? `${business.name} 출입`
    : isStaff
      ? `${business.name} 운영`
      : business.name;

  const manifest = {
    name,
    short_name: name,
    description: isScan
      ? `${business.name} 무인 출입 스캐너`
      : isStaff
        ? `${business.name} 운영 관리`
        : `${business.name} 회원 예약`,
    // id 를 변형별로 분리 — 고객용/운영용이 각각 독립 설치되도록.
    id: entry,
    start_url: entry,
    scope: `${base}/`,
    display: "standalone",
    // V18 Sunset Peach 채택 후 — 고객용은 화이트 chrome, 운영용은 어제 다크 그대로.
    // PWA 재설치 시 splash/상태바 색이 페이지 톤과 일치한다. 기존 설치된 PWA 는
    // manifest 캐시가 보존되므로 사용자가 제거 후 재추가해야 갱신된다.
    background_color: isStaff || isScan ? "#09090b" : "#ffffff",
    theme_color: isStaff || isScan ? "#09090b" : "#ffffff",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
