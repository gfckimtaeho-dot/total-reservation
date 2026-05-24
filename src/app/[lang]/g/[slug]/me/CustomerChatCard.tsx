"use client";

// 고객 /me 헤더 우측 채팅 진입 알약 — V18 Sunset Peach.
// 아이콘 + 라벨 형태. 폴링으로 unread > 0 감지 → 라벨/색 자동 전환.
// 사용자가 "글자도 없어서 인식 어렵다" 피드백 후 알약 + 라벨로 변경.
//
// unread = 0 : 흰 알약 + orange ring + 라벨 "채팅"
// unread > 0 : orange→rose 솔리드 + 펄스 dot + 라벨 "새 메시지 N개"

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export function CustomerChatCard({ href }: { href: string }) {
  const t = useTranslations("chat");
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function tick() {
      try {
        const res = await fetch("/api/chat/unread", { cache: "no-store" });
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
  const ariaLabel = label;

  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={
        // 아이콘(28px) + text-base 는 유지, padding 만 컴팩트하게 — 알약 폭/높이
        // 만 줄여 헤더에서 차지하는 면적 축소.
        "relative inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-base font-semibold transition active:scale-95 " +
        (has
          ? "bg-gradient-to-br from-orange-500 to-rose-500 text-white shadow-[0_12px_32px_-10px_rgba(249,115,22,0.65)]"
          : "bg-white text-orange-600 ring-2 ring-orange-200 hover:ring-orange-400")
      }
    >
      <svg
        width="28"
        height="28"
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
      <span className="tabular-nums">{label}</span>
      {has && (
        <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 w-5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-75" />
          <span className="relative inline-flex h-5 w-5 rounded-full bg-amber-400 ring-2 ring-white" />
        </span>
      )}
    </Link>
  );
}
