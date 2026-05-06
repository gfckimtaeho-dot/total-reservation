// Data Access Layer for auth — single source of truth for "who is the current
// request's user, and what can they do" in the multi-tenant world.
//
// React.cache() dedups the cookie read + DB lookup so a request rendering many
// Server Components only hits the DB once.

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decryptSession, SESSION_COOKIE_NAME } from "./session";
import { prisma } from "@/lib/db/client";

export const verifySession = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const payload = await decryptSession(token);
  if (!payload) return null;

  return prisma.user.findUnique({
    where: { id: payload.userId },
    include: { business: true },
  });
});

export async function requireAdmin() {
  const user = await verifySession();
  if (!user || user.role !== "ADMIN") redirect("/admin/login");
  return user;
}

export async function requireGymStaff(slug: string) {
  const user = await verifySession();
  if (!user) redirect(`/g/${slug}/login`);
  if (!user.business || user.business.slug !== slug) {
    redirect(`/g/${slug}/login`);
  }
  if (!["OWNER", "MANAGER", "TRAINER"].includes(user.role)) {
    redirect(`/g/${slug}/me`);
  }
  return user;
}

export async function requireGymCustomer(slug: string) {
  const user = await verifySession();
  if (!user) redirect(`/g/${slug}/login`);
  if (!user.business || user.business.slug !== slug) {
    redirect(`/g/${slug}/login`);
  }
  return user;
}

// Non-throwing variant for API routes (redirect()를 못 쓰는 컨텍스트).
export async function isGymStaff(slug: string): Promise<boolean> {
  const user = await verifySession();
  if (!user || !user.business || user.business.slug !== slug) return false;
  return ["OWNER", "MANAGER", "TRAINER"].includes(user.role);
}
