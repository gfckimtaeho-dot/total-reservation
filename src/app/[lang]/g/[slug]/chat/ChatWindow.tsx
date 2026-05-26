"use client";

// 메시지 표시 + 입력 + 폴링 + 자동 markRead.
// 운영(다크 Sunset Gradient) / 고객(라이트 V18 Sunset Peach) 두 톤 지원.
//
// 폴링 5초(탭 visible) / 30초(hidden). 마지막 messageId 이후만 incremental fetch.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations, useLocale } from "next-intl";
import { sendMessage, markRead } from "@/lib/chat/actions";

type Tone = "dark" | "light";

type Msg = {
  id: string;
  senderId: string;
  body: string;
  system: boolean;
  deletedAt: Date | string | null;
  sentAt: Date | string;
};

type Props = {
  slug: string;
  threadId: string;
  initialMessages: Msg[];
  myUserId: string;
  canSend: boolean;
  closedAt: Date | string | null;
  tone: Tone;
  channelLabel: string;
};

const MAX_BODY = 1000;

export function ChatWindow({
  slug,
  threadId,
  initialMessages,
  myUserId,
  canSend,
  closedAt,
  tone,
  channelLabel,
}: Props) {
  const t = useTranslations("chat");
  const locale = useLocale();
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 자동 스크롤 — 새 메시지가 추가될 때 항상 바닥.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // 초기 mount 시 markRead.
  useEffect(() => {
    void markRead({ slug, threadId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 폴링 — afterId 이후 incremental fetch.
  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const last = messagesLastIdRef.current;
        const url =
          `/api/chat/threads/${encodeURIComponent(threadId)}/messages` +
          (last ? `?afterId=${encodeURIComponent(last)}` : "");
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) {
          const j = (await res.json()) as { messages: Msg[] };
          if (!cancelled && j.messages.length > 0) {
            setMessages((prev) => mergeMessages(prev, j.messages));
            void markRead({ slug, threadId });
          }
        }
      } catch {
        // 무시 — 다음 tick 에서 재시도.
      }
      if (cancelled) return;
      const delay = document.visibilityState === "visible" ? 5000 : 30000;
      pollTimerRef.current = setTimeout(tick, delay);
    }
    pollTimerRef.current = setTimeout(tick, 5000);
    return () => {
      cancelled = true;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [threadId, slug]);

  // afterId 추적용 ref (state 의존성에서 분리).
  const messagesLastIdRef = useRef<string | null>(
    messages.length > 0 ? (messages[messages.length - 1]!.id ?? null) : null,
  );
  useEffect(() => {
    messagesLastIdRef.current =
      messages.length > 0 ? (messages[messages.length - 1]!.id ?? null) : null;
  }, [messages]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (sending || !canSend) return;
    const body = input.trim();
    if (!body) return;
    if (body.length > MAX_BODY) {
      setError(t("lengthCap"));
      return;
    }
    setSending(true);
    setError(null);
    const res = await sendMessage({ slug, threadId, body });
    setSending(false);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    setInput("");
    // 즉시 한 번 더 polling 트리거 — 본인 발신 메시지를 빠르게 보여주기.
    try {
      const last = messagesLastIdRef.current;
      const url =
        `/api/chat/threads/${encodeURIComponent(threadId)}/messages` +
        (last ? `?afterId=${encodeURIComponent(last)}` : "");
      const r = await fetch(url, { cache: "no-store" });
      if (r.ok) {
        const j = (await r.json()) as { messages: Msg[] };
        if (j.messages.length > 0) {
          setMessages((prev) => mergeMessages(prev, j.messages));
        }
      }
    } catch {
      // 무시.
    }
  }


  const palette = TONE[tone];
  const isReadOnly = !canSend && !closedAt;

  return (
    <div className={`flex h-full flex-col ${palette.shell}`}>
      <div
        ref={scrollRef}
        className={`flex-1 overflow-y-auto px-4 py-4 ${palette.scrollbg}`}
      >
        {messages.length === 0 ? (
          <p className={`mt-12 text-center text-sm ${palette.empty}`}>
            {t("emptyMessages")}
          </p>
        ) : (
          <ul className="mx-auto flex max-w-2xl flex-col gap-2">
            {messages.flatMap((m, i) => {
              const sent =
                m.sentAt instanceof Date ? m.sentAt : new Date(m.sentAt);
              const prev = i > 0 ? messages[i - 1]! : null;
              const prevSent = prev
                ? prev.sentAt instanceof Date
                  ? prev.sentAt
                  : new Date(prev.sentAt)
                : null;
              const showDate = !prevSent || !sameDay(prevSent, sent);
              const nodes: ReactNode[] = [];
              if (showDate) {
                nodes.push(
                  <DateDivider
                    key={`d-${m.id}`}
                    date={sent}
                    locale={locale}
                    palette={palette}
                  />,
                );
              }
              nodes.push(
                <MessageRow
                  key={m.id}
                  msg={m}
                  mine={m.senderId === myUserId}
                  palette={palette}
                />,
              );
              return nodes;
            })}
          </ul>
        )}
      </div>

      {error && (
        <div
          className={`px-4 py-2 text-xs ${palette.error}`}
          role="alert"
        >
          {error}
        </div>
      )}

      {closedAt ? (
        <div className={`border-t px-4 py-3 text-center text-xs ${palette.notice}`}>
          {t("closedNotice")}
        </div>
      ) : isReadOnly ? (
        <div className={`border-t px-4 py-3 text-center text-xs ${palette.notice}`}>
          {t("readOnlyNotice")}
          <span className={`ml-2 ${palette.noticeAside}`}>· {channelLabel}</span>
        </div>
      ) : (
        <form
          onSubmit={onSend}
          className={`flex items-end gap-2 border-t px-3 py-3 ${palette.formBorder}`}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("placeholder")}
            rows={1}
            maxLength={MAX_BODY}
            disabled={sending}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onSend(e as unknown as React.FormEvent);
              }
            }}
            className={`max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-lg px-3 py-2 text-sm outline-none ${palette.input}`}
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition ${palette.send} disabled:opacity-50`}
          >
            {sending ? t("sending") : t("send")}
          </button>
        </form>
      )}
    </div>
  );
}

function MessageRow({
  msg,
  mine,
  palette,
}: {
  msg: Msg;
  mine: boolean;
  palette: (typeof TONE)[Tone];
}) {
  const sent = msg.sentAt instanceof Date ? msg.sentAt : new Date(msg.sentAt);

  if (msg.system) {
    // front desk 발 메시지 — 받은 메시지로 분류. 짧은/긴 본문 모두 자연스럽게
    // 처리하려면 rounded-full 알약(짧은 단일 행 전용) 대신 rounded-2xl + max-w
    // + break-words. 시간은 우측 아래(받은 메시지 패턴).
    return (
      <li className="flex justify-start">
        <div className="flex max-w-[85%] flex-col">
          <div
            className={`rounded-2xl px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap break-words ${palette.system}`}
          >
            {msg.body}
          </div>
          <time className={`mt-0.5 self-end text-[10px] ${palette.time}`}>
            {formatTime(sent)}
          </time>
        </div>
      </li>
    );
  }

  // 시간은 말풍선 아래(발신자 반대 방향 정렬):
  //   - 받은(왼쪽 말풍선)  → 시간 우측 아래 (self-end)
  //   - 보낸(오른쪽 말풍선) → 시간 좌측 아래 (self-start)
  return (
    <li className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className="flex max-w-[85%] flex-col">
        <div
          className={`rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
            mine ? palette.bubbleMine : palette.bubbleOther
          }`}
        >
          {msg.body}
        </div>
        <time
          className={`mt-0.5 text-[10px] ${palette.time} ${
            mine ? "self-start" : "self-end"
          }`}
        >
          {formatTime(sent)}
        </time>
      </div>
    </li>
  );
}

function formatTime(d: Date): string {
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// 카카오톡 패턴 — 메시지 위에 날짜 구분자. 같은 날 메시지는 헤더 1개 공유.
// 풀 날짜만 표시 (today/yesterday 상대 라벨 없음) — 회원이 명확히 인지.
function DateDivider({
  date,
  locale,
  palette,
}: {
  date: Date;
  locale: string;
  palette: (typeof TONE)[Tone];
}) {
  const label = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
  return (
    <li className="my-3 flex justify-center">
      <span className={`text-[11px] ${palette.time}`}>{label}</span>
    </li>
  );
}

function mergeMessages(prev: Msg[], incoming: Msg[]): Msg[] {
  const ids = new Set(prev.map((m) => m.id));
  const news = incoming.filter((m) => !ids.has(m.id));
  if (news.length === 0) return prev;
  // 들어오는 메시지가 asc 정렬 (afterId fetch) — 그대로 append.
  return [...prev, ...news];
}

// V8 (트레이너/OWNER 운영) = 다크 + sunset gradient.
// V18 (고객) = 라이트 + orange/rose/amber.
const TONE: Record<
  Tone,
  {
    shell: string;
    scrollbg: string;
    empty: string;
    error: string;
    notice: string;
    noticeAside: string;
    formBorder: string;
    input: string;
    send: string;
    system: string;
    bubbleMine: string;
    bubbleOther: string;
    time: string;
  }
> = {
  dark: {
    shell: "bg-zinc-950 text-zinc-100",
    scrollbg: "bg-zinc-950",
    empty: "text-zinc-500",
    error: "bg-rose-950/40 text-rose-200",
    notice: "border-white/10 text-zinc-400",
    noticeAside: "text-zinc-500",
    formBorder: "border-white/10 bg-zinc-950",
    input:
      "bg-zinc-900 text-zinc-100 ring-1 ring-white/10 placeholder:text-zinc-500 focus:ring-orange-400/50",
    send:
      "bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-md shadow-orange-500/20 hover:from-orange-400 hover:to-pink-400",
    system: "bg-white/5 text-zinc-300 ring-1 ring-white/10",
    bubbleMine: "bg-gradient-to-br from-orange-500 to-pink-500 text-white",
    bubbleOther: "bg-zinc-800 text-zinc-100 ring-1 ring-white/5",
    time: "text-zinc-500",
  },
  light: {
    shell: "bg-white text-zinc-900",
    scrollbg: "bg-orange-50/30",
    empty: "text-zinc-400",
    error: "bg-rose-50 text-rose-700",
    notice: "border-orange-200 bg-orange-50/50 text-zinc-600",
    noticeAside: "text-zinc-400",
    formBorder: "border-orange-200 bg-white",
    input:
      "bg-orange-50/40 text-zinc-900 ring-1 ring-orange-200 placeholder:text-zinc-400 focus:ring-orange-400",
    send:
      "bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-sm hover:from-orange-400 hover:to-rose-400",
    system: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
    bubbleMine: "bg-gradient-to-br from-orange-500 to-rose-500 text-white",
    bubbleOther: "bg-white text-zinc-900 ring-1 ring-orange-200",
    time: "text-zinc-400",
  },
};
