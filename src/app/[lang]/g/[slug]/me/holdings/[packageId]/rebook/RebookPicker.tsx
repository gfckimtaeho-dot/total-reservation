"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { rebookOnNewTrainer } from "../../actions";
import type { GridDay } from "@/lib/calendar/trainerCalendarPro";

type Pending = { id: string; startIso: string; serviceName: string };

// 페이지 B 클라이언트 — 새 트레이너의 빈 슬롯에서 충돌 예약을 다시 잡는다.
// 재예약은 FIFO: 가장 이른 pending 건부터 채운다. 본인의 이미 옮겨진 예약은
// 캘린더에 "내 예약"으로 표시해 무엇이 끝났는지 보이게 한다.
export function RebookPicker({
  slug,
  lang,
  packageId,
  trainerName,
  currentUserId,
  pending,
  days,
  slotAxis,
}: {
  slug: string;
  lang: string;
  packageId: string;
  trainerName: string;
  currentUserId: string;
  pending: Pending[];
  days: GridDay[];
  slotAxis: number[];
}) {
  const t = useTranslations("me");
  const router = useRouter();
  const [chosen, setChosen] = useState<
    null | { dayIdx: number; slotIdx: number }
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingTx, startTx] = useTransition();

  const next = pending[0] ?? null;

  const visibleDays = useMemo(
    () =>
      days
        .map((d, i) => ({ d, i }))
        .filter(({ d }) => {
          if (d.state !== "open") return false;
          return d.cells.some(
            (c) =>
              c.kind === "free" ||
              (c.kind === "booked" && c.ev.customerId === currentUserId),
          );
        }),
    [days, currentUserId],
  );

  function isoFor(d: GridDay, startMin: number): string {
    const h = Math.floor(startMin / 60);
    const m = startMin % 60;
    return new Date(
      Date.UTC(d.year, d.month - 1, d.day, h, m, 0),
    ).toISOString();
  }

  function submit() {
    if (!chosen || !next) return;
    const d = days[chosen.dayIdx];
    const iso = isoFor(d, slotAxis[chosen.slotIdx]);
    setError(null);
    startTx(async () => {
      const r = await rebookOnNewTrainer(slug, packageId, next.id, iso);
      if (r.ok) {
        setChosen(null);
        router.refresh();
      } else {
        setError(t("rebookError"));
      }
    });
  }

  if (visibleDays.length === 0) {
    return (
      <section className="rounded-3xl bg-white/70 p-5 text-sm text-zinc-600 ring-1 ring-white/80 backdrop-blur-xl shadow-[0_24px_60px_-30px_rgba(249,115,22,0.45)]">
        {t("rebookNoSlots")}
      </section>
    );
  }

  return (
    <section className="space-y-3">
      {next && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 backdrop-blur">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-700">
            {t("rebookNextLabel")}
          </div>
          <div className="mt-1 text-sm tabular-nums text-amber-900">
            {formatResv(next.startIso, next.serviceName, lang)}
          </div>
          <div className="mt-0.5 text-[11px] text-amber-700/80">
            {t("rebookNextHint", { name: trainerName })}
          </div>
        </div>
      )}

      {visibleDays.map(({ d, i }) => (
        <DayBlock
          key={`${d.year}-${d.month}-${d.day}`}
          d={d}
          dayIdx={i}
          slotAxis={slotAxis}
          currentUserId={currentUserId}
          chosen={chosen}
          onPick={(slotIdx) => {
            setError(null);
            setChosen({ dayIdx: i, slotIdx });
          }}
          lang={lang}
          mineLabel={t("rebookMine")}
        />
      ))}

      {chosen && next && (
        <ConfirmModal
          oldIso={next.startIso}
          newLabel={formatSlot(days[chosen.dayIdx], slotAxis[chosen.slotIdx], lang)}
          trainerName={trainerName}
          pending={pendingTx}
          error={error}
          onConfirm={submit}
          onClose={() => {
            if (!pendingTx) setChosen(null);
          }}
        />
      )}
    </section>
  );
}

function DayBlock({
  d,
  dayIdx,
  slotAxis,
  currentUserId,
  chosen,
  onPick,
  lang,
  mineLabel,
}: {
  d: GridDay;
  dayIdx: number;
  slotAxis: number[];
  currentUserId: string;
  chosen: { dayIdx: number; slotIdx: number } | null;
  onPick: (slotIdx: number) => void;
  lang: string;
  mineLabel: string;
}) {
  const dateLabel = new Intl.DateTimeFormat(
    lang === "en" ? "en-US" : "ko-KR",
    { timeZone: "UTC", month: "short", day: "numeric", weekday: "short" },
  ).format(new Date(Date.UTC(d.year, d.month - 1, d.day, 12, 0, 0)));

  return (
    <div className="rounded-2xl bg-white/70 p-3 ring-1 ring-white/80 backdrop-blur-xl shadow-[0_24px_60px_-30px_rgba(249,115,22,0.45)]">
      <div className="px-1 text-xs font-semibold text-zinc-700">
        {dateLabel}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {d.cells.map((c, slotIdx) => {
          if (c.kind === "booked" && c.ev.customerId === currentUserId) {
            return (
              <span
                key={slotIdx}
                className="rounded-md bg-emerald-100 px-3 py-1.5 text-xs font-medium tabular-nums text-emerald-800 ring-1 ring-emerald-300"
              >
                {formatMin(slotAxis[slotIdx])} · {mineLabel}
              </span>
            );
          }
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
                  ? "bg-gradient-to-r from-orange-500 to-rose-500 text-white ring-orange-400"
                  : "bg-white text-zinc-700 ring-orange-200 hover:bg-orange-50 hover:ring-orange-300")
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

function ConfirmModal({
  oldIso,
  newLabel,
  trainerName,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  oldIso: string;
  newLabel: string;
  trainerName: string;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("me");
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-3xl border border-orange-200/80 bg-white p-6 shadow-[0_30px_80px_-20px_rgba(249,115,22,0.45)]">
        <div className="font-heading text-lg font-bold tracking-tight text-zinc-900">
          {t("rebookConfirmTitle")}
        </div>
        <div className="mt-3 space-y-1.5 text-sm">
          <div className="text-zinc-500 line-through tabular-nums">
            {formatBare(oldIso)}
          </div>
          <div className="font-medium tabular-nums text-zinc-900">
            {newLabel}
          </div>
          <div className="text-xs text-zinc-500">
            {t("rebookConfirmTrainer", { name: trainerName })}
          </div>
        </div>
        {error && <div className="mt-3 text-xs text-rose-700">{error}</div>}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="flex-1 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_15px_40px_-15px_rgba(249,115,22,0.55)] hover:brightness-110 disabled:opacity-60"
          >
            {pending ? t("rebookSubmitting") : t("rebookConfirmYes")}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-full bg-white px-4 py-2.5 text-sm text-zinc-700 ring-1 ring-orange-200 hover:bg-orange-50 disabled:opacity-60"
          >
            {t("rebookConfirmNo")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function formatMin(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(
    m % 60,
  ).padStart(2, "0")}`;
}

function formatResv(iso: string, serviceName: string, lang: string): string {
  return `${formatBare(iso, lang)} · ${serviceName}`;
}

function formatBare(iso: string, lang = "ko"): string {
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "ko-KR", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function formatSlot(d: GridDay, startMin: number, lang: string): string {
  const date = new Intl.DateTimeFormat(lang === "en" ? "en-US" : "ko-KR", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(new Date(Date.UTC(d.year, d.month - 1, d.day, 12, 0, 0)));
  return `${date} ${formatMin(startMin)}`;
}
