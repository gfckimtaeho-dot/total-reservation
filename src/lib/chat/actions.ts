"use server";

// 채팅 server actions — 고객·트레이너·OWNER/MANAGER 공통.
// 호출 측은 slug 를 넘김. 인증은 verifySession 으로 본인 식별 후
// canSendInThread / 권한 매트릭스로 게이팅한다.

import { prisma } from "@/lib/db/client";
import { verifySession } from "@/lib/auth/dal";
import {
  canSendInThread,
  canViewThread,
  type ChatViewer,
} from "@/lib/chat/queries";
import { insertSystemMessage, SystemMessages } from "@/lib/chat/system";

type R<T = unknown> = ({ ok: true } & T) | { ok: false; error: string };

const MAX_BODY = 1000;
const SOFT_DELETE_WINDOW_MS = 5 * 60 * 1000;

async function authViewer(slug: string): Promise<ChatViewer | null> {
  const user = await verifySession();
  if (!user || !user.business || user.business.slug !== slug) return null;
  if (!user.gymId) return null;
  return { id: user.id, gymId: user.gymId, role: user.role };
}

// 메시지 발신 -------------------------------------------------------------

export async function sendMessage(input: {
  slug: string;
  threadId: string;
  body: string;
}): Promise<R<{ messageId: string }>> {
  const viewer = await authViewer(input.slug);
  if (!viewer) return { ok: false, error: "로그인이 필요합니다" };

  const body = input.body.trim();
  if (!body) return { ok: false, error: "내용을 입력해주세요" };
  if (body.length > MAX_BODY) {
    return { ok: false, error: `메시지는 ${MAX_BODY}자 이내로 입력해주세요` };
  }

  const thread = await prisma.chatThread.findFirst({
    where: { id: input.threadId, gymId: viewer.gymId },
    select: { id: true, kind: true, customerId: true, staffUserId: true, closedAt: true },
  });
  if (!thread) return { ok: false, error: "채팅을 찾을 수 없습니다" };
  if (!canSendInThread(viewer, thread)) {
    return { ok: false, error: "이 채팅에 메시지를 보낼 수 없습니다" };
  }

  const msg = await prisma.$transaction(async (tx) => {
    const m = await tx.chatMessage.create({
      data: {
        threadId: thread.id,
        senderId: viewer.id,
        body,
      },
      select: { id: true, sentAt: true },
    });
    await tx.chatThread.update({
      where: { id: thread.id },
      data: { lastMessageAt: m.sentAt },
    });
    return m;
  });

  return { ok: true, messageId: msg.id };
}

// 읽음 표시 ---------------------------------------------------------------

export async function markRead(input: {
  slug: string;
  threadId: string;
}): Promise<R> {
  const viewer = await authViewer(input.slug);
  if (!viewer) return { ok: false, error: "로그인이 필요합니다" };

  const thread = await prisma.chatThread.findFirst({
    where: { id: input.threadId, gymId: viewer.gymId },
    select: { id: true, kind: true, customerId: true, staffUserId: true, closedAt: true },
  });
  if (!thread) return { ok: false, error: "채팅을 찾을 수 없습니다" };
  if (!canViewThread(viewer, thread)) {
    return { ok: false, error: "권한이 없습니다" };
  }

  const last = await prisma.chatMessage.findFirst({
    where: { threadId: thread.id },
    orderBy: { sentAt: "desc" },
    select: { id: true },
  });
  if (!last) return { ok: true };

  await prisma.chatRead.upsert({
    where: { threadId_accountId: { threadId: thread.id, accountId: viewer.id } },
    update: { lastReadMessageId: last.id, lastReadAt: new Date() },
    create: {
      threadId: thread.id,
      accountId: viewer.id,
      lastReadMessageId: last.id,
    },
  });

  return { ok: true };
}

// 본인 메시지 5분 내 soft delete -----------------------------------------

export async function softDeleteMessage(input: {
  slug: string;
  messageId: string;
}): Promise<R> {
  const viewer = await authViewer(input.slug);
  if (!viewer) return { ok: false, error: "로그인이 필요합니다" };

  const msg = await prisma.chatMessage.findFirst({
    where: { id: input.messageId, thread: { gymId: viewer.gymId } },
    select: { id: true, senderId: true, sentAt: true, deletedAt: true, system: true },
  });
  if (!msg) return { ok: false, error: "메시지를 찾을 수 없습니다" };
  if (msg.system) return { ok: false, error: "시스템 메시지는 삭제할 수 없습니다" };
  if (msg.senderId !== viewer.id) {
    return { ok: false, error: "본인 메시지만 삭제할 수 있습니다" };
  }
  if (msg.deletedAt) return { ok: true };
  if (Date.now() - msg.sentAt.getTime() > SOFT_DELETE_WINDOW_MS) {
    return { ok: false, error: "5분이 지난 메시지는 삭제할 수 없습니다" };
  }

  await prisma.chatMessage.update({
    where: { id: msg.id },
    data: { deletedAt: new Date() },
  });
  return { ok: true };
}

// thread lazy-create ------------------------------------------------------

// TRAINER thread: 고객 ↔ 담당 트레이너 페어 단위. 양쪽 누가 진입해도 같은 thread.
// 권한: 호출자가 customer 본인이거나 staffUser 본인이어야 함. OWNER 가 lazy-create
// 하면 안 됨 (감사용으로만 보임).
export async function getOrCreateTrainerThread(input: {
  slug: string;
  customerId: string;
  staffUserId: string;
}): Promise<R<{ threadId: string }>> {
  const viewer = await authViewer(input.slug);
  if (!viewer) return { ok: false, error: "로그인이 필요합니다" };

  // 권한
  const isCustomerSelf = viewer.role === "CUSTOMER" && viewer.id === input.customerId;
  const isStaffSelf = viewer.role === "TRAINER" && viewer.id === input.staffUserId;
  if (!isCustomerSelf && !isStaffSelf) {
    return { ok: false, error: "권한이 없습니다" };
  }

  // 페어 실재 검증: Package.assignedStaff.userId == staffUserId 인 PT 권 존재.
  // 즉 담당 매핑이 잡혀있어야 채팅 가능 ([[decision-service-assignment-phase1]]).
  const hasPair = await prisma.package.findFirst({
    where: {
      gymId: viewer.gymId,
      userId: input.customerId,
      assignedStaff: { userId: input.staffUserId },
    },
    select: { id: true },
  });
  if (!hasPair) {
    return { ok: false, error: "담당 트레이너와의 채팅만 가능합니다" };
  }

  const existing = await prisma.chatThread.findFirst({
    where: {
      gymId: viewer.gymId,
      kind: "TRAINER",
      customerId: input.customerId,
      staffUserId: input.staffUserId,
    },
    select: { id: true },
  });
  if (existing) return { ok: true, threadId: existing.id };

  const created = await prisma.chatThread.create({
    data: {
      gymId: viewer.gymId,
      kind: "TRAINER",
      customerId: input.customerId,
      staffUserId: input.staffUserId,
    },
    select: { id: true },
  });
  return { ok: true, threadId: created.id };
}

// STORE thread: 고객 ↔ 매장. customer 본인만 lazy-create.
// OWNER/MANAGER 는 customer 가 먼저 채널을 열기 전엔 안 보임 (Phase 1 정책).
export async function getOrCreateStoreThread(input: {
  slug: string;
}): Promise<R<{ threadId: string }>> {
  const viewer = await authViewer(input.slug);
  if (!viewer) return { ok: false, error: "로그인이 필요합니다" };
  if (viewer.role !== "CUSTOMER") {
    return { ok: false, error: "고객만 매장 채팅을 시작할 수 있습니다" };
  }

  const existing = await prisma.chatThread.findFirst({
    where: { gymId: viewer.gymId, kind: "STORE", customerId: viewer.id },
    select: { id: true },
  });
  if (existing) return { ok: true, threadId: existing.id };

  const created = await prisma.chatThread.create({
    data: {
      gymId: viewer.gymId,
      kind: "STORE",
      customerId: viewer.id,
      staffUserId: null,
    },
    select: { id: true },
  });
  return { ok: true, threadId: created.id };
}

// 트레이너 양도 ----------------------------------------------------------
// 2번 기능 (PT 권 양도) 구현 시 호출. 같은 고객의 모든 TRAINER thread 의
// staffUserId 를 toStaffUserId 로 갱신 + 시스템 메시지 1줄 자동 삽입.
// 호출 권한은 호출 측(양도 화면) 에서 검증. 여기서는 actor 만 받는다.

export async function handoverTrainerThreads(input: {
  slug: string;
  customerId: string;
  fromStaffUserId: string;
  toStaffUserId: string;
  toStaffName: string;
}): Promise<R<{ updated: number }>> {
  const viewer = await authViewer(input.slug);
  if (!viewer) return { ok: false, error: "로그인이 필요합니다" };
  if (viewer.role !== "OWNER" && viewer.role !== "MANAGER" && viewer.id !== input.fromStaffUserId) {
    return { ok: false, error: "권한이 없습니다" };
  }

  const result = await prisma.$transaction(async (tx) => {
    const threads = await tx.chatThread.findMany({
      where: {
        gymId: viewer.gymId,
        kind: "TRAINER",
        customerId: input.customerId,
        staffUserId: input.fromStaffUserId,
      },
      select: { id: true },
    });
    for (const t of threads) {
      await tx.chatThread.update({
        where: { id: t.id },
        data: { staffUserId: input.toStaffUserId },
      });
      await insertSystemMessage(tx, {
        threadId: t.id,
        actorId: viewer.id,
        body: SystemMessages.trainerHandover(input.toStaffName),
      });
    }
    return threads.length;
  });

  return { ok: true, updated: result };
}
