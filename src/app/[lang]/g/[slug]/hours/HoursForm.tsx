"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { saveBusinessHours, type SaveHoursState } from "./actions";

type Weekday = "SUN" | "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";

const ALL_WEEKDAYS: Weekday[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

type DayInitial = {
  weekday: Weekday;
  open: boolean;
  openTime: string;
  closeTime: string;
  breakStartTime: string;
  breakEndTime: string;
};

const TONE = {
  normal: {
    section: "rounded-2xl bg-white ring-1 ring-amber-200/60 p-6",
    title: "text-ink",
    subtle: "text-zinc-600",
    label: "text-ink",
    on: "bg-emerald-500 text-white",
    off: "bg-zinc-200 text-zinc-500",
    input:
      "h-10 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-900 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400",
    submit: "bg-ink text-white hover:bg-ink/90",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    error: "border-red-200 bg-red-50 text-red-700",
  },
  black: {
    section: "rounded-2xl bg-zinc-900 ring-1 ring-white/10 p-6",
    title: "text-white",
    subtle: "text-zinc-400",
    label: "text-zinc-100",
    on: "bg-amber-300 text-zinc-950",
    off: "bg-zinc-700 text-zinc-400",
    input:
      "h-10 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-sm text-zinc-100 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30 disabled:cursor-not-allowed disabled:bg-zinc-900 disabled:text-zinc-600 [color-scheme:dark]",
    submit: "bg-amber-300 text-zinc-950 hover:bg-amber-200",
    success: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
    error: "border-red-400/40 bg-red-400/10 text-red-300",
  },
  white: {
    section: "rounded-2xl bg-white ring-1 ring-zinc-200 p-6",
    title: "text-ink",
    subtle: "text-zinc-600",
    label: "text-ink",
    on: "bg-sky-700 text-white",
    off: "bg-zinc-200 text-zinc-500",
    input:
      "h-10 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-900 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400",
    submit: "bg-ink text-white hover:bg-ink/90",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    error: "border-red-200 bg-red-50 text-red-700",
  },
} as const;

const initialState: SaveHoursState = {};

export function HoursForm({
  lang,
  slug,
  tone,
  initialDays,
}: {
  lang: string;
  slug: string;
  tone: keyof typeof TONE;
  initialDays: DayInitial[];
}) {
  const t = useTranslations("hours");
  const tt = useTranslations("trainers");
  const tk = TONE[tone];

  const initialMap = new Map(initialDays.map((d) => [d.weekday, d]));
  const [days, setDays] = useState<Map<Weekday, DayInitial>>(() => {
    const m = new Map<Weekday, DayInitial>();
    for (const w of ALL_WEEKDAYS) {
      const iv = initialMap.get(w);
      m.set(w, {
        weekday: w,
        open: iv?.open ?? true,
        openTime: iv?.openTime ?? "09:00",
        closeTime: iv?.closeTime ?? "22:00",
        breakStartTime: iv?.breakStartTime ?? "",
        breakEndTime: iv?.breakEndTime ?? "",
      });
    }
    return m;
  });

  const [state, formAction, pending] = useActionState(
    saveBusinessHours,
    initialState,
  );

  function patch(w: Weekday, patch: Partial<DayInitial>) {
    setDays((prev) => {
      const next = new Map(prev);
      next.set(w, { ...next.get(w)!, ...patch });
      return next;
    });
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="slug" value={slug} />

      <section className={tk.section}>
        <header className="flex items-baseline justify-between gap-3">
          <h2 className={`font-heading text-lg tracking-tight ${tk.title}`}>
            {t("weeklyTitle")}
          </h2>
          <span className={`text-xs ${tk.subtle}`}>{t("weeklyHint")}</span>
        </header>

        <div className="mt-5 space-y-2">
          {ALL_WEEKDAYS.map((w) => {
            const d = days.get(w)!;
            const timeError = state.errors?.[`time_${w}`];
            const breakError = state.errors?.[`break_${w}`];
            return (
              <div
                key={w}
                className={`grid grid-cols-[3rem_5rem_1fr] items-center gap-3 rounded-md border px-3 py-3 ${
                  tone === "black" ? "border-white/5 bg-zinc-950/40" : "border-zinc-100"
                }`}
              >
                <div
                  className={`text-center text-sm font-bold ${tk.label}`}
                >
                  {tt(`weekday.${w}`)}
                </div>

                <button
                  type="button"
                  onClick={() => patch(w, { open: !d.open })}
                  className={`h-10 rounded-md text-xs font-bold transition ${
                    d.open ? tk.on : tk.off
                  }`}
                >
                  {d.open ? t("open") : t("closed")}
                </button>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="time"
                    lang={lang}
                    name={`openTime_${w}`}
                    value={d.openTime}
                    disabled={!d.open}
                    onChange={(e) =>
                      patch(w, { openTime: e.currentTarget.value })
                    }
                    className={`${tk.input} w-[7.5rem]`}
                  />
                  <span className={`text-xs ${tk.subtle}`}>~</span>
                  <input
                    type="time"
                    lang={lang}
                    name={`closeTime_${w}`}
                    value={d.closeTime}
                    disabled={!d.open}
                    onChange={(e) =>
                      patch(w, { closeTime: e.currentTarget.value })
                    }
                    className={`${tk.input} w-[7.5rem]`}
                  />
                  <input
                    type="hidden"
                    name={`open_${w}`}
                    value={d.open ? "on" : ""}
                  />

                  <span className={`ml-2 text-[10px] uppercase tracking-wider ${tk.subtle}`}>
                    {t("breakLabel")}
                  </span>
                  <input
                    type="time"
                    lang={lang}
                    name={`breakStartTime_${w}`}
                    value={d.breakStartTime}
                    disabled={!d.open}
                    onChange={(e) =>
                      patch(w, { breakStartTime: e.currentTarget.value })
                    }
                    className={`${tk.input} w-[7.5rem]`}
                  />
                  <span className={`text-xs ${tk.subtle}`}>~</span>
                  <input
                    type="time"
                    lang={lang}
                    name={`breakEndTime_${w}`}
                    value={d.breakEndTime}
                    disabled={!d.open}
                    onChange={(e) =>
                      patch(w, { breakEndTime: e.currentTarget.value })
                    }
                    className={`${tk.input} w-[7.5rem]`}
                  />
                </div>

                {(timeError || breakError) && (
                  <div className="col-span-3 text-xs text-red-500">
                    {timeError?.[0] ?? breakError?.[0]}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        {state.ok && (
          <span
            className={`rounded-md border px-3 py-1.5 text-xs ${tk.success}`}
          >
            {t("saved")}
          </span>
        )}
        {state.errors?._global && (
          <span
            className={`rounded-md border px-3 py-1.5 text-xs ${tk.error}`}
          >
            {state.errors._global[0]}
          </span>
        )}
        <button
          type="submit"
          disabled={pending}
          className={`inline-flex h-11 items-center rounded-md px-6 text-sm font-medium transition disabled:opacity-60 ${tk.submit}`}
        >
          {pending ? t("saving") : t("save")}
        </button>
      </div>
    </form>
  );
}
