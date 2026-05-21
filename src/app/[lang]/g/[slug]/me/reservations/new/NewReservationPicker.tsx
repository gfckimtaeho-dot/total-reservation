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
}: {
  slug: string;
  lang: string;
  packageId: string;
  days: GridDay[];
  slotAxis: number[];
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

  const openDays = useMemo(
    () =>
      days
        .map((d, i) => ({ d, i }))
        .filter(({ d }) => {
          if (d.state !== "open") return false;
          return d.cells.some((c) => c.kind === "free");
        }),
    [days],
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
        router.push(`/${lang}/g/${slug}/me`);
        router.refresh();
      } else {
        setError(t("newError"));
      }
    });
  }

  if (openDays.length === 0) {
    return (
      <div className="mt-4 rounded-md bg-zinc-900/80 p-4 text-sm text-zinc-400 ring-1 ring-zinc-800">
        {t("newNoSlots")}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
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
        />
      ))}

      {chosen && (
        <div className="mt-4 rounded-md border border-rose-300/40 bg-zinc-900/80 p-4 backdrop-blur">
          <div className="font-medium text-zinc-100">
            {t("newConfirmTitle")}
          </div>
          <div className="mt-1 text-xs text-zinc-400">
            {formatChosen(days[chosen.dayIdx], slotAxis[chosen.slotIdx], lang)}
          </div>
          {error && (
            <div className="mt-2 text-xs text-rose-400">{error}</div>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onSubmit}
              disabled={pending}
              className="rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_4px_18px_-6px_rgba(251,146,60,0.6)] hover:brightness-110 disabled:opacity-60"
            >
              {pending ? t("newSubmitting") : t("newConfirmYes")}
            </button>
            <button
              type="button"
              onClick={() => setChosen(null)}
              disabled={pending}
              className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-zinc-200 ring-1 ring-white/15 hover:bg-white/10 disabled:opacity-60"
            >
              {t("moveConfirmNo")}
            </button>
          </div>
        </div>
      )}
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
}: {
  d: GridDay;
  dayIdx: number;
  slotAxis: number[];
  chosen: { dayIdx: number; slotIdx: number } | null;
  onPick: (slotIdx: number) => void;
  lang: string;
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
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur">
      <div className="px-1 text-xs font-semibold text-zinc-200">
        {dateLabel}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {d.cells.map((c, slotIdx) => {
          if (c.kind !== "free") return null;
          const isPicked =
            chosen?.dayIdx === dayIdx && chosen.slotIdx === slotIdx;
          return (
            <button
              key={slotIdx}
              type="button"
              onClick={() => onPick(slotIdx)}
              className={
                "rounded-md px-3 py-1.5 text-xs font-medium tabular-nums ring-1 transition " +
                (isPicked
                  ? "bg-gradient-to-br from-orange-500/30 to-purple-500/30 text-white ring-pink-300"
                  : "bg-white/5 text-zinc-100 ring-white/15 hover:bg-rose-300/15 hover:ring-rose-300")
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
