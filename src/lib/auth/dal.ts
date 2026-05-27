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

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { business: true },
  });
  // 사장이 비활성화한 계정은 세션이 살아있어도 모든 보호 페이지 차단.
  // (require* 가 null 을 받아 login 으로 redirect)
  if (user && !user.active) return null;
  return user;
});

export async function requireAdmin() {
  const user = await verifySession();
  if (!user || user.role !== "ADMIN") redirect("/admin/login");
  return user;
}

// 차단·만료 매장의 모든 라우트는 안내 페이지로. GRACE 는 spec 상 정상 운영 유지(통과).
function isBusinessBlocked(status: string): boolean {
  return status === "BLOCKED" || status === "EXPIRED";
}

export async function requireGymStaff(slug: string) {
  const user = await verifySession();
  if (!user) redirect(`/g/${slug}/login`);
  if (!user.business || user.business.slug !== slug) {
    redirect(`/g/${slug}/login`);
  }
  if (isBusinessBlocked(user.business.status)) {
    redirect(`/g/${slug}/blocked`);
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
  if (isBusinessBlocked(user.business.status)) {
    redirect(`/g/${slug}/blocked`);
  }
  // 스태프는 고객 페이지(/me 등)에 들어올 일이 없다 — 대시보드로 보낸다.
  // (requireGymStaff 가 고객을 /me 로 보내는 것과 대칭) 트레이너가 /me 의
  // 고객 전용 출입 QR 흐름을 타 "발급 불가"를 보던 문제를 차단.
  if (["OWNER", "MANAGER", "TRAINER"].includes(user.role)) {
    redirect(`/g/${slug}/dashboard`);
  }
  return user;
}

// Non-throwing variant for API routes (redirect()를 못 쓰는 컨텍스트).
export async function isGymStaff(slug: string): Promise<boolean> {
  const user = await verifySession();
  if (!user || !user.business || user.business.slug !== slug) return false;
  if (isBusinessBlocked(user.business.status)) return false;
  return ["OWNER", "MANAGER", "TRAINER"].includes(user.role);
}
