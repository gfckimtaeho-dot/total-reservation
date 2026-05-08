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
