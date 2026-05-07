"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  MOCK_CLOSED_DAYS,
  MOCK_GROUP_CLASSES_BY_DAY,
  MOCK_RESERVATIONS_TODAY,
  fmtTime,
  groupByHour,
  type MockReservation,
} from "../../../preview/_mock";
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

type MonthInfo = {
  year: number;
  month: number;
  daysInMonth: number;
  firstWeekday: number;
  todayDay: number;
};

type Props = {
  lang: string;
  trainerName: string;
  weeklyOffDays: Weekday[];
  monthLabel: string;
  monthInfo: MonthInfo;
  initialSelectedDay: number;
};

function synthesizeReservations(
  day: number,
  trainerName: string,
  translateClass: (key: string) => string,
): MockReservation[] {
  const keys = MOCK_GROUP_CLASSES_BY_DAY[day] ?? [];
  return keys.map((key, i) => ({
    id: `${day}-${key}-${i}`,
    startMin: (10 + i * 2) * 60,
    endMin: (11 + i * 2) * 60,
    customer: translateClass(key),
    staff: trainerName,
    service: translateClass(key),
    serviceType: "GROUP",
    capacity: 12,
    enrolled: 6 + (day % 5),
    status: "CONFIRMED",
  }));
}

export function TrainerCalendarSchedule({
  lang,
  trainerName,
  weeklyOffDays,
  monthLabel,
  monthInfo,
  initialSelectedDay,
}: Props) {
  const t = useTranslations("dashboard");
  const [selectedDay, setSelectedDay] = useState(initialSelectedDay);

  const offSet = new Set(weeklyOffDays);
  function weekdayOf(day: number): Weekday {
    const idx = (monthInfo.firstWeekday + (day - 1)) % 7;
    return WEEKDAY_BY_INDEX[idx];
  }
  function isOff(day: number): boolean {
    return MOCK_CLOSED_DAYS.has(day) || offSet.has(weekdayOf(day));
  }

  function selectDay(day: number) {
    setSelectedDay(day);
    // URL 갱신은 history API로만 — 라우터 navigation 없이 새로고침/북마크 호환
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("day", String(day));
      window.history.replaceState(null, "", url.toString());
    }
  }

  const reservations: MockReservation[] = isOff(selectedDay)
    ? []
    : selectedDay === monthInfo.todayDay
      ? MOCK_RESERVATIONS_TODAY.filter((r) => r.staff === trainerName)
      : synthesizeReservations(selectedDay, trainerName, (key) =>
          t(`sampleGroupClass.${key}`),
        );
  const buckets = groupByHour(reservations);

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
      {/* 일정 — 제목+카운트+예약 추가 한 줄 */}
      <section className="rounded-2xl border border-white/10 bg-zinc-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-base tracking-tight text-white">
            {selectedDay === monthInfo.todayDay
              ? t("timelineTitle")
              : t("timelineTitleForDate", { date: selectedDateLabel })}
          </h2>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-lime-300/15 px-2.5 py-0.5 text-xs font-medium tabular-nums text-lime-300 ring-1 ring-lime-300/40">
              {t("trainerScheduleCount", { count: reservations.length })}
            </span>
            {!isOff(selectedDay) && <AddReservationButton />}
          </div>
        </div>
        {buckets.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">
            {isOff(selectedDay) ? t("trainerOffDay") : t("trainerNoBookings")}
          </p>
        ) : (
          <ol className="mt-5 divide-y divide-white/10">
            {buckets.map((b) => (
              <li
                key={b.startMin}
                className="grid grid-cols-[56px_1fr] gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="pt-2 text-sm font-medium tabular-nums text-zinc-400">
                  {fmtTime(b.startMin)}
                </div>
                <div className="grid gap-2">
                  {b.items.map((r) => {
                    const isGroup = r.serviceType === "GROUP";
                    return (
                      <div
                        key={r.id}
                        className={`rounded-xl p-3 ring-1 ${
                          isGroup
                            ? "bg-zinc-800 ring-lime-300/40"
                            : "bg-zinc-800 ring-white/10"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-white">
                            {r.customer}
                          </span>
                          {isGroup && (
                            <span className="rounded-full bg-lime-300 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-950">
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
                    );
                  })}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* 월별 캘린더 — 일자 클릭 시 selectedDay 갱신 (서버 왕복 없음) */}
      <section className="rounded-2xl border border-white/10 bg-zinc-900 p-5">
        <h2 className="font-heading text-base tracking-tight text-white">
          {t("calendarTitle", { month: monthLabel })}
        </h2>
        <p className="mt-1 text-[11px] text-zinc-500">
          {t("trainerCalendarHint")}
        </p>
        <div className="mt-4 grid grid-cols-7 gap-1 text-center">
          {weekdays.map((w) => (
            <span
              key={w}
              className="border-b border-white/10 pb-2 text-[10px] font-medium text-zinc-400"
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
              const classes = MOCK_GROUP_CLASSES_BY_DAY[day] ?? [];

              const baseCell =
                "relative block min-h-[60px] rounded-md p-1.5 text-left transition";

              if (off) {
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => selectDay(day)}
                    className={`${baseCell} bg-zinc-700/70 hover:bg-zinc-600 ${
                      isSelected ? "ring-2 ring-lime-300" : ""
                    }`}
                  >
                    <div className="text-[10px] font-medium text-zinc-300">
                      {day}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center text-[9px] font-medium text-zinc-300">
                      {t("closed")}
                    </div>
                  </button>
                );
              }

              // 시각 계층:
              //   today + selected: 굵은 lime ring + lime tint
              //   today (only):     중간 lime ring + 옅은 lime tint (한눈에 오늘 식별)
              //   selected (only):  굵은 lime ring + 약간 밝은 zinc
              //   normal:           회색 border
              const ring = isSelected
                ? "ring-2 ring-lime-300"
                : isToday
                  ? "ring-2 ring-lime-300/60"
                  : "border border-white/10";
              const bg = isSelected
                ? isToday
                  ? "bg-lime-300/20"
                  : "bg-zinc-800"
                : isToday
                  ? "bg-lime-300/10"
                  : "bg-zinc-800/60";

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`${baseCell} ${bg} ${ring} hover:bg-zinc-700`}
                >
                  <div
                    className={`text-[11px] font-semibold ${
                      isToday ? "text-lime-300" : "text-zinc-100"
                    }`}
                  >
                    {day}
                  </div>
                  {classes.length > 0 && (
                    <ul className="mt-0.5 space-y-0.5">
                      {classes.map((key) => (
                        <li
                          key={key}
                          className="truncate rounded bg-lime-300/15 px-1 py-0.5 text-[9px] font-medium text-lime-300 ring-1 ring-lime-300/40"
                        >
                          {t(`sampleGroupClass.${key}`)}
                        </li>
                      ))}
                    </ul>
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
