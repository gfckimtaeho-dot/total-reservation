import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts");

const nextConfig: NextConfig = {
  // Allow the cloudflared quick-tunnel host (and any other we'll use during
  // demo/testing) to reach Next.js dev resources and pass server-action origin
  // checks. Production deployments don't need this — same-origin by definition.
  allowedDevOrigins: [
    "weather-benefits-tourist-batch.trycloudflare.com",
    "*.trycloudflare.com",
    // 태블릿 LAN 테스트. IP가 세션마다 바뀌어(.87→.79) 서브넷 와일드카드도
    // 함께 둠 — 안 넣으면 dev 가 cross-origin 으로 클라 리소스/서버액션을
    // 차단해 하이드레이션 실패(탭해도 무반응)가 난다.
    "172.30.1.79",
    "172.30.1.*",
    "192.168.*.*",
  ],
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
