"use client";

import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { meCalendarMonth } from "./actions";
import { MeDaySheet } from "./MeDaySheet";
import type { MeCalendarMonth, MeCalCell } from "@/lib/calendar/meCalendar";

const WD_KO = ["일", "월", "화", "수", "목", "금", "토"];
const WD_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function hm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(
    min % 60,
  ).padStart(2, "0")}`;
}

// 고객 대시보드 월간 캘린더. 각 날짜 칸에 본인 예약 칩 + 단체수업 마커.
//  - 휴무일은 회색 배경 + "휴무" 라벨로 또렷하게 표시.
//  - 미래에 단체수업(보유 단체권 한정)이 열리는 날은 우상단 점 마커.
//  - 날짜 클릭 -> 데이 시트(MeDaySheet): 과거/오늘은 예약 보기, 미래는 예약.
export function MeCalendar({
  slug,
  lang,
  initial,
  todayKey,
  maxBookKey,
}: {
  slug: string;
  lang: string;
  initial: MeCalendarMonth;
  todayKey: string;
  maxBookKey: string;
}) {
  const t = useTranslations("me");
  const [data, setData] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [openCell, setOpenCell] = useState<MeCalCell | null>(null);

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

  // 클릭 가능 여부 — 미래는 항상, 과거/오늘은 예약이 있을 때만.
  function clickableOf(c: MeCalCell): boolean {
    if (!c.isCurrentMonth) return false;
    const isFuture = !c.isPast && !c.isToday;
    return isFuture || c.events.length > 0;
  }

  function relOf(c: MeCalCell): "past" | "today" | "future" {
    if (c.isToday) return "today";
    return c.isPast ? "past" : "future";
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

      {/* 날짜 그리드 */}
      <div
        className={
          "mt-1 grid grid-cols-7 gap-1 transition-opacity " +
          (pending ? "opacity-50" : "")
        }
      >
        {data.cells.map((c) => (
          <Cell
            key={c.dayKey}
            c={c}
            clickable={clickableOf(c)}
            closedLabel={t("legendClosed")}
            onClick={() => clickableOf(c) && setOpenCell(c)}
          />
        ))}
      </div>

      {openCell && (
        <MeDaySheet
          slug={slug}
          lang={lang}
          cell={openCell}
          rel={relOf(openCell)}
          withinHorizon={
            openCell.dayKey >= todayKey && openCell.dayKey <= maxBookKey
          }
          onClose={() => setOpenCell(null)}
        />
      )}
    </section>
  );
}

function Cell({
  c,
  clickable,
  closedLabel,
  onClick,
}: {
  c: MeCalCell;
  clickable: boolean;
  closedLabel: string;
  onClick: () => void;
}) {
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

  const isFuture = !c.isPast && !c.isToday;
  // 휴무일은 회색 배경 + "휴무" 라벨로 또렷하게. 오늘은 로즈 테두리.
  const containerCls = c.isToday
    ? "border-rose-400/70 bg-rose-400/5"
    : !c.isOpen
      ? "border-white/5 bg-zinc-700/25"
      : "border-white/10";

  const dayCls = c.isToday
    ? "font-bold text-rose-300"
    : !c.isOpen
      ? "text-zinc-500"
      : c.isPast
        ? "text-zinc-500"
        : "text-zinc-200";

  // 미래 영업일에 단체수업이 열리는 날 — 우상단 점 마커.
  // (휴무일엔 "휴무" 라벨이 뜨므로 점은 생략 — 모순 방지.)
  const showGroupDot = isFuture && c.isOpen && c.groupClasses.length > 0;

  return (
    <div
      onClick={onClick}
      className={
        "relative min-h-[76px] rounded-md border p-1 " +
        containerCls +
        (clickable
          ? " cursor-pointer transition hover:border-rose-300/50"
          : "")
      }
    >
      <div className="flex items-start justify-between">
        <div className={"text-[11px] leading-none tabular-nums " + dayCls}>
          {c.day}
        </div>
        {showGroupDot && (
          <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
        )}
      </div>

      {!c.isOpen ? (
        <div className="mt-2 text-center text-[10px] text-zinc-500">
          {closedLabel}
        </div>
      ) : (
        <div className="mt-1 space-y-1">
          {c.events.map((ev) => (
            <div
              key={ev.id}
              className={
                "rounded px-0.5 py-1 text-center leading-tight " +
                (ev.kind === "pt"
                  ? "bg-sky-500/90"
                  : "bg-emerald-500/90")
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
      )}
    </div>
  );
}
