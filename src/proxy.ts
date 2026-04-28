// Next.js 16 Proxy (formerly Middleware).
// Runs before page rendering; handles locale routing now, auth gate later (M0.7).
//
// Layer 1 — locale routing (next-intl):
//   - /            → 302 to /{detectedLocale}/  (cookie → Accept-Language → defaultLocale)
//   - /ko/...      → pass through, sets NEXT_LOCALE cookie
//   - /en/...      → pass through, sets NEXT_LOCALE cookie
//
// Layer 2 — auth gate (TODO M0.7):
//   - Read 'session' cookie via jose (decrypt only, no DB)
//   - Redirect unauthenticated users away from /business/* and /customer/reservations/*
//
// Important: do NOT call the database here. Per Next.js 16 guidance, proxy
// should be optimistic checks only. DB-backed authorization lives in
// src/lib/auth/dal.ts (called from Server Components/Actions).

import createIntlMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "@/lib/i18n/config";

const intlMiddleware = createIntlMiddleware(routing);

export default function proxy(request: NextRequest) {
  // Layer 1 — locale routing
  const response = intlMiddleware(request);

  // Layer 2 (M0.7) — auth gate placeholder
  // const session = request.cookies.get("session");
  // const pathname = request.nextUrl.pathname;
  // if (pathname.match(/^\/[^/]+\/(business|customer\/reservations)/) && !session) {
  //   return NextResponse.redirect(new URL("/login", request.url));
  // }

  return response;
}

// Match everything except API, Next internals, and static files with extensions.
export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
