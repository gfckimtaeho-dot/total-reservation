"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { ClosureKind } from "@/generated/prisma/enums";
import { removeClosure, saveClosure, type SaveClosureState } from "./actions";

type ClosureItem = {
  id: string;
  date: string; // YYYY-MM-DD
  kind: ClosureKind;
  openMinute: number | null;
  closeMinute: number | null;
  reason: string | null;
};

const TONE = {
  normal: {
    section: "rounded-2xl bg-white ring-1 ring-amber-200/60 p-6",
    title: "text-ink",
    subtle: "text-zinc-600",
    label: "text-ink",
    cell: "border-zinc-200 hover:bg-amber-50",
    cellMuted: "border-zinc-100 text-zinc-300",
    cellToday: "ring-2 ring-amber-400",
    cellWithClosure: "bg-rose-50 border-rose-200 text-rose-700",
    cellWithShortened: "bg-amber-50 border-amber-200 text-amber-800",
    badge: "bg-rose-100 text-rose-700 ring-1 ring-rose-200",
    badgeShort: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
    modal: "bg-white text-ink",
    modalOverlay: "bg-black/40",
    input:
      "h-10 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-900 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20",
    submit: "bg-ink text-white hover:bg-ink/90",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
    cancel: "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
    kindOn: "bg-ink text-white",
    kindOff: "bg-zinc-100 text-zinc-600",
  },
  black: {
    section: "rounded-2xl bg-zinc-900 ring-1 ring-white/10 p-6",
    title: "text-white",
    subtle: "text-zinc-400",
    label: "text-zinc-100",
    cell: "border-white/5 hover:bg-white/5 text-zinc-300",
    cellMuted: "border-white/5 text-zinc-700",
    cellToday: "ring-2 ring-amber-300",
    cellWithClosure: "bg-rose-400/10 border-rose-400/30 text-rose-300",
    cellWithShortened: "bg-amber-400/10 border-amber-400/30 text-amber-200",
    badge: "bg-rose-400/15 text-rose-300 ring-1 ring-rose-400/30",
    badgeShort: "bg-amber-400/15 text-amber-200 ring-1 ring-amber-400/30",
    modal: "bg-zinc-900 text-zinc-100 ring-1 ring-white/10",
    modalOverlay: "bg-black/60",
    input:
      "h-10 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-sm text-zinc-100 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30 [color-scheme:dark]",
    submit: "bg-amber-300 text-zinc-950 hover:bg-amber-200",
    danger: "bg-rose-500 text-white hover:bg-rose-400",
    cancel: "bg-zinc-800 text-zinc-300 hover:bg-zinc-700",
    kindOn: "bg-amber-300 text-zinc-950",
    kindOff: "bg-zinc-800 text-zinc-400",
  },
  white: {
    section: "rounded-2xl bg-white ring-1 ring-zinc-200 p-6",
    title: "text-ink",
    subtle: "text-zinc-600",
    label: "text-ink",
    cell: "border-zinc-200 hover:bg-zinc-50",
    cellMuted: "border-zinc-100 text-zinc-300",
    cellToday: "ring-2 ring-sky-500",
    cellWithClosure: "bg-rose-50 border-rose-200 text-rose-700",
    cellWithShortened: "bg-amber-50 border-amber-200 text-amber-800",
    badge: "bg-rose-100 text-rose-700 ring-1 ring-rose-200",
    badgeShort: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
    modal: "bg-white text-ink",
    modalOverlay: "bg-black/40",
    input:
      "h-10 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-900 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20",
    submit: "bg-ink text-white hover:bg-ink/90",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
    cancel: "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
    kindOn: "bg-ink text-white",
    kindOff: "bg-zinc-100 text-zinc-600",
  },
} as const;

const KINDS: ClosureKind[] = ["CLOSED", "SHORTENED"];

function fmtMin(min: number): string {
  if (min === 1440) return "24:00";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// 캘린더 셀처럼 좁은 공간용 압축 포맷. 분이 0이면 시(時)만, 아니면 H:MM.
function compactMin(min: number): string {
  if (min === 1440) return "24";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? String(h) : `${h}:${String(m).padStart(2, "0")}`;
}

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(1);
  x.setMonth(x.getMonth() + n);
  return x;
}

const initialState: SaveClosureState = {};

export function ClosureManager({
  lang,
  slug,
  tone,
  initialClosures,
}: {
  lang: string;
  slug: string;
  tone: keyof typeof TONE;
  initialClosures: ClosureItem[];
}) {
  const t = useTranslations("hours");
  const tk = TONE[tone];

  const closureByDate = useMemo(() => {
    const map = new Map<string, ClosureItem>();
    for (const c of initialClosures) map.set(c.date, c);
    return map;
  }, [initialClosures]);

  const [cursor, setCursor] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [editing, setEditing] = useState<{
    date: string;
    existing: ClosureItem | null;
  } | null>(null);

  const [state, formAction, pending] = useActionState(
    saveClosure,
    initialState,
  );
  const [, startDelete] = useTransition();

  const todayYmd = ymdLocal(new Date());

  // 저장 성공 시 모달 닫기. state.at(매번 새 timestamp)에 의존해야
  // 두 번째 저장도 useEffect가 발화됨.
  useEffect(() => {
    if (state.ok) setEditing(null);
  }, [state.at, state.ok]);

  const monthLabel = `${cursor.getFullYear()}.${String(cursor.getMonth() + 1).padStart(2, "0")}`;
  const weekdayLabels = lang.startsWith("ko")
    ? ["일", "월", "화", "수", "목", "금", "토"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // 캘린더 셀: 이번 달 1일 요일부터 시작, 6주(42칸).
  const firstDow = new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay();
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(cursor.getFullYear(), cursor.getMonth(), 1 - firstDow + i);
    cells.push({ date: d, inMonth: d.getMonth() === cursor.getMonth() });
  }

  const sortedClosures = [...initialClosures].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );

  function onDelete(id: string) {
    startDelete(async () => {
      await removeClosure(slug, id);
      setEditing(null);
    });
  }

  return (
    <section className={tk.section}>
      <header className="flex items-baseline justify-between gap-3">
        <h2 className={`font-heading text-lg tracking-tight ${tk.title}`}>
          {t("closuresTitle")}
        </h2>
        <span className={`text-xs ${tk.subtle}`}>{t("closuresHint")}</span>
      </header>

      <div className="mt-5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCursor(addMonths(cursor, -1))}
          className={`h-9 w-9 rounded-md text-sm ${tk.cancel}`}
        >
          ‹
        </button>
        <div className={`font-heading text-base ${tk.title}`}>{monthLabel}</div>
        <button
          type="button"
          onClick={() => setCursor(addMonths(cursor, 1))}
          className={`h-9 w-9 rounded-md text-sm ${tk.cancel}`}
        >
          ›
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] uppercase">
        {weekdayLabels.map((w) => (
          <div key={w} className={`whitespace-nowrap ${tk.subtle}`}>
            {w}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          const dStr = ymdLocal(c.date);
          const closure = closureByDate.get(dStr);
          const isToday = dStr === todayYmd;
          return (
            <button
              key={i}
              type="button"
              onClick={() =>
                setEditing({ date: dStr, existing: closure ?? null })
              }
              className={`relative flex h-20 flex-col items-stretch rounded-md border p-1 text-left transition ${
                !c.inMonth
                  ? tk.cellMuted
                  : closure
                    ? closure.kind === "CLOSED"
                      ? tk.cellWithClosure
                      : tk.cellWithShortened
                    : tk.cell
              } ${isToday ? tk.cellToday : ""}`}
            >
              <span className="px-1 text-base font-bold leading-none">
                {c.date.getDate()}
              </span>
              {closure && (
                <div
                  className={`mt-1 flex flex-1 flex-col justify-center rounded px-1 py-0.5 text-center font-bold ${
                    closure.kind === "CLOSED" ? tk.badge : tk.badgeShort
                  }`}
                >
                  <div className="truncate text-[9px] leading-tight">
                    {closure.kind === "CLOSED"
                      ? t("kindClosed")
                      : t("kindShortened")}
                  </div>
                  {closure.kind === "SHORTENED" &&
                    closure.openMinute != null &&
                    closure.closeMinute != null && (
                      <div className="truncate text-[9px] leading-tight tabular-nums">
                        {compactMin(closure.openMinute)}~{compactMin(closure.closeMinute)}
                      </div>
                    )}
                  {closure.reason && (
                    <div className="truncate text-[9px] font-medium leading-tight">
                      {closure.reason}
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* 등록된 closure 목록 */}
      <div className="mt-6">
        <div className={`mb-2 text-xs font-semibold uppercase tracking-wider ${tk.subtle}`}>
          {t("upcomingClosures")}
        </div>
        {sortedClosures.length === 0 ? (
          <div className={`text-sm ${tk.subtle}`}>{t("noClosures")}</div>
        ) : (
          <ul className="space-y-1.5">
            {sortedClosures.map((c) => (
              <li
                key={c.id}
                className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm ${
                  tone === "black"
                    ? "border-white/5 bg-zinc-950/40"
                    : "border-zinc-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`font-mono text-xs ${tk.label}`}>{c.date}</span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                      c.kind === "CLOSED" ? tk.badge : tk.badgeShort
                    }`}
                  >
                    {c.kind === "CLOSED" ? t("kindClosed") : t("kindShortened")}
                  </span>
                  {c.kind === "SHORTENED" && c.openMinute != null && c.closeMinute != null && (
                    <span className={`text-xs ${tk.subtle}`}>
                      {fmtMin(c.openMinute)} ~ {fmtMin(c.closeMinute)}
                    </span>
                  )}
                  {c.reason && <span className={`text-xs ${tk.subtle}`}>· {c.reason}</span>}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setEditing({ date: c.date, existing: c })
                  }
                  className={`text-xs underline ${tk.subtle}`}
                >
                  {t("editClosure")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing && (
        <ClosureModal
          key={editing.date + (editing.existing?.id ?? "new")}
          lang={lang}
          slug={slug}
          tone={tone}
          editing={editing}
          state={state}
          formAction={formAction}
          pending={pending}
          onCancel={() => setEditing(null)}
          onDelete={onDelete}
        />
      )}
    </section>
  );
}

function ClosureModal({
  lang,
  slug,
  tone,
  editing,
  state,
  formAction,
  pending,
  onCancel,
  onDelete,
}: {
  lang: string;
  slug: string;
  tone: keyof typeof TONE;
  editing: { date: string; existing: ClosureItem | null };
  state: SaveClosureState;
  formAction: (formData: FormData) => void;
  pending: boolean;
  onCancel: () => void;
  onDelete: (id: string) => void;
}) {
  const t = useTranslations("hours");
  const tk = TONE[tone];
  const ex = editing.existing;

  const [kind, setKind] = useState<ClosureKind>(ex?.kind ?? "CLOSED");

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center px-4 ${tk.modalOverlay}`}
      onClick={onCancel}
    >
      <div
        className={`w-full max-w-md rounded-2xl p-6 shadow-2xl ${tk.modal}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className={`font-heading text-lg ${tk.title}`}>
          {ex ? t("editClosure") : t("addClosure")} · {editing.date}
        </h3>

        <form action={formAction} className="mt-4 space-y-3">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="date" value={editing.date} />
          <input type="hidden" name="kind" value={kind} />

          <div className="flex gap-1.5">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`flex-1 rounded-md py-2 text-xs font-bold transition ${
                  kind === k ? tk.kindOn : tk.kindOff
                }`}
              >
                {k === "CLOSED" ? t("kindClosed") : t("kindShortened")}
              </button>
            ))}
          </div>

          {kind === "SHORTENED" && (
            <div className="flex items-center gap-2">
              <input
                type="time"
                lang={lang}
                name="openTime"
                defaultValue={ex?.openMinute != null ? fmtMin(ex.openMinute) : "09:00"}
                className={`${tk.input} flex-1`}
              />
              <span className={`text-xs ${tk.subtle}`}>~</span>
              <input
                type="time"
                lang={lang}
                name="closeTime"
                defaultValue={ex?.closeMinute != null ? fmtMin(ex.closeMinute) : "15:00"}
                className={`${tk.input} flex-1`}
              />
            </div>
          )}

          <div>
            <label className={`text-xs ${tk.subtle}`}>{t("reasonLabel")}</label>
            <input
              type="text"
              name="reason"
              defaultValue={ex?.reason ?? ""}
              placeholder={t("reasonPlaceholder")}
              maxLength={120}
              className={`${tk.input} mt-1 w-full`}
            />
          </div>

          {state.error && (
            <div className="rounded-md border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-xs text-rose-300">
              {state.error}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            {ex && (
              <button
                type="button"
                onClick={() => onDelete(ex.id)}
                className={`mr-auto h-10 rounded-md px-3 text-xs font-bold ${tk.danger}`}
              >
                {t("delete")}
              </button>
            )}
            <button
              type="button"
              onClick={onCancel}
              className={`h-10 rounded-md px-4 text-sm ${tk.cancel}`}
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={pending}
              className={`h-10 rounded-md px-5 text-sm font-medium disabled:opacity-60 ${tk.submit}`}
            >
              {pending ? t("saving") : t("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
