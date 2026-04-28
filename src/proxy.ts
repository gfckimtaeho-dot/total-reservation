// Next.js 16 Proxy (formerly Middleware).
// Runs before page rendering. Two responsibilities:
//
//   Layer 1 — locale routing (next-intl):
//     /          → 302 to /{detectedLocale}/   (cookie → Accept-Language → defaultLocale)
//     /ko/...    → pass through, sets NEXT_LOCALE cookie
//     /en/...    → pass through, sets NEXT_LOCALE cookie
//
//   Layer 2 — optimistic auth gate:
//     /{lang}/business/...                → require any session, then BUSINESS_OWNER|STAFF|ADMIN
//     /{lang}/customer/reservations/...   → require any session
//     Anything else                       → no gate
//
// The gate only DECRYPTS the session cookie; it never queries the DB.
// Per Next.js 16 guidance, full authorization (DB-backed user lookup, fine
// permissions) lives in src/lib/auth/dal.ts and runs inside Server Components
// and Server Actions.

import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/lib/i18n/config";
import { decryptSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";

const intlMiddleware = createIntlMiddleware(routing);

const BUSINESS_PROTECTED = /^\/[a-z]{2}\/business(\/|$)/;
const RESERVATIONS_PROTECTED = /^\/[a-z]{2}\/customer\/reservations(\/|$)/;

function localeFromPath(pathname: string): string {
  const seg = pathname.split("/")[1];
  return routing.locales.includes(seg as (typeof routing.locales)[number])
    ? seg
    : routing.defaultLocale;
}

export default async function proxy(request: NextRequest) {
  // Layer 1 — let next-intl run first. If it's redirecting (e.g. / → /ko/),
  // honor that and skip auth checks for this hop.
  const intlResponse = intlMiddleware(request);
  if (intlResponse.status >= 300 && intlResponse.status < 400) {
    return intlResponse;
  }

  // Layer 2 — auth gate.
  const pathname = request.nextUrl.pathname;
  const isBusiness = BUSINESS_PROTECTED.test(pathname);
  const isReservations = RESERVATIONS_PROTECTED.test(pathname);

  if (isBusiness || isReservations) {
    const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = await decryptSession(cookie);

    if (!session) {
      const locale = localeFromPath(pathname);
      return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
    }

    // Business routes additionally require a non-customer role.
    if (isBusiness && session.role === "CUSTOMER") {
      const locale = localeFromPath(pathname);
      return NextResponse.redirect(new URL(`/${locale}/`, request.url));
    }
  }

  return intlResponse;
}

// Match every request except API routes, Next internals, and static files.
export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
