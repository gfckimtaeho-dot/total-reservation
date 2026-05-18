"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  type MonthInfo,
  type TrainerEvent,
  fmtTime,
  groupByStart,
} from "@/lib/calendar/manila";
import { AddReservationButton } from "./TrainerScheduleClient";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const WEEKDAY_BY_INDEX = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
] as const;

type Weekday = (typeof WEEKDAY_BY_INDEX)[number];

type Props = {
  lang: string;
  trainerName: string;
  weeklyOffDays: Weekday[];
  monthLabel: string;
  monthInfo: MonthInfo;
  initialSelectedDay: number;
  eventsByDay: Record<number, TrainerEvent[]>;
  closedDays: number[];
};

export function TrainerCalendarSchedule({
  lang,
  trainerName,
  weeklyOffDays,
  monthLabel,
  monthInfo,
  initialSelectedDay,
  eventsByDay,
  closedDays,
}: Props) {
  const t = useTranslations("dashboard");
  const [selectedDay, setSelectedDay] = useState(initialSelectedDay);

  const offSet = new Set(weeklyOffDays);
  const closedSet = new Set(closedDays);
  function weekdayOf(day: number): Weekday {
    const idx = (monthInfo.firstWeekday + (day - 1)) % 7;
    return WEEKDAY_BY_INDEX[idx];
  }
  function isOff(day: number): boolean {
    return closedSet.has(day) || offSet.has(weekdayOf(day));
  }

  function selectDay(day: number) {
    setSelectedDay(day);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("day", String(day));
      window.history.replaceState(null, "", url.toString());
    }
  }

  const dayEvents: TrainerEvent[] = isOff(selectedDay)
    ? []
    : (eventsByDay[selectedDay] ?? []);
  const buckets = groupByStart(dayEvents);

  const selectedDate = new Date(
    Date.UTC(monthInfo.year, monthInfo.month - 1, selectedDay, 4, 0, 0),
  );
  const selectedDateLabel = new Intl.DateTimeFormat(
    lang === "en" ? "en-US" : "ko-KR",
    {
      timeZone: "Asia/Manila",
      month: "long",
      day: "numeric",
      weekday: "short",
    },
  ).format(selectedDate);

  const weekdays = lang === "en" ? WEEKDAYS_EN : WEEKDAYS;

  return (
    <>
      {/* 일정 */}
      <section className="rounded-2xl border border-amber-400/25 bg-black p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-base tracking-tight text-white">
            {selectedDay === monthInfo.todayDay
              ? t("timelineTitle")
              : t("timelineTitleForDate", { date: selectedDateLabel })}
          </h2>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-400/15 px-2.5 py-0.5 text-xs font-medium tabular-nums text-amber-300 ring-1 ring-amber-400/40">
              {t("trainerScheduleCount", { count: dayEvents.length })}
            </span>
            {!isOff(selectedDay) && <AddReservationButton />}
          </div>
        </div>
        {buckets.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">
            {isOff(selectedDay) ? t("trainerOffDay") : t("trainerNoBookings")}
          </p>
        ) : (
          <ol className="mt-4 divide-y divide-amber-400/15">
            {buckets.map((b) => (
              <li
                key={b.startMin}
                className="grid grid-cols-[56px_1fr] gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="pt-1 font-mono text-sm font-semibold tabular-nums text-amber-300">
                  {fmtTime(b.startMin)}
                </div>
                <div className="grid gap-2">
                  {b.items.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-xl bg-zinc-900 p-3 ring-1 ring-amber-400/30"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-white">
                          {r.title}
                        </span>
                        {r.isGroup && (
                          <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-950">
                            {t("groupBadge", {
                              enrolled: r.enrolled ?? 0,
                              capacity: r.capacity ?? 0,
                            })}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-zinc-400">
                        {r.service}
                      </div>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* 월별 캘린더 */}
      <section className="rounded-2xl border border-amber-400/25 bg-black p-5">
        <h2 className="font-heading text-base tracking-tight text-white">
          {t("calendarTitle", { month: monthLabel, name: trainerName })}
        </h2>
        <p className="mt-1 text-[11px] text-zinc-500">
          {t("trainerCalendarHint")}
        </p>
        <div className="mt-4 grid grid-cols-7 gap-1 text-center">
          {weekdays.map((w) => (
            <span
              key={w}
              className="border-b-2 border-amber-400/25 pb-2 text-[11px] font-bold text-white"
            >
              {w}
            </span>
          ))}
          {Array.from({ length: monthInfo.firstWeekday }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {Array.from({ length: monthInfo.daysInMonth }, (_, i) => i + 1).map(
            (day) => {
              const isToday = day === monthInfo.todayDay;
              const isSelected = day === selectedDay;
              const off = isOff(day);
              const dayCount = off ? 0 : (eventsByDay[day]?.length ?? 0);

              const baseCell =
                "relative flex h-16 flex-col items-start overflow-hidden rounded-md border p-1.5 text-left transition";

              if (off) {
                const offRing = isSelected
                  ? "ring-2 ring-amber-400"
                  : isToday
                    ? "ring-2 ring-amber-400/60"
                    : "";
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => selectDay(day)}
                    className={`${baseCell} bg-zinc-950 border-zinc-800 hover:bg-zinc-900 ${offRing}`}
                  >
                    <div
                      className={`text-[11px] font-bold ${
                        isToday ? "text-amber-300" : "text-zinc-500"
                      }`}
                    >
                      {day}
                    </div>
                    <div
                      className={`mt-0.5 text-[9px] uppercase tracking-wider ${
                        isToday ? "text-amber-300" : "text-zinc-600"
                      }`}
                    >
                      OFF
                    </div>
                  </button>
                );
              }

              const ring = isSelected
                ? "ring-2 ring-amber-400"
                : isToday
                  ? "ring-2 ring-amber-400/60"
                  : "";
              const bg = isToday ? "bg-amber-400/15" : "bg-zinc-800";

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`${baseCell} ${bg} border-amber-400/30 hover:bg-zinc-700 ${ring}`}
                >
                  <div
                    className={`text-[11px] font-bold ${
                      isToday ? "text-amber-300" : "text-zinc-100"
                    }`}
                  >
                    {day}
                  </div>
                  {dayCount > 0 && (
                    <div className="mt-1 truncate text-[9px] font-medium text-amber-300">
                      {t("trainerScheduleCount", { count: dayCount })}
                    </div>
                  )}
                </button>
              );
            },
          )}
        </div>
      </section>
    </>
  );
}
