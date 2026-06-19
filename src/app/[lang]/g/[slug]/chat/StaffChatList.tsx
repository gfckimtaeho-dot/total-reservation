import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listVisibleThreads, type ChatViewer } from "@/lib/chat/queries";
import { OwnerShell } from "../OwnerShell";

// OWNER/MANAGER 전용 — OwnerShell. STORE thread 발신 + TRAINER audit 진입.

const TK = {
  sub: "text-zinc-500",
  card: "bg-white border border-zinc-200 hover:border-indigo-300",
  cardLabel: "text-zinc-900",
  cardSub: "text-zinc-500",
  badge: "bg-indigo-600 text-white",
  auditBtn: "bg-white text-zinc-700 ring-zinc-300 hover:bg-zinc-50",
} as const;

type Props = {
  lang: string;
  slug: string;
  businessName: string;
  viewer: ChatViewer;
};

export async function StaffChatList({ lang, slug, businessName, viewer }: Props) {
  const t = await getTranslations("chat");
  const tn = await getTranslations("nav");

  const threads = await listVisibleThreads(viewer);

  const items = threads.map((th) => {
    const lastMsg = th.messages[0] ?? null;
    const myReadId = th.reads[0]?.lastReadMessageId ?? null;
    const hasUnread = lastMsg
      ? lastMsg.senderId !== viewer.id &&
        lastMsg.deletedAt == null &&
        (myReadId == null || lastMsg.id > myReadId)
      : false;
    const label = `${th.customer.name} · ${t("channels.storeShort")}`;
    const preview = lastMsg
      ? lastMsg.system
        ? lastMsg.body
        : lastMsg.deletedAt
          ? t("deleted")
          : lastMsg.body.length > 60
            ? `${lastMsg.body.slice(0, 60)}…`
            : lastMsg.body
      : t("emptyMessages");
    return {
      id: th.id,
      label,
      preview,
      hasUnread,
      lastMessageAt: th.lastMessageAt,
    };
  });

  return (
    <OwnerShell
      lang={lang}
      slug={slug}
      businessName={businessName}
      subtitle={t("title")}
      action={
        <Link
          href={`/${lang}/g/${slug}/chat/audit`}
          className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold ring-1 ${TK.auditBtn}`}
        >
          {tn("chatAudit")}
        </Link>
      }
    >
      <main className="px-5 py-6 sm:px-8">
        {items.length === 0 ? (
          <p className={`mt-12 text-center text-sm ${TK.sub}`}>
            {t("emptyList")}
          </p>
        ) : (
          <ul className="mx-auto flex max-w-3xl flex-col gap-2">
            {items.map((it) => (
              <li key={it.id}>
                <Link
                  href={`/${lang}/g/${slug}/chat/${it.id}`}
                  className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 transition ${TK.card}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`truncate text-sm font-medium ${TK.cardLabel}`}>
                        {it.label}
                      </span>
                      {it.hasUnread && (
                        <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${TK.badge}`} />
                      )}
                    </div>
                    <div className={`mt-0.5 truncate text-xs ${TK.cardSub}`}>
                      {it.preview}
                    </div>
                  </div>
                  {it.lastMessageAt && (
                    <time className={`shrink-0 text-[10px] ${TK.cardSub}`}>
                      {formatRelative(it.lastMessageAt)}
                    </time>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </OwnerShell>
  );
}

function formatRelative(d: Date): string {
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000) return "방금";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  const days = Math.floor(diff / 86_400_000);
  if (days < 30) return `${days}일 전`;
  return d.toLocaleDateString();
}
