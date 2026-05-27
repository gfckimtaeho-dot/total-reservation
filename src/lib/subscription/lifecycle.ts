// 구독 만료 → 유예 → 비활성화 자동 transition.
// spec admin.md: "만료일 다음날부터 7일 유예 → 7일 후 미확인 시 자동 비활성화".
//
// 호출 시점: /admin/subscriptions, /admin/businesses 페이지 진입 시 lazy.
// cron 없이 admin 활동만으로 일관 transition (invites cleanupExpiredInvites 패턴).
// BLOCKED 매장은 admin 수동 차단이라 자동 transition 영향 X.

import { prisma } from "@/lib/db/client";

const DAY_MS = 1000 * 60 * 60 * 24;
const GRACE_DAYS = 7;

export async function applyExpiryTransitions(): Promise<{
  toGrace: number;
  toExpired: number;
}> {
  const now = new Date();
  const expiredCutoff = new Date(now.getTime() - GRACE_DAYS * DAY_MS);

  // 1. EXPIRED: subscription.endDate < now - 7d, 현재 status 가 TRIAL/ACTIVE/GRACE
  const expiredCandidates = await prisma.subscription.findMany({
    where: { endDate: { lt: expiredCutoff } },
    select: { gymId: true },
  });
  const toExpired = expiredCandidates.length
    ? await prisma.business.updateMany({
        where: {
          id: { in: expiredCandidates.map((s) => s.gymId) },
          status: { in: ["TRIAL", "ACTIVE", "GRACE"] },
        },
        data: { status: "EXPIRED" },
      })
    : { count: 0 };

  // 2. GRACE: subscription.endDate < now AND >= now - 7d, 현재 status 가 TRIAL/ACTIVE
  const graceCandidates = await prisma.subscription.findMany({
    where: {
      endDate: { lt: now, gte: expiredCutoff },
    },
    select: { gymId: true },
  });
  const toGrace = graceCandidates.length
    ? await prisma.business.updateMany({
        where: {
          id: { in: graceCandidates.map((s) => s.gymId) },
          status: { in: ["TRIAL", "ACTIVE"] },
        },
        data: { status: "GRACE" },
      })
    : { count: 0 };

  return { toGrace: toGrace.count, toExpired: toExpired.count };
}
