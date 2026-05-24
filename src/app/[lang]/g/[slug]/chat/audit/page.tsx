import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireGymStaff } from "@/lib/auth/dal";
import { getTheme } from "@/lib/theme";
import { logout } from "@/lib/auth/actions";
import { listAuditTrainerThreads, type ChatViewer } from "@/lib/chat/queries";
import { SidebarNav } from "../../dashboard/SidebarNav";

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
    notice: "bg-amber-100/60 text-amber-900 ring-1 ring-amber-300",
    card: "bg-white ring-1 ring-ink/10 hover:ring-orange-300",
    cardLabel: "text-ink",
    cardSub: "text-ink/60",
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
    notice: "bg-amber-500/10 text-amber-300 ring-1 ring-amber-400/30",
    card: "bg-zinc-900 ring-1 ring-white/5 hover:ring-orange-400/40",
    cardLabel: "text-white",
    cardSub: "text-zinc-400",
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
    notice: "bg-amber-50 text-amber-900 ring-1 ring-amber-200",
    card: "bg-white ring-1 ring-violet-100 hover:ring-orange-300",
    cardLabel: "text-ink",
    cardSub: "text-ink/60",
  },
} as const;

export default async function ChatAuditPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const auth = await requireGymStaff(slug);
  // TRAINER 가 직접 /chat/audit 진입 시 본인 채팅으로 강제 리다이렉트.
  if (auth.role !== "OWNER" && auth.role !== "MANAGER") {
    redirect(`/${lang}/g/${slug}/chat`);
  }
  const business = auth.business!;
  const theme = await getTheme();
  const tk = TONE[theme];
  const t = await getTranslations("chat");
  const tn = await getTranslations("nav");

  const viewer: ChatViewer = {
    id: auth.id,
    gymId: business.id,
    role: auth.role,
  };
  const threads = await listAuditTrainerThreads(viewer);

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
          <div
            className={`mt-1 font-heading text-lg tracking-tight ${tk.name}`}
          >
            {business.name}
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
        <div className="mb-3 flex items-center gap-3">
          <Link href={`/${lang}/g/${slug}/chat`} className={`text-xs ${tk.sub} hover:underline`}>
            ← {t("title")}
          </Link>
        </div>
        <h1
          className={`font-heading text-xl tracking-tight sm:text-2xl ${tk.h1}`}
        >
          {t("auditTitle")}
        </h1>

        <div className={`mt-4 rounded-lg px-4 py-3 text-xs ${tk.notice}`}>
          {t("auditNotice")}
        </div>

        {threads.length === 0 ? (
          <p className={`mt-12 text-center text-sm ${tk.sub}`}>
            {t("emptyList")}
          </p>
        ) : (
          <ul className="mx-auto mt-4 flex max-w-3xl flex-col gap-2">
            {threads.map((th) => {
              const lastMsg = th.messages[0] ?? null;
              const preview = lastMsg
                ? lastMsg.system
                  ? lastMsg.body
                  : lastMsg.deletedAt
                    ? t("deleted")
                    : lastMsg.body.length > 60
                      ? `${lastMsg.body.slice(0, 60)}…`
                      : lastMsg.body
                : t("emptyMessages");
              const peer = `${th.customer.name} ↔ ${th.staffUser?.name ?? t("channels.unassigned")}`;
              return (
                <li key={th.id}>
                  <Link
                    href={`/${lang}/g/${slug}/chat/${th.id}`}
                    className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 transition ${tk.card}`}
                  >
                    <div className="min-w-0">
                      <div className={`truncate text-sm font-medium ${tk.cardLabel}`}>
                        {peer}
                      </div>
                      <div className={`mt-0.5 truncate text-xs ${tk.cardSub}`}>
                        {preview}
                      </div>
                    </div>
                    {th.lastMessageAt && (
                      <time className={`shrink-0 text-[10px] ${tk.cardSub}`}>
                        {new Date(th.lastMessageAt).toLocaleDateString()}
                      </time>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
