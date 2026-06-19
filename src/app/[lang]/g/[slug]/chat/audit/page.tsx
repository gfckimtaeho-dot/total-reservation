import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireGymStaff } from "@/lib/auth/dal";
import { listAuditTrainerThreads, type ChatViewer } from "@/lib/chat/queries";
import { OwnerShell } from "../../OwnerShell";

const TK = {
  sub: "text-zinc-500",
  notice: "bg-amber-50 text-amber-900 ring-1 ring-amber-200",
  card: "bg-white border border-zinc-200 hover:border-indigo-300",
  cardLabel: "text-zinc-900",
  cardSub: "text-zinc-500",
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
  const t = await getTranslations("chat");

  const viewer: ChatViewer = {
    id: auth.id,
    gymId: business.id,
    role: auth.role,
  };
  const threads = await listAuditTrainerThreads(viewer);

  return (
    <OwnerShell
      lang={lang}
      slug={slug}
      businessName={business.name}
      subtitle={t("auditTitle")}
      action={
        <Link
          href={`/${lang}/g/${slug}/chat`}
          className="inline-flex items-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50"
        >
          {t("title")}
        </Link>
      }
    >
      <main className="px-5 py-6 sm:px-8">
        <div className={`rounded-lg px-4 py-3 text-xs ${TK.notice}`}>
          {t("auditNotice")}
        </div>

        {threads.length === 0 ? (
          <p className={`mt-12 text-center text-sm ${TK.sub}`}>
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
                    className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 transition ${TK.card}`}
                  >
                    <div className="min-w-0">
                      <div className={`truncate text-sm font-medium ${TK.cardLabel}`}>
                        {peer}
                      </div>
                      <div className={`mt-0.5 truncate text-xs ${TK.cardSub}`}>
                        {preview}
                      </div>
                    </div>
                    {th.lastMessageAt && (
                      <time className={`shrink-0 text-[10px] ${TK.cardSub}`}>
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
    </OwnerShell>
  );
}
