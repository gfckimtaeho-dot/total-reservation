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

  // 다음에 채울 예약 — 가장 이른 것.
  const next = pending[0] ?? null;

  // free 슬롯 또는 본인 예약이 있는 날만 노출.
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
        // pending 은 서버 상태에서 파생 — 새로고침하면 한 건 줄어든다.
        router.refresh();
      } else {
        setError(t("rebookError"));
      }
    });
  }

  if (visibleDays.length === 0) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-zinc-400 backdrop-blur-xl">
        {t("rebookNoSlots")}
      </section>
    );
  }

  return (
    <section className="space-y-3">
      {next && (
        <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 backdrop-blur-xl">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-200/90">
            {t("rebookNextLabel")}
          </div>
          <div className="mt-1 text-sm tabular-nums text-amber-100">
            {formatResv(next.startIso, next.serviceName, lang)}
          </div>
          <div className="mt-0.5 text-[11px] text-amber-200/70">
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
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur">
      <div className="px-1 text-xs font-semibold text-zinc-200">
        {dateLabel}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {d.cells.map((c, slotIdx) => {
          // 본인의 이미 옮겨진 예약 — 누를 수 없는 에메랄드 칩으로 표시.
          if (c.kind === "booked" && c.ev.customerId === currentUserId) {
            return (
              <span
                key={slotIdx}
                className="rounded-md bg-emerald-500/20 px-3 py-1.5 text-xs font-medium tabular-nums text-emerald-200 ring-1 ring-emerald-400/30"
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
  // 모달은 사용자 클릭 후에만 렌더 — SSR 시점엔 안 뜨므로 createPortal 직접 호출 안전.
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
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
        <div className="font-heading text-lg tracking-tight text-white">
          {t("rebookConfirmTitle")}
        </div>
        <div className="mt-3 space-y-1.5 text-sm">
          <div className="text-zinc-400 line-through tabular-nums">
            {formatBare(oldIso)}
          </div>
          <div className="font-medium tabular-nums text-white">
            {newLabel}
          </div>
          <div className="text-xs text-zinc-400">
            {t("rebookConfirmTrainer", { name: trainerName })}
          </div>
        </div>
        {error && <div className="mt-3 text-xs text-rose-400">{error}</div>}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="flex-1 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_18px_-6px_rgba(251,146,60,0.6)] hover:brightness-110 disabled:opacity-60"
          >
            {pending ? t("rebookSubmitting") : t("rebookConfirmYes")}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-full bg-white/5 px-4 py-2.5 text-sm text-zinc-200 ring-1 ring-white/15 hover:bg-white/10 disabled:opacity-60"
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

// 예약 시각은 UTC-naive(벽시계) — timeZone:"UTC" 로 읽는다.
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
