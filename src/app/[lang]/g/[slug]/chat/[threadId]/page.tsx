import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireGymStaff } from "@/lib/auth/dal";
import { getThreadForViewer, type ChatViewer } from "@/lib/chat/queries";
import { ChatWindow } from "../ChatWindow";
import { TrainerChatThreadView } from "../TrainerChatThreadView";

const TK = {
  page: "bg-violet-50/40",
  header: "bg-white border-b border-violet-100",
  title: "text-ink",
  back: "text-ink/60 hover:text-ink",
  sub: "text-ink/50",
} as const;

export default async function ChatThreadPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string; threadId: string }>;
}) {
  const { lang, slug, threadId } = await params;
  const auth = await requireGymStaff(slug);
  const business = auth.business!;
  const t = await getTranslations("chat");

  const viewer: ChatViewer = {
    id: auth.id,
    gymId: business.id,
    role: auth.role,
  };
  const data = await getThreadForViewer(viewer, threadId);
  if (!data) notFound();

  // ChatWindow 직렬화 — Date → ISO.
  const serialized = data.messages.map((m) => ({
    id: m.id,
    senderId: m.senderId,
    body: m.body,
    system: m.system,
    deletedAt: m.deletedAt ? m.deletedAt.toISOString() : null,
    sentAt: m.sentAt.toISOString(),
  }));
  const closedAt = data.thread.closedAt
    ? data.thread.closedAt.toISOString()
    : null;

  // TRAINER 는 V8 풀스크린 다크 (sidebar 없음).
  if (auth.role === "TRAINER") {
    return (
      <TrainerChatThreadView
        lang={lang}
        slug={slug}
        threadId={data.thread.id}
        myUserId={auth.id}
        customerName={data.thread.customer.name}
        closedAt={closedAt}
        canSend={data.canSend}
        messages={serialized}
      />
    );
  }

  // OWNER/MANAGER — White Pastel 헤더 + read-only 가능 (STORE 발신, TRAINER audit).
  const peerLabel =
    data.thread.kind === "TRAINER"
      ? `${data.thread.customer.name} ↔ ${data.thread.staffUser?.name ?? t("channels.unassigned")}`
      : `${data.thread.customer.name} · ${t("channels.storeShort")}`;

  return (
    <div className={`flex min-h-screen flex-col ${TK.page}`}>
      <header className={`${TK.header} px-4 py-3`}>
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Link
            href={`/${lang}/g/${slug}/chat`}
            className={`shrink-0 text-xs ${TK.back}`}
          >
            {t("back")}
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <h1 className={`truncate text-sm font-semibold ${TK.title}`}>
              {peerLabel}
            </h1>
            <p className={`text-[10px] ${TK.sub}`}>
              {data.thread.kind === "TRAINER" ? "1:1 PT" : "매장 채팅"}
            </p>
          </div>
          <Link
            href={`/${lang}/g/${slug}/dashboard`}
            className="shrink-0 rounded-full px-3 py-1.5 text-xs ring-1 transition bg-white text-ink ring-ink/10 hover:bg-orange-50"
          >
            {t("home")}
          </Link>
        </div>
      </header>

      <div className="flex-1">
        <ChatWindow
          slug={slug}
          threadId={data.thread.id}
          initialMessages={serialized}
          myUserId={auth.id}
          canSend={data.canSend}
          closedAt={closedAt}
          tone="light"
          channelLabel={t("auditNotice")}
        />
      </div>
    </div>
  );
}
