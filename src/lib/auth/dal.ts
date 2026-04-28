// Data Access Layer for auth.
// Single source of truth for "who is the current request's user, and what can they do".
// All Server Components/Server Actions that need the current user MUST go through here.
//
// Why React.cache(): a single request may render many components that each
// want the user. cache() dedups the cookie read + DB lookup so we only
// hit the DB once per request.

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decryptSession, SESSION_COOKIE_NAME } from "./session";
import { prisma } from "@/lib/db/client";
import type { Role } from "@/generated/prisma/enums";

export const verifySession = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const payload = await decryptSession(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });
  return user;
});

export async function requireUser() {
  const user = await verifySession();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(...allowed: Role[]) {
  const user = await requireUser();
  if (!allowed.includes(user.role)) redirect("/");
  return user;
}
