import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listVisibleThreads, type ChatViewer } from "@/lib/chat/queries";

// 트레이너 영역 공용 "홈으로 →" 버튼 스타일. 네모(rounded-md) + 우측 화살표.
// 라벨은 common.home (ko: "홈으로 →" / en: "Home →"). 모든 트레이너 db 진입
// 페이지에서 동일 className 사용.
const TRAINER_HOME_BTN =
  "shrink-0 rounded-md border border-white/15 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white";

// V8 Sunset Gradient — DashboardTrainer 와 같은 톤 (purple → sunset orange/pink
// 라디얼 backdrop + 그라데 ring 카드). sidebar 없음, 모바일 우선.

type Props = {
  lang: string;
  slug: string;
  businessName: string;
  trainerName: string;
  viewer: ChatViewer;
};

export async function TrainerChatList({
  lang,
  slug,
  businessName,
  trainerName,
  viewer,
}: Props) {
  const t = await getTranslations("chat");
  const tc = await getTranslations("common");
  const threads = await listVisibleThreads(viewer);

  const items = threads.map((th) => {
    const lastMsg = th.messages[0] ?? null;
    const myReadId = th.reads[0]?.lastReadMessageId ?? null;
    const hasUnread = lastMsg
      ? lastMsg.senderId !== viewer.id &&
        lastMsg.deletedAt == null &&
        (myReadId == null || lastMsg.id > myReadId)
      : false;
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
      label: th.customer.name,
      preview,
      hasUnread,
      lastMessageAt: th.lastMessageAt,
    };
  });

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-x-0 -top-20 h-[40rem] bg-gradient-to-b from-purple-700/30 via-pink-500/15 to-transparent" />
      <div className="pointer-events-none absolute -right-40 top-1/4 h-[28rem] w-[28rem] rounded-full bg-orange-500/25 blur-3xl" />
      <div className="pointer-events-none absolute -left-32 bottom-0 h-[26rem] w-[26rem] rounded-full bg-fuchsia-600/20 blur-3xl" />

      <header className="relative flex items-center justify-between gap-2 border-b border-white/5 px-4 py-3 backdrop-blur-sm">
        <div className="shrink-0 text-xs text-zinc-500">{trainerName}</div>
        <h1 className="min-w-0 flex-1 truncate text-center font-heading text-sm font-semibold">
          <span className="mr-2 bg-gradient-to-r from-orange-300 to-pink-300 bg-clip-text text-transparent">
            {businessName}
          </span>
          <span className="text-white">{t("title")}</span>
        </h1>
        <Link
          href={`/${lang}/g/${slug}/dashboard`}
          className={TRAINER_HOME_BTN}
        >
          {tc("home")}
        </Link>
      </header>

      <main className="relative flex-1 px-4 py-5">
        {items.length === 0 ? (
          <p className="mt-16 text-center text-sm text-zinc-500">
            {t("emptyList")}
          </p>
        ) : (
          <ul className="mx-auto flex max-w-2xl flex-col gap-2">
            {items.map((it) => (
              <li key={it.id}>
                <Link
                  href={`/${lang}/g/${slug}/chat/${it.id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-900/80 px-4 py-3 ring-1 ring-white/5 backdrop-blur transition hover:ring-orange-400/40"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-white">
                        {it.label}
                      </span>
                      {it.hasUnread && (
                        <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-gradient-to-r from-orange-500 to-pink-500" />
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-zinc-400">
                      {it.preview}
                    </div>
                  </div>
                  {it.lastMessageAt && (
                    <time className="shrink-0 text-[10px] text-zinc-500">
                      {formatRelative(it.lastMessageAt)}
                    </time>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="relative border-t border-white/5 px-5 py-4 text-center text-[11px] text-zinc-500">
        예약가즈아 · /g/{slug}
      </footer>
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
