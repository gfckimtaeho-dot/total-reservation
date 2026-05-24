import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChatWindow } from "./ChatWindow";

// 트레이너 db 공통 홈 버튼 스타일 — TrainerChatList 와 동일 정의.
const TRAINER_HOME_BTN =
  "shrink-0 rounded-md border border-white/15 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white";

// V8 Sunset Gradient 톤 — DashboardTrainer 와 일관. 라디얼 backdrop + 풀스크린.

type SerializedMsg = {
  id: string;
  senderId: string;
  body: string;
  system: boolean;
  deletedAt: string | null;
  sentAt: string;
};

type Props = {
  lang: string;
  slug: string;
  threadId: string;
  myUserId: string;
  customerName: string;
  closedAt: string | null;
  canSend: boolean;
  messages: SerializedMsg[];
};

export async function TrainerChatThreadView({
  lang,
  slug,
  threadId,
  myUserId,
  customerName,
  closedAt,
  canSend,
  messages,
}: Props) {
  const t = await getTranslations("chat");
  const tc = await getTranslations("common");

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-x-0 -top-20 h-[40rem] bg-gradient-to-b from-purple-700/30 via-pink-500/15 to-transparent" />
      <div className="pointer-events-none absolute -right-40 top-1/4 h-[28rem] w-[28rem] rounded-full bg-orange-500/25 blur-3xl" />
      <div className="pointer-events-none absolute -left-32 bottom-0 h-[26rem] w-[26rem] rounded-full bg-fuchsia-600/20 blur-3xl" />

      <header className="relative flex items-center justify-between gap-2 border-b border-white/5 px-4 py-3 backdrop-blur-sm">
        <Link
          href={`/${lang}/g/${slug}/chat`}
          className="shrink-0 text-xs text-zinc-400 hover:text-white"
        >
          {t("back")}
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate font-heading text-sm font-semibold">
            <span className="mr-2 bg-gradient-to-r from-orange-300 to-pink-300 bg-clip-text text-transparent">
              {customerName}
            </span>
          </h1>
          <p className="text-[10px] text-zinc-500">1:1 PT</p>
        </div>
        <Link
          href={`/${lang}/g/${slug}/dashboard`}
          className={TRAINER_HOME_BTN}
        >
          {tc("home")}
        </Link>
      </header>

      <div className="relative flex-1">
        <ChatWindow
          slug={slug}
          threadId={threadId}
          initialMessages={messages}
          myUserId={myUserId}
          canSend={canSend}
          closedAt={closedAt}
          tone="dark"
          channelLabel={customerName}
        />
      </div>
    </div>
  );
}
