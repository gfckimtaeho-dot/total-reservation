"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { ClassEvent } from "@/lib/booking/schedule-expand";
import { fmtMin } from "@/lib/booking/schedule-expand";

type Tone = "normal" | "black" | "white";

type MonthInfo = {
  daysInMonth: number;
  firstWeekday: number;
  todayDay: number;
};

export type GroupServiceRow = {
  serviceId: string;
  serviceName: string;
  staffName: string | null;
};

const TONE = {
  normal: {
    headRow: "bg-band/40 text-ink/70",
    cell: "border border-amber-200/60 bg-amber-50/30",
    cellToday: "bg-white ring-2 ring-ink",
    cellClosed: "bg-zinc-200/70 text-zinc-600",
    pillEvent:
      "bg-sky-50 text-sky-800 ring-1 ring-sky-200/70 hover:bg-sky-100",
    pillOneOff:
      "bg-amber-100 text-amber-800 ring-1 ring-amber-300/70 hover:bg-amber-200",
    dayNum: "text-ink",
    dialogBg: "bg-white border-amber-200/60 text-ink",
    dialogBorder: "border-amber-200/60",
    close: "text-ink/60 hover:bg-ink/5",
    rowMeta: "text-ink/60",
    rowBadgeRecur: "bg-sky-100 text-sky-800",
    rowBadgeOneOff: "bg-amber-100 text-amber-800",
    listBorder: "border-amber-200/60",
    listTitle: "text-ink/70",
    listRowBorder: "border-amber-100",
    listName: "text-ink",
    listStaff: "text-ink/60",
    listEmpty: "text-ink/40",
  },
  black: {
    headRow: "bg-white/5 text-zinc-400",
    cell: "border border-white/5 bg-zinc-950/40",
    cellToday: "bg-zinc-900 ring-2 ring-lime-300",
    cellClosed: "bg-zinc-800/60 text-zinc-400",
    pillEvent:
      "bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/30 hover:bg-sky-400/25",
    pillOneOff:
      "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30 hover:bg-amber-400/25",
    dayNum: "text-zinc-200",
    dialogBg: "bg-zinc-900 border-white/5 text-zinc-200",
    dialogBorder: "border-white/5",
    close: "text-zinc-400 hover:bg-white/5",
    rowMeta: "text-zinc-500",
    rowBadgeRecur: "bg-sky-400/15 text-sky-300",
    rowBadgeOneOff: "bg-amber-400/15 text-amber-300",
    listBorder: "border-white/5",
    listTitle: "text-zinc-400",
    listRowBorder: "border-white/5",
    listName: "text-white",
    listStaff: "text-zinc-500",
    listEmpty: "text-zinc-500",
  },
  white: {
    headRow: "bg-zinc-50 text-zinc-600",
    cell: "border border-zinc-100 bg-white",
    cellToday: "bg-zinc-50 ring-2 ring-ink",
    cellClosed: "bg-zinc-100 text-zinc-500",
    pillEvent:
      "bg-sky-50 text-sky-800 ring-1 ring-sky-200/70 hover:bg-sky-100",
    pillOneOff:
      "bg-amber-50 text-amber-800 ring-1 ring-amber-200/70 hover:bg-amber-100",
    dayNum: "text-ink",
    dialogBg: "bg-white border-zinc-100 text-ink",
    dialogBorder: "border-zinc-100",
    close: "text-zinc-600 hover:bg-zinc-50",
    rowMeta: "text-zinc-500",
    rowBadgeRecur: "bg-sky-50 text-sky-700",
    rowBadgeOneOff: "bg-amber-50 text-amber-700",
    listBorder: "border-zinc-100",
    listTitle: "text-zinc-600",
    listRowBorder: "border-zinc-100",
    listName: "text-ink",
    listStaff: "text-zinc-500",
    listEmpty: "text-zinc-400",
  },
} as const;

export function CalendarMonth({
  weekdays,
  monthInfo,
  eventsByDay,
  closedDays,
  tone,
  labels,
}: {
  weekdays: readonly string[];
  monthInfo: MonthInfo;
  eventsByDay: Record<number, ClassEvent[]>;
  closedDays: number[];
  tone: Tone;
  labels: {
    closed: string;
    badgeRecurring: string;
    badgeOneOff: string;
    capacityLabel: string;
    enrolledLabel: string;
    durationLabel: string;
    startTimeLabel: string;
    endTimeLabel: string;
    staffLabel: string;
    staffNone: string;
    noteLabel: string;
    noEvents: string;
    unit: { min: string; people: string };
  };
}) {
  const td = useTranslations("dashboard");
  const tk = TONE[tone];
  const { daysInMonth, firstWeekday, todayDay } = monthInfo;
  const closedSet = new Set(closedDays);

  const [openDay, setOpenDay] = useState<number | null>(null);

  useEffect(() => {
    if (openDay == null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenDay(null);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [openDay]);

  const eventsForOpen = openDay ? (eventsByDay[openDay] ?? []) : [];

  return (
    <>
      <div className="mt-4 grid grid-cols-7 gap-1 text-center">
        {weekdays.map((w) => (
          <span
            key={w}
            className={`rounded-t-md py-2 pb-2 text-base font-semibold ${tk.headRow}`}
          >
            {w}
          </span>
        ))}
        {Array.from({ length: firstWeekday }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          if (closedSet.has(day)) {
            return (
              <div
                key={day}
                className={`relative flex min-h-[96px] flex-col rounded-md p-2 ${tk.cellClosed}`}
              >
                <div className="text-left text-sm font-semibold leading-none">{day}</div>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                  {labels.closed}
                </div>
              </div>
            );
          }
          const events = eventsByDay[day] ?? [];
          const isToday = day === todayDay;
          return (
            <button
              key={day}
              type="button"
              onClick={() => setOpenDay(day)}
              className={`flex min-h-[96px] w-full flex-col rounded-md p-2 transition hover:opacity-90 ${tk.cell} ${
                isToday ? tk.cellToday : ""
              }`}
            >
              <div className={`text-left text-sm font-semibold leading-none ${tk.dayNum}`}>{day}</div>
              {events.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {events.slice(0, 3).map((ev, idx) => (
                    <li
                      key={`${ev.scheduleId}-${idx}`}
                      className={`block truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${
                        ev.kind === "ONE_OFF" ? tk.pillOneOff : tk.pillEvent
                      }`}
                      title={`${ev.serviceName} ${fmtMin(ev.startMin)}~${fmtMin(ev.endMin)}`}
                    >
                      {ev.serviceName}
                    </li>
                  ))}
                  {events.length > 3 && (
                    <li className={`text-[11px] font-medium ${tk.rowMeta}`}>
                      +{events.length - 3}
                    </li>
                  )}
                </ul>
              )}
            </button>
          );
        })}
      </div>

      {openDay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpenDay(null);
          }}
        >
          <div
            className={`w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl ${tk.dialogBg}`}
          >
            <div
              className={`flex items-center justify-between border-b px-6 py-4 ${tk.dialogBorder}`}
            >
              <h2 className="font-heading text-base tracking-tight">
                {td("dayClassDetail", { day: openDay })}
              </h2>
              <button
                type="button"
                onClick={() => setOpenDay(null)}
                aria-label="close"
                className={`rounded px-2 py-1 text-lg leading-none ${tk.close}`}
              >
                ×
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-6">
              {eventsForOpen.length === 0 ? (
                <p className={`text-sm ${tk.rowMeta}`}>{labels.noEvents}</p>
              ) : (
                <ul className="space-y-3">
                  {eventsForOpen.map((ev, idx) => (
                    <li
                      key={`${ev.scheduleId}-${idx}`}
                      className={`rounded-lg border px-4 py-3 ${tk.dialogBorder}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                            ev.kind === "ONE_OFF"
                              ? tk.rowBadgeOneOff
                              : tk.rowBadgeRecur
                          }`}
                        >
                          {ev.kind === "ONE_OFF"
                            ? labels.badgeOneOff
                            : labels.badgeRecurring}
                        </span>
                        <span className="font-medium">{ev.serviceName}</span>
                      </div>
                      <div
                        className={`mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs ${tk.rowMeta}`}
                      >
                        <div>
                          {labels.startTimeLabel}:{" "}
                          <span className="tabular-nums text-current">
                            {fmtMin(ev.startMin)}
                          </span>
                        </div>
                        <div>
                          {labels.endTimeLabel}:{" "}
                          <span className="tabular-nums text-current">
                            {fmtMin(ev.endMin)}
                          </span>
                        </div>
                        <div>
                          {labels.durationLabel}:{" "}
                          <span className="tabular-nums text-current">
                            {ev.durationMin}
                            {labels.unit.min}
                          </span>
                        </div>
                        <div>
                          {labels.staffLabel}:{" "}
                          <span className="text-current">
                            {ev.staffName ?? labels.staffNone}
                          </span>
                        </div>
                        <div>
                          {labels.capacityLabel}:{" "}
                          <span className="tabular-nums text-current">
                            {ev.capacity}
                            {labels.unit.people}
                          </span>
                        </div>
                        <div>
                          {labels.enrolledLabel}:{" "}
                          <span className="tabular-nums text-current">
                            {ev.enrolled}
                            {labels.unit.people}
                          </span>
                        </div>
                      </div>
                      {ev.note && (
                        <div
                          className={`mt-2 border-t pt-2 text-xs ${tk.dialogBorder} ${tk.rowMeta}`}
                        >
                          {labels.noteLabel}: {ev.note}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
