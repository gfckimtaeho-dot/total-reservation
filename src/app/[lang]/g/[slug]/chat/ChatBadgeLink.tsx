"use client";

// 채팅 진입 알약(pill) 버튼 — 아이콘 + 라벨. /api/chat/unread 5초 폴링.
// 트레이너 dashboard (V8 Sunset Gradient) 헤더에 사용.
//
// unread = 0 : 차분한 amber/orange 톤 + 라벨 "채팅"
// unread > 0 : amber→orange 솔리드 + 펄스 dot + 라벨 "새 메시지 N개"
//
// label prop 제거 — chat.title / chat.newMessages 를 자체 i18n.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

type Tone = "dark" | "light" | "amberLight";

export function ChatBadgeLink({
  href,
  tone,
  fullWidth = false,
}: {
  href: string;
  tone: Tone;
  fullWidth?: boolean;
}) {
  const t = useTranslations("chat");
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function tick() {
      try {
        const res = await fetch("/api/chat/unread", { cache: "no-store" });
        // 401 = 세션 끊김 (logout 직후). 무한 polling 도배 방지 위해 즉시 중단.
        // 자세한 이유는 CustomerChatCard 의 같은 분기 코멘트 참고.
        if (res.status === 401) return;
        if (res.ok) {
          const j = (await res.json()) as { total: number };
          if (!cancelled) setUnread(j.total);
        }
      } catch {
        // 무시 — 다음 tick 에서 재시도.
      }
      if (cancelled) return;
      const delay = document.visibilityState === "visible" ? 5000 : 30000;
      timer = setTimeout(tick, delay);
    }
    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const has = unread > 0;
  const label = has ? t("newMessages", { count: unread }) : t("title");
  const tk = STYLE[tone][has ? "active" : "idle"];
  const layout = fullWidth
    ? "relative flex w-full items-center justify-center gap-2"
    : "relative inline-flex items-center gap-2";

  return (
    <Link href={href} className={`${layout} ${tk}`}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <span>{label}</span>
      {has && <PulseDot tone={tone} />}
    </Link>
  );
}

function PulseDot({ tone }: { tone: Tone }) {
  // 우상단 dot — animate-ping 확산 ring + 작은 dot 한 점. 숫자는 라벨에 포함했으니
  // 여기는 시선 끌림용 시각 신호만.
  const ring = tone === "dark" ? "ring-zinc-950" : "ring-white";
  return (
    <span className="absolute -right-1 -top-1 inline-flex h-3 w-3">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-75" />
      <span
        className={`relative inline-flex h-3 w-3 rounded-full bg-amber-400 ring-2 ${ring}`}
      />
    </span>
  );
}

// idle = unread 0 (차분), active = unread > 0 (강조).
const STYLE: Record<Tone, { idle: string; active: string }> = {
  dark: {
    idle:
      "rounded-full bg-gradient-to-r from-amber-500/25 to-orange-500/25 px-4 py-2.5 text-sm font-semibold text-amber-100 ring-1 ring-amber-400/40 transition hover:from-amber-500/35 hover:to-orange-500/35",
    active:
      "rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2.5 text-sm font-bold text-zinc-950 shadow-[0_8px_22px_-8px_rgba(245,158,11,0.65)] ring-1 ring-amber-300 transition hover:brightness-110",
  },
  light: {
    idle:
      "rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-zinc-900 ring-1 ring-orange-200 transition hover:ring-orange-400",
    active:
      "rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 px-4 py-3 text-sm font-bold text-white shadow-[0_15px_40px_-15px_rgba(249,115,22,0.55)] transition hover:brightness-110",
  },
  amberLight: {
    idle:
      "rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-zinc-900 ring-1 ring-orange-200 transition hover:ring-orange-400",
    active:
      "rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 px-4 py-3 text-sm font-bold text-white shadow-[0_15px_40px_-15px_rgba(249,115,22,0.55)] transition hover:brightness-110",
  },
};
