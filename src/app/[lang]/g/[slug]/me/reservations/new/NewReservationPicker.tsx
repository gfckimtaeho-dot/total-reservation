"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createReservation } from "../../actions";
import type { GridDay } from "@/lib/calendar/trainerCalendarPro";

export function NewReservationPicker({
  slug,
  lang,
  packageId,
  days,
  slotAxis,
  dateMode = false,
  todayKey,
  minTodayStartMin,
}: {
  slug: string;
  lang: string;
  packageId: string;
  days: GridDay[];
  slotAxis: number[];
  dateMode?: boolean;
  // 오늘 PT 1시간 버퍼 — 오늘 슬롯 중 이 시작시각 이전은 표시 X.
  todayKey: string;
  minTodayStartMin: number;
}) {
  const t = useTranslations("me");
  const router = useRouter();
  const [chosen, setChosen] = useState<
    | null
    | {
        dayIdx: number;
        slotIdx: number;
      }
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function dayKeyOf(d: GridDay): string {
    return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
  }

  function isSlotPickable(d: GridDay, slotIdx: number, c: GridDay["cells"][number]): boolean {
    if (c.kind !== "free") return false;
    // 오늘은 minTodayStartMin(현재+1h) 이후 슬롯만.
    if (dayKeyOf(d) === todayKey && slotAxis[slotIdx] < minTodayStartMin) {
      return false;
    }
    return true;
  }

  const openDays = useMemo(
    () =>
      days
        .map((d, i) => ({ d, i }))
        .filter(({ d }) => {
          if (d.state !== "open") return false;
          return d.cells.some((c, slotIdx) => isSlotPickable(d, slotIdx, c));
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [days, todayKey, minTodayStartMin],
  );

  function isoFor(d: GridDay, startMin: number): string {
    const h = Math.floor(startMin / 60);
    const m = startMin % 60;
    return new Date(
      Date.UTC(d.year, d.month - 1, d.day, h, m, 0),
    ).toISOString();
  }

  function onSubmit() {
    if (!chosen) return;
    const d = days[chosen.dayIdx];
    const startMin = slotAxis[chosen.slotIdx];
    const iso = isoFor(d, startMin);
    setError(null);
    startTransition(async () => {
      const r = await createReservation(slug, packageId, iso);
      if (r.ok) {
        // 예약 성공 후 메인이 아닌 예약 캘린더로 — 단체수업과 동일하게 현재 화면
        // 유지(또는 한 단계 뒤). 사용자가 "한 번 등록 → 다음 선택" 흐름을 끊지 않음.
        router.push(`/${lang}/g/${slug}/me/calendar`);
        router.refresh();
      } else {
        setError(t("newError"));
      }
    });
  }

  if (openDays.length === 0) {
    return (
      <div className="mt-4 rounded-2xl bg-zinc-50 p-5 text-base text-zinc-600 ring-1 ring-zinc-200">
        {t(dateMode ? "newNoSlotsDate" : "newNoSlots")}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {/* 확인 박스 — 시간 목록 위에 두고 sticky 로 고정. 시간을 고르면
          스크롤 위치와 무관하게 항상 화면에 보인다(아래로 안 찾게). */}
      {chosen && (
        <div className="sticky top-2 z-20 rounded-2xl border border-orange-300 bg-white p-5 shadow-[0_15px_40px_-15px_rgba(249,115,22,0.45)]">
          <div className="text-2xl font-bold tracking-tight text-zinc-900">
            {t("newConfirmTitle")}
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-orange-700">
            {formatChosen(days[chosen.dayIdx], slotAxis[chosen.slotIdx], lang)}
          </div>
          {error && (
            <div className="mt-2 text-sm text-rose-700">{error}</div>
          )}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onSubmit}
              disabled={pending}
              className="rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-6 py-3 text-lg font-bold text-white shadow-[0_8px_20px_-8px_rgba(249,115,22,0.6)] hover:brightness-110 disabled:opacity-60"
            >
              {pending ? t("newSubmitting") : t("newConfirmYes")}
            </button>
            <button
              type="button"
              onClick={() => setChosen(null)}
              disabled={pending}
              className="rounded-full bg-white px-5 py-3 text-lg font-semibold text-zinc-700 ring-1 ring-orange-200 hover:bg-orange-50 disabled:opacity-60"
            >
              {t("moveConfirmNo")}
            </button>
          </div>
        </div>
      )}

      {openDays.map(({ d, i }) => (
        <DayBlock
          key={`${d.year}-${d.month}-${d.day}`}
          d={d}
          dayIdx={i}
          slotAxis={slotAxis}
          chosen={chosen}
          onPick={(slotIdx) => {
            setError(null);
            setChosen({ dayIdx: i, slotIdx });
          }}
          lang={lang}
          isDayToday={dayKeyOf(d) === todayKey}
          minTodayStartMin={minTodayStartMin}
        />
      ))}
    </div>
  );
}

function DayBlock({
  d,
  dayIdx,
  slotAxis,
  chosen,
  onPick,
  lang,
  isDayToday,
  minTodayStartMin,
}: {
  d: GridDay;
  dayIdx: number;
  slotAxis: number[];
  chosen: { dayIdx: number; slotIdx: number } | null;
  onPick: (slotIdx: number) => void;
  lang: string;
  isDayToday: boolean;
  minTodayStartMin: number;
}) {
  const dateLabel = new Intl.DateTimeFormat(
    lang === "en" ? "en-US" : "ko-KR",
    {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      weekday: "short",
    },
  ).format(new Date(Date.UTC(d.year, d.month - 1, d.day, 12, 0, 0)));

  return (
    <div className="rounded-2xl bg-white/70 p-4 ring-1 ring-white/80 backdrop-blur-xl shadow-[0_24px_60px_-30px_rgba(249,115,22,0.45)]">
      <div className="px-1 text-2xl font-bold tracking-tight text-zinc-900">
        {dateLabel}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {d.cells.map((c, slotIdx) => {
          if (c.kind !== "free") return null;
          // 오늘은 1h 버퍼 이전 슬롯 숨김.
          if (isDayToday && slotAxis[slotIdx] < minTodayStartMin) return null;
          const isPicked =
            chosen?.dayIdx === dayIdx && chosen.slotIdx === slotIdx;
          return (
            <button
              key={slotIdx}
              type="button"
              onClick={() => onPick(slotIdx)}
              className={
                "rounded-xl px-4 py-2.5 text-lg font-bold tabular-nums ring-1 transition " +
                (isPicked
                  ? "bg-gradient-to-r from-orange-500 to-rose-500 text-white ring-orange-400 shadow-[0_8px_20px_-8px_rgba(249,115,22,0.6)]"
                  : "bg-white text-zinc-800 ring-orange-200 hover:bg-orange-50 hover:ring-orange-300")
              }
            >
              {formatMin(slotAxis[slotIdx])}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatMin(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function formatChosen(d: GridDay, startMin: number, lang: string): string {
  const date = new Intl.DateTimeFormat(lang === "en" ? "en-US" : "ko-KR", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(new Date(Date.UTC(d.year, d.month - 1, d.day, 12, 0, 0)));
  return `${date} ${formatMin(startMin)}`;
}
