"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useTranslations } from "next-intl";
import { NativePickerInput } from "@/components/NativePickerInput";
import {
  createSchedule,
  deleteSchedule,
  type CreateScheduleState,
} from "./schedule-actions";

type Tone = "normal" | "black" | "white";
type Weekday = "SUN" | "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";
type ScheduleKind = "RECURRING" | "ONE_OFF";

const WEEKDAY_ORDER: Weekday[] = [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
];

export type ScheduleEntry = {
  id: string;
  kind: ScheduleKind;
  weekdays: Weekday[];
  specificDate: Date | null;
  startMinute: number;
  validFrom: Date;
  validUntil: Date | null;
  note: string | null;
  staff: { id: string; user: { name: string } } | null;
};

export type StaffOption = { id: string; name: string };

type Service = {
  id: string;
  name: string;
  durationMin: number;
  capacity: number;
};

const TONE = {
  normal: {
    trigger: "text-ink/70 hover:bg-ink/5",
    dialogCard: "bg-amber-50 border-amber-200/60 text-ink",
    dialogBorder: "border-amber-200/60",
    sectionBorder: "border-amber-200/40",
    staffBar: "bg-white/80 border-amber-200/60",
    close: "text-ink/60 hover:bg-ink/5",
    input:
      "bg-white border-ink/15 text-ink focus:border-ink focus:outline-none",
    label: "text-ink/70",
    hint: "text-ink/50",
    button: "bg-ink text-white hover:bg-ink/90",
    chipActive: "bg-ink text-white border-ink",
    chipInactive: "bg-white text-ink/70 border-ink/15 hover:bg-ink/5",
    rowCard: "bg-white border-ink/10",
    rowMeta: "text-ink/60",
    rowBadgeRecur: "bg-sky-100 text-sky-800",
    rowBadgeOneOff: "bg-amber-100 text-amber-800",
    deleteBtn: "text-rose-600 hover:bg-rose-50",
    error: "text-rose-600",
    sectionHeadingRecur: "text-ink",
    sectionHeadingOneOff: "text-amber-800",
  },
  black: {
    trigger: "text-lime-300 hover:bg-white/5",
    dialogCard: "bg-zinc-900 border-white/5 text-zinc-200",
    dialogBorder: "border-white/5",
    sectionBorder: "border-white/5",
    staffBar: "bg-zinc-950 border-white/5",
    close: "text-zinc-400 hover:bg-white/5",
    input:
      "bg-zinc-950 border-white/10 text-white focus:border-lime-300 focus:outline-none",
    label: "text-zinc-400",
    hint: "text-zinc-500",
    button: "bg-lime-300 text-zinc-950 hover:bg-lime-200",
    chipActive: "bg-lime-300 text-zinc-950 border-lime-300",
    chipInactive:
      "bg-zinc-950 text-zinc-400 border-white/10 hover:bg-white/5",
    rowCard: "bg-zinc-950 border-white/5",
    rowMeta: "text-zinc-500",
    rowBadgeRecur: "bg-sky-400/15 text-sky-300",
    rowBadgeOneOff: "bg-amber-400/15 text-amber-300",
    deleteBtn: "text-rose-400 hover:bg-rose-500/10",
    error: "text-rose-400",
    sectionHeadingRecur: "text-zinc-200",
    sectionHeadingOneOff: "text-lime-300",
  },
  white: {
    trigger: "text-violet-700 hover:bg-violet-50",
    dialogCard: "bg-white border-violet-100 text-ink",
    dialogBorder: "border-violet-100",
    sectionBorder: "border-violet-100",
    staffBar: "bg-violet-50 border-violet-100",
    close: "text-zinc-600 hover:bg-violet-50",
    input:
      "bg-white border-violet-200 text-ink focus:border-violet-500 focus:outline-none",
    label: "text-violet-700",
    hint: "text-zinc-500",
    button: "bg-violet-600 text-white hover:bg-violet-700",
    chipActive: "bg-violet-600 text-white border-violet-600",
    chipInactive:
      "bg-white text-zinc-700 border-violet-200 hover:bg-violet-50",
    rowCard: "bg-violet-50/60 border-violet-100",
    rowMeta: "text-zinc-500",
    rowBadgeRecur: "bg-sky-50 text-sky-700",
    rowBadgeOneOff: "bg-amber-50 text-amber-700",
    deleteBtn: "text-rose-600 hover:bg-rose-50",
    error: "text-rose-600",
    sectionHeadingRecur: "text-violet-700",
    sectionHeadingOneOff: "text-amber-700",
  },
} as const;

type ToneSet = (typeof TONE)[keyof typeof TONE];

const fmtMin = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function parseHHMM(s: string): number | null {
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function ymd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

const INITIAL: CreateScheduleState = {};

function errorMessage(
  state: CreateScheduleState,
  key: string,
  te: (k: string) => string,
): string | null {
  const arr = state.errors?.[key];
  if (!arr || arr.length === 0) return null;
  const first = arr[0]!;
  if (first === "weekdays") return te("weekdaysRequired");
  if (first === "startTime") return te("startTimeFormat");
  if (first === "overflowMidnight") return te("overflowMidnight");
  if (first === "notGroup") return te("notGroup");
  if (first === "permission") return te("permission");
  if (first === "dateFormat") return te("dateFormat");
  if (first === "untilBeforeFrom") return te("untilBeforeFrom");
  if (first === "staffRequired") return te("staffRequired");
  return first;
}

export function ScheduleManager({
  slug,
  service,
  schedules,
  staffOptions,
  tone,
  lang,
}: {
  slug: string;
  service: Service;
  schedules: ScheduleEntry[];
  staffOptions: StaffOption[];
  tone: Tone;
  lang: string;
}) {
  const t = useTranslations("services.schedule");
  const tk = TONE[tone];

  const [open, setOpen] = useState(false);

  // 기존 schedule들 중 첫 번째의 staffId를 default로 채워 둠 — 한 service의
  // 트레이너는 모든 schedule에서 같다는 운영 가정. 사용자가 select를 바꾸면
  // 그 이후 새로 추가되는 schedule에만 적용 (기존 row는 immutable).
  const defaultStaffId = schedules[0]?.staff?.id ?? "";
  const [staffId, setStaffId] = useState<string>(defaultStaffId);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`rounded px-2 py-1 text-xs font-medium transition ${tk.trigger}`}
      >
        {t("trigger", { count: schedules.length })}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className={`w-full max-w-3xl overflow-hidden rounded-2xl border shadow-2xl ${tk.dialogCard}`}
          >
            <div
              className={`flex items-center justify-between border-b px-6 py-4 ${tk.dialogBorder}`}
            >
              <div>
                <h2 className="font-heading text-base tracking-tight">
                  {t("heading", { name: service.name })}
                </h2>
                <p className={`mt-0.5 text-xs ${tk.hint}`}>
                  {t("subheading", {
                    capacity: service.capacity,
                    duration: service.durationMin,
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="close"
                className={`rounded px-2 py-1 text-lg leading-none ${tk.close}`}
              >
                ×
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto p-6">
              {/* 트레이너 — service-level 단일 선택 */}
              <section
                className={`rounded-xl border p-5 ${tk.staffBar}`}
              >
                <label className={`text-xs font-medium uppercase tracking-wider ${tk.label}`}>
                  {t("staff")}
                </label>
                <p className={`mt-0.5 text-xs ${tk.hint}`}>{t("staffHint")}</p>
                <select
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  className={`mt-3 w-full rounded-lg border px-3 py-2 text-sm transition ${tk.input}`}
                >
                  <option value="">{t("staffPlaceholder")}</option>
                  {staffOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </section>

              {/* 등록된 schedule 목록 */}
              <section className="mt-6">
                <h3
                  className={`text-xs font-medium uppercase tracking-wider ${tk.label}`}
                >
                  {t("listHeading")}
                </h3>
                {schedules.length === 0 ? (
                  <p className={`mt-3 text-sm ${tk.hint}`}>{t("empty")}</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {schedules.map((s) => (
                      <ScheduleRow
                        key={s.id}
                        slug={slug}
                        schedule={s}
                        durationMin={service.durationMin}
                        tk={tk}
                      />
                    ))}
                  </ul>
                )}
              </section>

              {/* 정기 반복 추가 폼 */}
              <section
                className={`mt-6 rounded-xl border p-5 ${tk.sectionBorder}`}
              >
                <h3
                  className={`font-heading text-sm tracking-tight ${tk.sectionHeadingRecur}`}
                >
                  {t("section.recurring")}
                </h3>
                <p className={`mt-0.5 text-xs ${tk.hint}`}>
                  {t("section.recurringHint")}
                </p>
                <div className="mt-4">
                  <RecurringForm
                    slug={slug}
                    service={service}
                    staffId={staffId}
                    tk={tk}
                    lang={lang}
                  />
                </div>
              </section>

              {/* 특정 날짜 단발 추가 폼 */}
              <section
                className={`mt-6 rounded-xl border p-5 ${tk.sectionBorder}`}
              >
                <h3
                  className={`font-heading text-sm tracking-tight ${tk.sectionHeadingOneOff}`}
                >
                  {t("section.oneOff")}
                </h3>
                <p className={`mt-0.5 text-xs ${tk.hint}`}>
                  {t("section.oneOffHint")}
                </p>
                <div className="mt-4">
                  <OneOffForm
                    slug={slug}
                    service={service}
                    staffId={staffId}
                    tk={tk}
                    lang={lang}
                  />
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StartTimeField({
  startTime,
  setStartTime,
  durationMin,
  tk,
  lang,
  errOf,
}: {
  startTime: string;
  setStartTime: (v: string) => void;
  durationMin: number;
  tk: ToneSet;
  lang: string;
  errOf: (k: string) => string | null;
}) {
  const t = useTranslations("services.schedule");
  return (
    <div>
      <label className={`text-xs ${tk.label}`}>{t("startTime")}</label>
      <div className="mt-2 flex items-center gap-3">
        <NativePickerInput
          type="time"
          name="startTime"
          lang={lang}
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          required
          className={`rounded-lg border px-3 py-2 text-sm transition ${tk.input}`}
        />
        <span className={`text-xs ${tk.hint}`}>
          {t("endHint", {
            end: fmtMin(((parseHHMM(startTime) ?? 0) + durationMin) % (24 * 60)),
          })}
        </span>
      </div>
      {errOf("startTime") && (
        <p className={`mt-1 text-xs ${tk.error}`}>{errOf("startTime")}</p>
      )}
    </div>
  );
}

function RecurringForm({
  slug,
  service,
  staffId,
  tk,
  lang,
}: {
  slug: string;
  service: Service;
  staffId: string;
  tk: ToneSet;
  lang: string;
}) {
  const t = useTranslations("services.schedule");
  const te = useTranslations("services.schedule.errors");
  const [state, formAction, pending] = useActionState(createSchedule, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  const [selectedWeekdays, setSelectedWeekdays] = useState<Weekday[]>([]);
  const [startTime, setStartTime] = useState<string>("10:00");
  const [validFrom, setValidFrom] = useState<string>(todayLocal());
  const [validUntil, setValidUntil] = useState<string>("");

  useEffect(() => {
    if (state.ok && state.at) {
      formRef.current?.reset();
      setSelectedWeekdays([]);
      setStartTime("10:00");
      setValidFrom(todayLocal());
      setValidUntil("");
    }
  }, [state.ok, state.at]);

  function toggleWeekday(w: Weekday) {
    setSelectedWeekdays((cur) =>
      cur.includes(w) ? cur.filter((x) => x !== w) : [...cur, w],
    );
  }

  const errOf = (k: string) => errorMessage(state, k, te);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="serviceId" value={service.id} />
      <input type="hidden" name="kind" value="RECURRING" />
      <input type="hidden" name="staffId" value={staffId} />
      {selectedWeekdays.map((w) => (
        <input key={w} type="hidden" name="weekdays" value={w} />
      ))}

      <div>
        <label className={`text-xs ${tk.label}`}>{t("weekdays")}</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {WEEKDAY_ORDER.map((w) => {
            const active = selectedWeekdays.includes(w);
            return (
              <button
                key={w}
                type="button"
                onClick={() => toggleWeekday(w)}
                className={`rounded-md border px-3 py-1.5 text-sm transition ${
                  active ? tk.chipActive : tk.chipInactive
                }`}
              >
                {t(`weekday.${w}`)}
              </button>
            );
          })}
        </div>
        {errOf("weekdays") && (
          <p className={`mt-1 text-xs ${tk.error}`}>{errOf("weekdays")}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className={`text-xs ${tk.label}`}>{t("validFrom")}</label>
          <NativePickerInput
            type="date"
            name="validFrom"
            lang={lang}
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
            required
            className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm transition ${tk.input}`}
          />
          {errOf("validFrom") && (
            <p className={`mt-1 text-xs ${tk.error}`}>{errOf("validFrom")}</p>
          )}
        </div>
        <div>
          <label className={`text-xs ${tk.label}`}>{t("validUntil")}</label>
          <NativePickerInput
            type="date"
            name="validUntil"
            lang={lang}
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm transition ${tk.input}`}
          />
          <p className={`mt-1 text-xs ${tk.hint}`}>{t("validUntilHint")}</p>
          {errOf("validUntil") && (
            <p className={`mt-1 text-xs ${tk.error}`}>{errOf("validUntil")}</p>
          )}
        </div>
      </div>

      <StartTimeField
        startTime={startTime}
        setStartTime={setStartTime}
        durationMin={service.durationMin}
        tk={tk}
        lang={lang}
        errOf={errOf}
      />

      <div>
        <label className={`text-xs ${tk.label}`}>{t("note")}</label>
        <input
          type="text"
          name="note"
          placeholder={t("notePlaceholder")}
          maxLength={120}
          className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm transition ${tk.input}`}
        />
      </div>

      {(!staffId || errOf("staffId")) && (
        <p className={`text-sm ${tk.error}`}>{te("staffRequired")}</p>
      )}
      {state.errors?._global && (
        <p className={`text-sm ${tk.error}`}>{errOf("_global")}</p>
      )}

      <button
        type="submit"
        disabled={pending || !staffId}
        className={`rounded-lg px-5 py-2.5 text-sm font-medium transition disabled:opacity-50 ${tk.button}`}
      >
        {pending ? t("addingRecurring") : t("addRecurring")}
      </button>
    </form>
  );
}

function OneOffForm({
  slug,
  service,
  staffId,
  tk,
  lang,
}: {
  slug: string;
  service: Service;
  staffId: string;
  tk: ToneSet;
  lang: string;
}) {
  const t = useTranslations("services.schedule");
  const te = useTranslations("services.schedule.errors");
  const [state, formAction, pending] = useActionState(createSchedule, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  const [specificDate, setSpecificDate] = useState<string>(todayLocal());
  const [startTime, setStartTime] = useState<string>("10:00");

  useEffect(() => {
    if (state.ok && state.at) {
      formRef.current?.reset();
      setSpecificDate(todayLocal());
      setStartTime("10:00");
    }
  }, [state.ok, state.at]);

  const errOf = (k: string) => errorMessage(state, k, te);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="serviceId" value={service.id} />
      <input type="hidden" name="kind" value="ONE_OFF" />
      <input type="hidden" name="staffId" value={staffId} />

      <div>
        <label className={`text-xs ${tk.label}`}>{t("specificDate")}</label>
        <NativePickerInput
          type="date"
          name="specificDate"
          lang={lang}
          value={specificDate}
          onChange={(e) => setSpecificDate(e.target.value)}
          required
          className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm transition ${tk.input}`}
        />
        <p className={`mt-1 text-xs ${tk.hint}`}>{t("specificDateHint")}</p>
        {errOf("specificDate") && (
          <p className={`mt-1 text-xs ${tk.error}`}>{errOf("specificDate")}</p>
        )}
      </div>

      <StartTimeField
        startTime={startTime}
        setStartTime={setStartTime}
        durationMin={service.durationMin}
        tk={tk}
        lang={lang}
        errOf={errOf}
      />

      {(!staffId || errOf("staffId")) && (
        <p className={`text-sm ${tk.error}`}>{te("staffRequired")}</p>
      )}
      {state.errors?._global && (
        <p className={`text-sm ${tk.error}`}>{errOf("_global")}</p>
      )}

      <button
        type="submit"
        disabled={pending || !staffId}
        className={`rounded-lg px-5 py-2.5 text-sm font-medium transition disabled:opacity-50 ${tk.button}`}
      >
        {pending ? t("addingOneOff") : t("addOneOff")}
      </button>
    </form>
  );
}

function ScheduleRow({
  slug,
  schedule,
  durationMin,
  tk,
}: {
  slug: string;
  schedule: ScheduleEntry;
  durationMin: number;
  tk: ToneSet;
}) {
  const t = useTranslations("services.schedule");
  const te = useTranslations("services.schedule.errors");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const start = schedule.startMinute;
  const end = (start + durationMin) % (24 * 60);
  const timeRange = `${fmtMin(start)}~${fmtMin(end)}`;
  const staffName = schedule.staff?.user.name ?? t("staffNone");

  let dayLabel: string;
  let rangeLabel: string;
  let badgeClass: string;
  let badgeLabel: string;

  if (schedule.kind === "RECURRING") {
    const ordered = WEEKDAY_ORDER.filter((w) =>
      schedule.weekdays.includes(w),
    );
    dayLabel = ordered.map((w) => t(`weekdayShort.${w}`)).join("·");
    const fromStr = ymd(schedule.validFrom);
    rangeLabel = schedule.validUntil
      ? t("rangeWithUntil", { from: fromStr, until: ymd(schedule.validUntil) })
      : t("rangeOpen", { from: fromStr });
    badgeClass = tk.rowBadgeRecur;
    badgeLabel = t("badgeRecurring");
  } else {
    const dateStr = schedule.specificDate ? ymd(schedule.specificDate) : "";
    dayLabel = dateStr;
    rangeLabel = "";
    badgeClass = tk.rowBadgeOneOff;
    badgeLabel = t("badgeOneOff");
  }

  function onDelete() {
    if (!confirm(`${dayLabel} ${timeRange} — ${t("delete")}?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteSchedule(slug, schedule.id);
      if (res.error) {
        const msg =
          res.error === "hasReservations"
            ? te("hasReservations")
            : te("permission");
        setError(msg);
      }
    });
  }

  return (
    <li className={`rounded-lg border px-4 py-3 ${tk.rowCard}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${badgeClass}`}
          >
            {badgeLabel}
          </span>
          <span className="font-medium tabular-nums">
            {dayLabel} · {timeRange}
          </span>
          <span className={`text-xs ${tk.rowMeta}`}>{staffName}</span>
        </div>
        <div className="flex items-center gap-2">
          {error && <span className={`text-[10px] ${tk.error}`}>{error}</span>}
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className={`rounded px-2 py-1 text-xs font-medium transition disabled:opacity-50 ${tk.deleteBtn}`}
          >
            {pending ? t("deleting") : t("delete")}
          </button>
        </div>
      </div>
      {rangeLabel && (
        <div className={`mt-1 text-xs tabular-nums ${tk.rowMeta}`}>
          {rangeLabel}
        </div>
      )}
      {schedule.note && (
        <div className={`mt-1 text-xs ${tk.rowMeta}`}>· {schedule.note}</div>
      )}
    </li>
  );
}
