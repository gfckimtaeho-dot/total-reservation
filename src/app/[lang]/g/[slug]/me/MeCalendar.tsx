"use client";

import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { meCalendarMonth } from "./actions";
import type { MeCalendarMonth, MeCalCell } from "@/lib/calendar/meCalendar";

const WD_KO = ["일", "월", "화", "수", "목", "금", "토"];
const WD_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function hm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(
    min % 60,
  ).padStart(2, "0")}`;
}

// 고객 대시보드 월간 캘린더 — 현재 달만. 각 날짜 칸에 그날 예약(PT/단체)을
// 칩으로 표시해 달력에서 바로 일정을 파악한다. 월 네비는 서버 액션으로
// 그 달 셀만 받아와 페이지 전체 리로드 없이 갱신.
export function MeCalendar({
  slug,
  lang,
  initial,
}: {
  slug: string;
  lang: string;
  initial: MeCalendarMonth;
}) {
  const t = useTranslations("me");
  const [data, setData] = useState(initial);
  const [pending, startTransition] = useTransition();

  function go(delta: number) {
    let y = data.year;
    let m = data.month + delta;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    startTransition(async () => {
      setData(await meCalendarMonth(slug, y, m));
    });
  }

  const monthLabel = new Intl.DateTimeFormat(
    lang === "en" ? "en-US" : "ko-KR",
    { timeZone: "UTC", year: "numeric", month: "long" },
  ).format(new Date(Date.UTC(data.year, data.month - 1, 1)));

  const WD = lang === "en" ? WD_EN : WD_KO;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
      {/* 월 네비 — 화살표 버튼 가로로 넓게(탭 쉽게) */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={pending}
          aria-label={t("calPrevMonth")}
          className="flex h-9 min-w-[72px] items-center justify-center rounded-lg border border-white/15 bg-white/5 text-zinc-200 transition hover:bg-white/10 active:scale-95 disabled:opacity-40"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="font-heading text-base tracking-tight text-white">
          {monthLabel}
        </div>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={pending}
          aria-label={t("calNextMonth")}
          className="flex h-9 min-w-[72px] items-center justify-center rounded-lg border border-white/15 bg-white/5 text-zinc-200 transition hover:bg-white/10 active:scale-95 disabled:opacity-40"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* 요일 행 */}
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-zinc-400">
        {WD.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      {/* 날짜 그리드 — 칸마다 그날 예약 칩 */}
      <div
        className={
          "mt-1 grid grid-cols-7 gap-1 transition-opacity " +
          (pending ? "opacity-50" : "")
        }
      >
        {data.cells.map((c) => (
          <Cell key={c.dayKey} c={c} />
        ))}
      </div>
    </section>
  );
}

function Cell({ c }: { c: MeCalCell }) {
  // 다른 달(앞뒤 패딩) 칸 — 날짜만 흐리게.
  if (!c.isCurrentMonth) {
    return (
      <div className="min-h-[76px] rounded-md border border-white/5 p-1">
        <div className="text-[11px] leading-none tabular-nums text-zinc-700">
          {c.day}
        </div>
      </div>
    );
  }

  // 오늘은 채움색 아닌 테두리로 구분. 휴무일은 날짜 회색(부정 이미지).
  const dayCls = c.isToday
    ? "font-bold text-rose-300"
    : !c.isOpen
      ? "text-zinc-600"
      : c.isPast
        ? "text-zinc-500"
        : "text-zinc-200";

  return (
    <div
      className={
        "min-h-[76px] rounded-md border p-1 " +
        (c.isToday ? "border-rose-400/70 bg-rose-400/5" : "border-white/10")
      }
    >
      <div className={"text-[11px] leading-none tabular-nums " + dayCls}>
        {c.day}
      </div>
      {/* 예약 칩 — 위: PT/수업명, 아래: 시간. 칸이 길어져도 칩을 키운다.
          events 는 로더에서 이미 시간순 정렬됨. */}
      <div className="mt-1 space-y-1">
        {c.events.map((ev, i) => (
          <div
            key={i}
            className={
              "rounded px-0.5 py-1 text-center leading-tight " +
              (ev.kind === "pt" ? "bg-sky-500/90" : "bg-emerald-500/90")
            }
          >
            <div className="truncate text-[11px] font-bold text-white">
              {ev.label}
            </div>
            <div className="text-[10px] tabular-nums text-white/90">
              {hm(ev.startMin)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
