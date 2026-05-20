"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { joinScheduledClass } from "./actions";

export type Occurrence = {
  scheduleId: string;
  year: number;
  month: number;
  day: number;
  weekdayIdx: number;
  startMin: number;
  durationMin: number;
  serviceName: string;
  staffName: string | null;
  capacity: number;
  enrolled: number;
  joined: boolean;
};

// 단체 수업 occurrence 14일치 리스트 + 등록 액션.
// V5 글래스 + purple 톤(고객 대시보드의 "단체" 색)과 일치.
export function ClassOccurrenceList({
  slug,
  lang,
  occurrences,
}: {
  slug: string;
  lang: string;
  occurrences: Occurrence[];
}) {
  const t = useTranslations("me");
  const router = useRouter();
  const [confirming, setConfirming] = useState<null | Occurrence>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onJoinClick(o: Occurrence) {
    setError(null);
    setConfirming(o);
  }

  function onConfirm() {
    if (!confirming) return;
    const o = confirming;
    setError(null);
    startTransition(async () => {
      const r = await joinScheduledClass(
        slug,
        o.scheduleId,
        o.year,
        o.month,
        o.day,
      );
      if (r.ok) {
        setConfirming(null);
        router.refresh();
      } else {
        setError(t("classJoinError"));
      }
    });
  }

  return (
    <section className="rounded-2xl border border-purple-400/20 bg-white/5 p-5 backdrop-blur-xl">
      <div className="flex items-baseline justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-purple-200/90">
          {t("classesScheduleTitle")}
        </div>
        <div className="text-[10px] text-zinc-400">
          {t("classesScheduleHint")}
        </div>
      </div>

      {occurrences.length === 0 ? (
        <div className="mt-3 text-sm text-zinc-400">
          {t("classesScheduleNone")}
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {occurrences.map((o) => {
            const key = `${o.scheduleId}-${o.year}-${o.month}-${o.day}`;
            const time = fmtMin(o.startMin);
            const dateLabel = formatDateLabel(
              o.year,
              o.month,
              o.day,
              o.weekdayIdx,
              lang,
            );
            const isFull = o.enrolled >= o.capacity;
            const canJoin = !o.joined && !isFull;
            return (
              <li
                key={key}
                className="rounded-xl border border-purple-300/20 bg-purple-500/10 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-baseline gap-3">
                    <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-200 ring-1 ring-purple-400/40">
                      {t("legendGroup")}
                    </span>
                    <span className="font-heading text-base tabular-nums text-white">
                      {dateLabel} {time}
                    </span>
                    <span className="text-sm text-zinc-200">
                      {o.serviceName}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs tabular-nums text-zinc-400">
                      {t("classCapacity", {
                        enrolled: o.enrolled,
                        capacity: o.capacity,
                      })}
                    </span>
                    {o.joined ? (
                      <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-400/40">
                        {t("classJoinedBadge")}
                      </span>
                    ) : isFull ? (
                      <span className="rounded-full bg-zinc-700/50 px-3 py-1 text-xs font-semibold text-zinc-400 ring-1 ring-white/10">
                        {t("classFullBadge")}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onJoinClick(o)}
                        className="rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-1 text-xs font-semibold text-white shadow-[0_4px_14px_-6px_rgba(168,85,247,0.6)] hover:brightness-110"
                      >
                        {t("classJoinBtn")}
                      </button>
                    )}
                  </div>
                </div>
                {o.staffName && (
                  <div className="mt-1 text-xs text-zinc-400">
                    {t("classesStaffOf", { name: o.staffName })}
                  </div>
                )}
                {canJoin && confirming?.scheduleId === o.scheduleId &&
                  confirming.year === o.year &&
                  confirming.month === o.month &&
                  confirming.day === o.day && (
                    <div className="mt-3 rounded-md border border-purple-300/40 bg-zinc-900/80 p-3 backdrop-blur">
                      <div className="font-medium text-zinc-100">
                        {t("classConfirmTitle")}
                      </div>
                      <div className="mt-1 text-xs text-zinc-400">
                        {t("classConfirmBody", {
                          date: dateLabel,
                          time,
                          service: o.serviceName,
                        })}
                      </div>
                      {error && (
                        <div className="mt-2 text-xs text-rose-400">
                          {error}
                        </div>
                      )}
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={onConfirm}
                          disabled={pending}
                          className="rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_4px_14px_-6px_rgba(168,85,247,0.6)] hover:brightness-110 disabled:opacity-60"
                        >
                          {pending
                            ? t("classJoining")
                            : t("classConfirmYes")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirming(null)}
                          disabled={pending}
                          className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-zinc-200 ring-1 ring-white/15 hover:bg-white/10 disabled:opacity-60"
                        >
                          {t("classConfirmNo")}
                        </button>
                      </div>
                    </div>
                  )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function fmtMin(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function formatDateLabel(
  year: number,
  month: number,
  day: number,
  weekdayIdx: number,
  lang: string,
): string {
  // UTC-naive Manila day → locale 표시. weekday는 이미 계산된 인덱스 사용.
  const wd =
    lang === "en"
      ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][weekdayIdx]
      : ["일", "월", "화", "수", "목", "금", "토"][weekdayIdx];
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")} (${wd})`;
}
