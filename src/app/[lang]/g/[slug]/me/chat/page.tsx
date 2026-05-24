import type { Viewport } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireGymCustomer } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";

// V18 Sunset Peach — 흰 배경 + orange/rose 액센트.
export const viewport: Viewport = {
  themeColor: "#ffffff",
};

// 고객 채팅 진입 — 항상 STORE 카드 1장 + (있으면) 담당 트레이너별 카드 N장.
// thread row 는 진입 시 lazy-create (멱등). 카드 클릭 시 /me/chat/{threadId} 로.
export default async function CustomerChatListPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const user = await requireGymCustomer(slug);
  const business = user.business!;
  const t = await getTranslations("chat");

  // 본인의 활성 PT 권에서 담당 트레이너 distinct.
  const packages = await prisma.package.findMany({
    where: {
      gymId: business.id,
      userId: user.id,
      assignedStaffId: { not: null },
    },
    select: {
      assignedStaff: {
        select: { userId: true, user: { select: { id: true, name: true } } },
      },
    },
  });
  const trainerUserSet = new Map<string, string>(); // userId → name
  for (const p of packages) {
    const u = p.assignedStaff?.user;
    if (u) trainerUserSet.set(u.id, u.name);
  }

  // STORE thread (없으면 생성). staffUserId NULL 이라 compound unique 안 잡힘 →
  // partial unique index(scripts/ensure-chat-indexes.ts) 가 race 가드 역할.
  let storeThread = await prisma.chatThread.findFirst({
    where: { gymId: business.id, kind: "STORE", customerId: user.id },
    select: { id: true },
  });
  if (!storeThread) {
    storeThread = await prisma.chatThread.create({
      data: {
        gymId: business.id,
        kind: "STORE",
        customerId: user.id,
        staffUserId: null,
      },
      select: { id: true },
    });
  }

  // 담당 트레이너 thread 각각 lazy-create.
  const trainerThreads: { staffUserId: string; staffName: string; threadId: string }[] = [];
  for (const [staffUserId, staffName] of trainerUserSet.entries()) {
    let th = await prisma.chatThread.findFirst({
      where: {
        gymId: business.id,
        kind: "TRAINER",
        customerId: user.id,
        staffUserId,
      },
      select: { id: true },
    });
    if (!th) {
      th = await prisma.chatThread.create({
        data: {
          gymId: business.id,
          kind: "TRAINER",
          customerId: user.id,
          staffUserId,
        },
        select: { id: true },
      });
    }
    trainerThreads.push({ staffUserId, staffName, threadId: th.id });
  }

  // 각 thread 의 unread / 마지막 메시지 한 줄.
  const allThreadIds = [storeThread.id, ...trainerThreads.map((x) => x.threadId)];
  const lastMessages = await prisma.chatMessage.findMany({
    where: { threadId: { in: allThreadIds } },
    orderBy: { sentAt: "desc" },
    distinct: ["threadId"],
    select: { id: true, threadId: true, body: true, sentAt: true, senderId: true, system: true, deletedAt: true },
  });
  const lastByThread = new Map(lastMessages.map((m) => [m.threadId, m]));

  const reads = await prisma.chatRead.findMany({
    where: { threadId: { in: allThreadIds }, accountId: user.id },
    select: { threadId: true, lastReadMessageId: true },
  });
  const readByThread = new Map(reads.map((r) => [r.threadId, r.lastReadMessageId]));

  function previewOf(threadId: string): { text: string; hasUnread: boolean } {
    const last = lastByThread.get(threadId);
    if (!last) return { text: t("emptyMessages"), hasUnread: false };
    const hasUnread =
      last.senderId !== user.id &&
      last.deletedAt == null &&
      (readByThread.get(threadId) == null || last.id > (readByThread.get(threadId) as string));
    const text = last.system
      ? last.body
      : last.deletedAt
        ? t("deleted")
        : last.body.length > 60
          ? `${last.body.slice(0, 60)}…`
          : last.body;
    return { text, hasUnread };
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-orange-50 via-rose-50/40 to-transparent" />
      <div className="relative mx-auto max-w-2xl px-5 py-6 sm:px-8">
        <div className="flex items-center justify-between">
          <Link
            href={`/${lang}/g/${slug}/me`}
            className="text-xs text-zinc-500 hover:text-zinc-900"
          >
            ← 홈으로
          </Link>
          <h1 className="bg-gradient-to-r from-orange-500 to-rose-500 bg-clip-text font-heading text-xl font-bold tracking-tight text-transparent">
            {t("title")}
          </h1>
          <div className="w-12" />
        </div>

        <ul className="mt-6 flex flex-col gap-3">
          {trainerThreads.map((tr) => {
            const { text, hasUnread } = previewOf(tr.threadId);
            return (
              <li key={tr.threadId}>
                <Link
                  href={`/${lang}/g/${slug}/me/chat/${tr.threadId}`}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-4 ring-1 ring-orange-200 transition hover:ring-orange-400"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-zinc-900">
                        {t("channels.trainer", { name: tr.staffName })}
                      </span>
                      {hasUnread && (
                        <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-orange-500" />
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-zinc-500">
                      {text}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}

          <li>
            <Link
              href={`/${lang}/g/${slug}/me/chat/${storeThread.id}`}
              className="flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 px-4 py-4 ring-1 ring-amber-200 transition hover:ring-amber-400"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-zinc-900">
                    {t("channels.store", { business: business.name })}
                  </span>
                  {previewOf(storeThread.id).hasUnread && (
                    <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-orange-500" />
                  )}
                </div>
                <div className="mt-0.5 truncate text-xs text-zinc-500">
                  {previewOf(storeThread.id).text}
                </div>
              </div>
            </Link>
          </li>
        </ul>

        {trainerThreads.length === 0 && (
          <p className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-900 ring-1 ring-amber-200">
            {t("channels.unassigned")}
          </p>
        )}
      </div>
    </main>
  );
}
