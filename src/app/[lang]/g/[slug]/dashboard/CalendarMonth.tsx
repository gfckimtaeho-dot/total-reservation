"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { ClassEvent } from "@/lib/booking/schedule-expand";
import { fmtMin } from "@/lib/booking/schedule-expand";

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

type OpenSession = {
  day: number;
  index: number;
};

export function CalendarMonth({
  weekdays,
  monthInfo,
  eventsByDay,
  closedDays,
  labels,
}: {
  weekdays: readonly string[];
  monthInfo: MonthInfo;
  eventsByDay: Record<number, ClassEvent[]>;
  closedDays: number[];
  labels: {
    closed: string;
    sessionCustomersEmpty: string;
  };
}) {
  const td = useTranslations("dashboard");
  const { daysInMonth, firstWeekday, todayDay } = monthInfo;
  const closedSet = new Set(closedDays);

  const [openSession, setOpenSession] = useState<OpenSession | null>(null);

  useEffect(() => {
    if (openSession == null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenSession(null);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [openSession]);

  const openEvent =
    openSession && eventsByDay[openSession.day]
      ? eventsByDay[openSession.day]![openSession.index]
      : null;

  return (
    <>
      <div className="mt-4 grid grid-cols-7 gap-1 text-center">
        {weekdays.map((w) => (
          <span
            key={w}
            className="rounded-t-md bg-zinc-50 py-2 pb-2 text-base font-semibold text-zinc-600"
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
                className="relative flex min-h-[96px] flex-col rounded-md border border-zinc-100 bg-zinc-100 p-2 text-zinc-500"
              >
                <div className="text-left text-sm font-semibold leading-none">
                  {day}
                </div>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                  {labels.closed}
                </div>
              </div>
            );
          }
          const events = eventsByDay[day] ?? [];
          const isToday = day === todayDay;
          return (
            <div
              key={day}
              className={`flex min-h-[96px] flex-col rounded-md border border-zinc-100 bg-white p-2 ${
                isToday ? "ring-2 ring-ink" : ""
              }`}
            >
              <div className="text-left text-sm font-semibold leading-none text-ink">
                {day}
              </div>
              {events.length > 0 && (
                <ul className="mt-2 flex flex-col gap-0.5">
                  {events.map((ev, idx) => {
                    const isOneOff = ev.kind === "ONE_OFF";
                    const tonePill = isOneOff
                      ? "bg-amber-50 text-amber-800 ring-amber-200/70 hover:bg-amber-100"
                      : "bg-sky-50 text-sky-800 ring-sky-200/70 hover:bg-sky-100";
                    return (
                      <li key={`${ev.scheduleId}-${idx}`}>
                        <button
                          type="button"
                          onClick={() => setOpenSession({ day, index: idx })}
                          className={`block w-full rounded px-1.5 py-1 text-left text-[11px] font-medium ring-1 transition ${tonePill}`}
                          title={`${ev.serviceName} ${fmtMin(ev.startMin)}~${fmtMin(ev.endMin)}`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="tabular-nums">{fmtMin(ev.startMin)}</span>
                            <span className="tabular-nums">
                              {ev.enrolled}/{ev.capacity}
                            </span>
                          </div>
                          <div className="truncate leading-tight">
                            {ev.serviceName}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {openSession && openEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpenSession(null);
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-100 bg-white text-ink shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
              <h2 className="font-heading text-base tracking-tight">
                {td("sessionDetailTitle", {
                  day: openSession.day,
                  time: fmtMin(openEvent.startMin),
                  service: openEvent.serviceName,
                })}
              </h2>
              <button
                type="button"
                onClick={() => setOpenSession(null)}
                aria-label="close"
                className="rounded px-2 py-1 text-lg leading-none text-zinc-600 hover:bg-zinc-50"
              >
                ×
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-6">
              <div className="mb-4 text-sm tabular-nums text-zinc-600">
                {td("sessionCountLabel", {
                  enrolled: openEvent.enrolled,
                  capacity: openEvent.capacity,
                })}
              </div>
              {openEvent.customers.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  {labels.sessionCustomersEmpty}
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {openEvent.customers.map((name, i) => (
                    <li
                      key={`${name}-${i}`}
                      className="rounded-md border border-zinc-100 px-3 py-2 text-sm text-ink"
                    >
                      {name}
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
