// Next.js 16 Proxy (formerly Middleware).
// Two layers:
//
//   Layer 1 — locale routing (next-intl):
//     /          → 302 to /{detectedLocale}/   (cookie → Accept-Language → defaultLocale)
//     /ko/...    → pass through, sets NEXT_LOCALE cookie
//     /en/...    → pass through, sets NEXT_LOCALE cookie
//
//   Layer 2 — optimistic auth gate (no DB hit):
//     /{lang}/admin/...                except /admin/login → require ADMIN session
//     /{lang}/g/{slug}/dashboard/...                       → require non-customer session
//     /{lang}/g/{slug}/me/...                              → require any session
//
// The gate only DECRYPTS the session cookie and checks the role string.
// Authoritative gym-scope checks (slug match, status) live in src/lib/auth/dal.ts
// and run inside Server Components and Server Actions.

import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/lib/i18n/config";
import { decryptSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";

const intlMiddleware = createIntlMiddleware(routing);

const ADMIN_GUARDED = /^\/[a-z]{2}\/admin(?!\/login)(\/|$)/;
const GYM_STAFF_GUARDED =
  /^\/[a-z]{2}\/g\/([^/]+)\/(dashboard|members|settings)(\/|$)/;
const GYM_USER_GUARDED = /^\/[a-z]{2}\/g\/([^/]+)\/me(\/|$)/;

function localeFromPath(pathname: string): string {
  const seg = pathname.split("/")[1];
  return routing.locales.includes(seg as (typeof routing.locales)[number])
    ? seg
    : routing.defaultLocale;
}

function gymSlugFromPath(pathname: string): string {
  const m = pathname.match(/^\/[a-z]{2}\/g\/([^/]+)/);
  return m?.[1] ?? "";
}

export default async function proxy(request: NextRequest) {
  const intlResponse = intlMiddleware(request);
  if (intlResponse.status >= 300 && intlResponse.status < 400) {
    return intlResponse;
  }

  const pathname = request.nextUrl.pathname;
  const isAdmin = ADMIN_GUARDED.test(pathname);
  const isGymStaff = GYM_STAFF_GUARDED.test(pathname);
  const isGymUser = GYM_USER_GUARDED.test(pathname);

  if (isAdmin || isGymStaff || isGymUser) {
    const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = await decryptSession(cookie);
    const locale = localeFromPath(pathname);

    if (!session) {
      if (isAdmin) {
        return NextResponse.redirect(
          new URL(`/${locale}/admin/login`, request.url),
        );
      }
      const slug = gymSlugFromPath(pathname);
      return NextResponse.redirect(
        new URL(`/${locale}/g/${slug}/login`, request.url),
      );
    }

    if (isAdmin && session.role !== "ADMIN") {
      return NextResponse.redirect(new URL(`/${locale}/`, request.url));
    }

    if (
      isGymStaff &&
      (session.role === "CUSTOMER" || session.role === "ADMIN")
    ) {
      const slug = gymSlugFromPath(pathname);
      return NextResponse.redirect(
        new URL(`/${locale}/g/${slug}/me`, request.url),
      );
    }
  }

  return intlResponse;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
