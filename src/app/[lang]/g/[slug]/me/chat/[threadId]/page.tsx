import type { Viewport } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireGymCustomer } from "@/lib/auth/dal";
import { getThreadForViewer, type ChatViewer } from "@/lib/chat/queries";
import { ChatWindow } from "../../../chat/ChatWindow";

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default async function CustomerChatThreadPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string; threadId: string }>;
}) {
  const { lang, slug, threadId } = await params;
  const user = await requireGymCustomer(slug);
  const business = user.business!;
  const t = await getTranslations("chat");

  const viewer: ChatViewer = {
    id: user.id,
    gymId: business.id,
    role: user.role,
  };
  const data = await getThreadForViewer(viewer, threadId);
  if (!data) notFound();

  const peerLabel =
    data.thread.kind === "TRAINER"
      ? t("channels.trainer", {
          name: data.thread.staffUser?.name ?? t("channels.unassigned"),
        })
      : t("channels.store", { business: business.name });

  const serialized = data.messages.map((m) => ({
    id: m.id,
    senderId: m.senderId,
    body: m.body,
    system: m.system,
    deletedAt: m.deletedAt ? m.deletedAt.toISOString() : null,
    sentAt: m.sentAt.toISOString(),
  }));

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="bg-white px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <Link
            href={`/${lang}/g/${slug}/me/chat`}
            className="shrink-0 text-xs text-zinc-500 hover:text-zinc-900"
          >
            {t("back")}
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-center bg-gradient-to-r from-orange-500 to-rose-500 bg-clip-text text-sm font-semibold text-transparent">
            {peerLabel}
          </h1>
          <Link
            href={`/${lang}/g/${slug}/me`}
            className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-orange-600 ring-1 ring-orange-200 transition hover:ring-orange-400"
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
          myUserId={user.id}
          canSend={data.canSend}
          closedAt={data.thread.closedAt ? data.thread.closedAt.toISOString() : null}
          tone="light"
          channelLabel={peerLabel}
        />
      </div>
    </div>
  );
}
