import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getTheme } from "@/lib/theme";
import { logout } from "@/lib/auth/actions";
import { listVisibleThreads, type ChatViewer } from "@/lib/chat/queries";
import { SidebarNav } from "../dashboard/SidebarNav";

// OWNER/MANAGER 전용 — sidebar + 3-theme. STORE thread 발신 + TRAINER audit 진입.

const TONE = {
  normal: {
    page: "bg-amber-50/50",
    aside: "bg-band",
    border: "border-ink/10",
    eyebrow: "text-ink/70",
    name: "text-ink",
    sub: "text-ink/60",
    logout: "text-ink/80 hover:bg-white/40",
    h1: "text-ink",
    card: "bg-white ring-1 ring-ink/10 hover:ring-orange-300",
    cardLabel: "text-ink",
    cardSub: "text-ink/60",
    badge: "bg-orange-500 text-white",
    auditBtn:
      "bg-white text-ink ring-ink/10 hover:bg-orange-50",
  },
  black: {
    page: "bg-zinc-950 text-zinc-200",
    aside: "bg-black",
    border: "border-white/5",
    eyebrow: "text-lime-300/80",
    name: "text-white",
    sub: "text-zinc-500",
    logout: "text-zinc-400 hover:bg-white/5",
    h1: "text-white",
    card: "bg-zinc-900 ring-1 ring-white/5 hover:ring-orange-400/40",
    cardLabel: "text-white",
    cardSub: "text-zinc-400",
    badge: "bg-orange-500 text-white",
    auditBtn:
      "bg-white/5 text-zinc-300 ring-white/10 hover:bg-white/10",
  },
  white: {
    page: "bg-violet-50/40",
    aside: "bg-violet-50",
    border: "border-violet-100",
    eyebrow: "text-ink/60",
    name: "text-ink",
    sub: "text-ink/50",
    logout: "text-zinc-700 hover:bg-zinc-50",
    h1: "text-ink",
    card: "bg-white ring-1 ring-violet-100 hover:ring-orange-300",
    cardLabel: "text-ink",
    cardSub: "text-ink/60",
    badge: "bg-orange-500 text-white",
    auditBtn:
      "bg-white text-ink ring-ink/10 hover:bg-orange-50",
  },
} as const;

type Props = {
  lang: string;
  slug: string;
  businessName: string;
  viewer: ChatViewer;
};

export async function StaffChatList({ lang, slug, businessName, viewer }: Props) {
  const theme = await getTheme();
  const tk = TONE[theme];
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
    <div className={`flex min-h-screen ${tk.page}`}>
      <aside
        className={`hidden w-60 shrink-0 flex-col border-r ${tk.border} ${tk.aside} lg:flex`}
      >
        <div className={`border-b ${tk.border} px-6 py-6`}>
          <span
            className={`text-xs font-semibold uppercase tracking-[0.22em] ${tk.eyebrow}`}
          >
            {tn("studio")}
          </span>
          <div className={`mt-1 font-heading text-lg tracking-tight ${tk.name}`}>
            {businessName}
          </div>
          <div className={`mt-0.5 text-xs ${tk.sub}`}>/g/{slug}</div>
        </div>
        <SidebarNav tone={theme} />
        <div className={`border-t ${tk.border} px-3 py-4`}>
          <form action={logout.bind(null, `/${lang}/g/${slug}/login`)}>
            <button
              className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm ${tk.logout}`}
            >
              {tn("logout")}
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 px-5 py-6 sm:px-8">
        <div className="mb-4 flex items-center justify-between">
          <h1
            className={`font-heading text-xl tracking-tight sm:text-2xl ${tk.h1}`}
          >
            {t("title")}
          </h1>
          <Link
            href={`/${lang}/g/${slug}/chat/audit`}
            className={`rounded-full px-3 py-1.5 text-xs ring-1 ${tk.auditBtn}`}
          >
            {tn("chatAudit")} →
          </Link>
        </div>

        {items.length === 0 ? (
          <p className={`mt-12 text-center text-sm ${tk.sub}`}>
            {t("emptyList")}
          </p>
        ) : (
          <ul className="mx-auto flex max-w-3xl flex-col gap-2">
            {items.map((it) => (
              <li key={it.id}>
                <Link
                  href={`/${lang}/g/${slug}/chat/${it.id}`}
                  className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 transition ${tk.card}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`truncate text-sm font-medium ${tk.cardLabel}`}>
                        {it.label}
                      </span>
                      {it.hasUnread && (
                        <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${tk.badge}`} />
                      )}
                    </div>
                    <div className={`mt-0.5 truncate text-xs ${tk.cardSub}`}>
                      {it.preview}
                    </div>
                  </div>
                  {it.lastMessageAt && (
                    <time className={`shrink-0 text-[10px] ${tk.cardSub}`}>
                      {formatRelative(it.lastMessageAt)}
                    </time>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
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
