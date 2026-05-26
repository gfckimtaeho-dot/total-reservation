// 채팅 read-only 쿼리 — 서버 컴포넌트·API route·server actions 공통.
// 권한 검증은 호출 측이 verifySession/requireGym* 으로 먼저 한 뒤
// 여기에 (gymId, viewerUser) 를 넘긴다. 이 모듈은 권한 매트릭스만 인지.

import { prisma } from "@/lib/db/client";
import type { Role } from "@/generated/prisma/client";

export type ChatViewer = {
  id: string;
  gymId: string;
  role: Role;
};

// 채널별 thread 페어와 본인의 unread count.
// 고객: 본인의 TRAINER + STORE thread.
// TRAINER: 본인이 staffUserId 인 TRAINER thread (STORE 안 보임).
// OWNER/MANAGER: 본인 매장 STORE thread + (audit) TRAINER thread는 별도 API.

export async function listVisibleThreads(viewer: ChatViewer) {
  if (viewer.role === "CUSTOMER") {
    return prisma.chatThread.findMany({
      where: { gymId: viewer.gymId, customerId: viewer.id },
      orderBy: { lastMessageAt: "desc" },
      include: {
        customer: { select: { id: true, name: true } },
        staffUser: { select: { id: true, name: true } },
        messages: {
          orderBy: { sentAt: "desc" },
          take: 1,
          select: { id: true, body: true, sentAt: true, senderId: true, system: true, deletedAt: true },
        },
        reads: { where: { accountId: viewer.id }, select: { lastReadMessageId: true } },
      },
    });
  }

  if (viewer.role === "TRAINER") {
    return prisma.chatThread.findMany({
      where: {
        gymId: viewer.gymId,
        kind: "TRAINER",
        staffUserId: viewer.id,
      },
      orderBy: { lastMessageAt: "desc" },
      include: {
        customer: { select: { id: true, name: true } },
        staffUser: { select: { id: true, name: true } },
        messages: {
          orderBy: { sentAt: "desc" },
          take: 1,
          select: { id: true, body: true, sentAt: true, senderId: true, system: true, deletedAt: true },
        },
        reads: { where: { accountId: viewer.id }, select: { lastReadMessageId: true } },
      },
    });
  }

  // OWNER / MANAGER: STORE thread 만 (audit TRAINER 는 별도 라우트)
  return prisma.chatThread.findMany({
    where: { gymId: viewer.gymId, kind: "STORE" },
    orderBy: { lastMessageAt: "desc" },
    include: {
      customer: { select: { id: true, name: true } },
      staffUser: { select: { id: true, name: true } },
      messages: {
        orderBy: { sentAt: "desc" },
        take: 1,
        select: { id: true, body: true, sentAt: true, senderId: true, system: true, deletedAt: true },
      },
      reads: { where: { accountId: viewer.id }, select: { lastReadMessageId: true } },
    },
  });
}

// 단일 thread + viewer 권한 + messages (페이지네이션 — 최근 N개 또는 afterId 이후).
// 시청 권한 없으면 null. afterId 가 있으면 incremental fetch (폴링 용).

export async function getThreadForViewer(
  viewer: ChatViewer,
  threadId: string,
  opts: { afterId?: string | null; take?: number } = {},
) {
  const thread = await prisma.chatThread.findFirst({
    where: { id: threadId, gymId: viewer.gymId },
    include: {
      customer: { select: { id: true, name: true } },
      staffUser: { select: { id: true, name: true } },
    },
  });
  if (!thread) return null;

  // 권한 매트릭스
  const canSee = canViewThread(viewer, thread);
  if (!canSee) return null;

  const take = opts.take ?? 100;
  const messages = await prisma.chatMessage.findMany({
    where: {
      threadId,
      ...(opts.afterId ? { id: { gt: opts.afterId } } : {}),
    },
    orderBy: { sentAt: opts.afterId ? "asc" : "desc" },
    take,
    select: {
      id: true,
      senderId: true,
      body: true,
      system: true,
      deletedAt: true,
      sentAt: true,
    },
  });

  // afterId 없으면 desc 로 받아 reverse (오래된 순으로 표시).
  const ordered = opts.afterId ? messages : messages.slice().reverse();

  const myRead = await prisma.chatRead.findUnique({
    where: { threadId_accountId: { threadId, accountId: viewer.id } },
    select: { lastReadMessageId: true, lastReadAt: true },
  });

  return {
    thread,
    messages: ordered,
    myLastReadMessageId: myRead?.lastReadMessageId ?? null,
    canSend: canSendInThread(viewer, thread),
  };
}

// audit 라우트 (OWNER/MANAGER): 모든 TRAINER thread 목록 + read-only.

export async function listAuditTrainerThreads(viewer: ChatViewer) {
  if (viewer.role !== "OWNER" && viewer.role !== "MANAGER") return [];
  return prisma.chatThread.findMany({
    where: { gymId: viewer.gymId, kind: "TRAINER" },
    orderBy: { lastMessageAt: "desc" },
    include: {
      customer: { select: { id: true, name: true } },
      staffUser: { select: { id: true, name: true } },
      messages: {
        orderBy: { sentAt: "desc" },
        take: 1,
        select: { id: true, body: true, sentAt: true, system: true, deletedAt: true },
      },
    },
  });
}

// 본인 시점 전체 unread 합 + thread 별 breakdown. 폴링용.

export async function unreadForViewer(viewer: ChatViewer) {
  const threads = await listVisibleThreads(viewer);

  const breakdown: { threadId: string; unread: number }[] = [];
  let total = 0;
  for (const t of threads) {
    const myReadId = t.reads[0]?.lastReadMessageId ?? null;
    // unread = (본인이 보낸 게 아니고) AND (시스템 메시지 아니고) AND
    //         (lastReadMessageId 보다 새 메시지). 시스템 메시지(양도 알림 등)는
    //         정보성이라 자동 read 취급 — 옛 담당 thread 처럼 사용자가 열어볼
    //         이유 없는 thread 에서 unread 뱃지가 영구로 남는 것 방지.
    const where: {
      threadId: string;
      senderId: { not: string };
      deletedAt: null;
      system: false;
      id?: { gt: string };
    } = {
      threadId: t.id,
      senderId: { not: viewer.id },
      deletedAt: null,
      system: false,
    };
    if (myReadId) where.id = { gt: myReadId };
    const count = await prisma.chatMessage.count({ where });
    breakdown.push({ threadId: t.id, unread: count });
    total += count;
  }

  return { total, breakdown };
}

// ─── 권한 매트릭스 헬퍼 ──────────────────────────────────────

type ThreadShape = {
  kind: "TRAINER" | "STORE";
  customerId: string;
  staffUserId: string | null;
  closedAt: Date | null;
};

export function canViewThread(viewer: ChatViewer, t: ThreadShape): boolean {
  if (viewer.role === "CUSTOMER") return t.customerId === viewer.id;
  if (viewer.role === "TRAINER") return t.kind === "TRAINER" && t.staffUserId === viewer.id;
  if (viewer.role === "OWNER" || viewer.role === "MANAGER") return true; // STORE 직접 / TRAINER audit
  return false;
}

export function canSendInThread(viewer: ChatViewer, t: ThreadShape): boolean {
  if (t.closedAt) return false;
  if (viewer.role === "CUSTOMER") return t.customerId === viewer.id;
  if (viewer.role === "TRAINER") return t.kind === "TRAINER" && t.staffUserId === viewer.id;
  if (viewer.role === "OWNER" || viewer.role === "MANAGER") return t.kind === "STORE";
  return false;
}
