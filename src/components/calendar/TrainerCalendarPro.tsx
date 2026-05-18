"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type {
  TrainerCalendarData,
  GridDay,
  CellEvent,
} from "@/lib/calendar/trainerCalendarPro";
import {
  rescheduleReservation,
  completeReservation,
} from "@/app/[lang]/g/[slug]/dashboard/reservation-actions";
import Link from "next/link";
import {
  searchCustomers,
  addReservation,
} from "@/app/[lang]/g/[slug]/dashboard/service-actions";

const WD_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;
const WD_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const COLS = 31; // 선택일부터 우측으로 보여줄 일수 (가로 스크롤)

function hm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(
    min % 60,
  ).padStart(2, "0")}`;
}
function keyNum(y: number, m: number, d: number) {
  return y * 10000 + m * 100 + d;
}

type Picked = {
  evId: string;
  custId: string | null;
  name: string;
  service: string;
  whenLabel: string;
  rel: "past" | "today" | "future";
  completed: boolean;
  // 클릭한 셀 기준 팝오버 위치 (뷰포트 좌표)
  ax: number;
  ay: number;
};

type Cust = { id: string; name: string; phone: string | null };
type Modal = null | { t: "addRes"; g: GridDay; slotMin: number };

export function TrainerCalendarPro({
  data,
  slug,
  lang = "ko",
}: {
  data: TrainerCalendarData;
  slug: string;
  lang?: string;
}) {
  const t = useTranslations("trainerCal");
  const router = useRouter();
  const WD = lang === "en" ? WD_EN : WD_KO;
  const [pending, startTransition] = useTransition();
  const [selIdx, setSelIdx] = useState(data.todayIdx);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [moving, setMoving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [cq, setCq] = useState("");
  const [cresults, setCresults] = useState<Cust[]>([]);

  const todayKey = keyNum(
    data.today.year,
    data.today.month,
    data.today.day,
  );
  function relOf(g: GridDay): "past" | "today" | "future" {
    const k = keyNum(g.year, g.month, g.day);
    return k < todayKey ? "past" : k > todayKey ? "future" : "today";
  }
  // 현재 시각 이전 슬롯인가 (UTC-naive 기준 = 표시 기준). 오늘인데
  // 슬롯 시작이 지금보다 이르면 과거 → 이동 대상 불가.
  const _n = new Date();
  const nowMin = _n.getUTCHours() * 60 + _n.getUTCMinutes();
  function slotIsPast(g: GridDay, slotMin: number): boolean {
    const r = relOf(g);
    if (r === "past") return true;
    if (r === "today" && slotMin < nowMin) return true;
    return false;
  }

  const lastStart = Math.max(0, data.days.length - 1);
  const clampSel = (i: number) => Math.min(Math.max(0, i), lastStart);
  const visible = data.days.slice(selIdx, selIdx + COLS);
  const selDay = data.days[selIdx];
  const selLabel = selDay
    ? `${selDay.month}/${selDay.day} (${WD[selDay.weekdayIdx]})`
    : "";

  function reset() {
    setPicked(null);
    setMoving(false);
    setErr(null);
  }
  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setErr(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) {
        setErr(r.error || t("actionFailed"));
        return;
      }
      reset();
      setModal(null);
      router.refresh();
    });
  }

  function closeModal() {
    setModal(null);
    setCq("");
    setCresults([]);
    setErr(null);
  }
  function doSearch() {
    startTransition(async () => {
      const r = await searchCustomers({ slug, q: cq });
      if (r.ok) setCresults((r.data as Cust[]) ?? []);
    });
  }
  function doAddRes(custId: string) {
    if (modal?.t !== "addRes") return;
    const { g, slotMin } = modal;
    run(() =>
      addReservation({
        slug,
        customerUserId: custId,
        year: g.year,
        month: g.month,
        day: g.day,
        startMin: slotMin,
      }),
    );
  }

  function onBookedTap(
    g: GridDay,
    slotMin: number,
    ev: CellEvent,
    el: HTMLElement,
  ) {
    if (moving) {
      setErr(t("errBooked"));
      return;
    }
    setErr(null);
    const r = el.getBoundingClientRect();
    setPicked({
      evId: ev.id,
      custId: ev.customerId,
      name: ev.customerName,
      service: ev.service,
      whenLabel: `${hm(slotMin)} · ${g.month}/${g.day}`,
      rel: relOf(g),
      completed: ev.completed,
      ax: r.left + r.width / 2,
      ay: r.bottom,
    });
  }

  function onFreeTap(g: GridDay, slotMin: number) {
    if (!moving || !picked) return;
    if (slotIsPast(g, slotMin)) {
      setErr(t("errPast"));
      return;
    }
    const when = `${g.month}/${g.day} ${hm(slotMin)}`;
    if (
      typeof window !== "undefined" &&
      !window.confirm(t("confirmMove", { name: picked.name, when }))
    )
      return;
    run(() =>
      rescheduleReservation({
        slug,
        reservationId: picked.evId,
        year: g.year,
        month: g.month,
        day: g.day,
        startMin: slotMin,
      }),
    );
  }

  function doComplete() {
    if (!picked) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(t("confirmComplete", { name: picked.name }))
    )
      return;
    run(() =>
      completeReservation({ slug, reservationId: picked.evId }),
    );
  }

  const canMove = picked && picked.rel !== "past" && !picked.completed;
  const canComplete =
    picked && picked.rel !== "future" && !picked.completed;

  const COL_W = "w-24";
  const AXIS_W = "w-14";
  const ROW_H = "h-10";

  return (
    <section className="rounded-2xl border border-amber-400/25 bg-black p-4 text-zinc-100">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-base tracking-tight text-white">
          {selLabel} {t("scheduleSuffix")}
        </h2>
        <div className="flex items-center gap-1">
          <Link
            href={`/${lang}/g/${slug}/intake`}
            className="mr-1 flex h-8 items-center rounded-md border border-emerald-400/40 bg-emerald-400/10 px-2.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-400 hover:text-zinc-950"
          >
            {t("goIntake")}
          </Link>
          <button
            type="button"
            onClick={() => setSelIdx((i) => clampSel(i - 1))}
            className="h-8 w-8 rounded-md border border-white/15 text-zinc-300 transition hover:bg-white/10"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setSelIdx(data.todayIdx)}
            className="h-8 rounded-md border border-white/15 px-2 text-xs text-zinc-300 transition hover:bg-white/10"
          >
            {t("jumpToday")}
          </button>
          <button
            type="button"
            onClick={() => setSelIdx((i) => clampSel(i + 1))}
            className="h-8 w-8 rounded-md border border-white/15 text-zinc-300 transition hover:bg-white/10"
          >
            ›
          </button>
        </div>
      </div>

      {/* 이동 모드 배너만 상단 유지(진행 안내) */}
      {moving && picked && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-amber-400/15 px-3 py-2 text-sm text-amber-200 ring-1 ring-amber-400/40">
          <span>{t("movingBanner", { name: picked.name })}</span>
          <button
            type="button"
            onClick={reset}
            className="shrink-0 rounded-md border border-amber-400/40 px-2 py-1 text-xs hover:bg-amber-400/20"
          >
            {t("movingStop")}
          </button>
        </div>
      )}
      {!picked && !moving && (
        <p className="mt-3 text-[11px] text-zinc-500">
          {t("tapBookingHint")}
        </p>
      )}
      {err && <p className="mt-2 text-sm text-rose-400">{err}</p>}

      {/* 오늘 일정 — 항상 보이는 요약 (그리드와 별개) */}
      {(() => {
        const td = data.days[data.todayIdx];
        if (!td) return null;
        const todays = td.cells
          .map((c, i) =>
            c.kind === "booked"
              ? { s: data.slotAxis[i], ev: c.ev }
              : null,
          )
          .filter((x): x is { s: number; ev: CellEvent } => x != null);
        return (
          <div className="mt-3 rounded-lg bg-zinc-900/70 p-3 ring-1 ring-amber-400/30">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300/90">
                {t("todayHeading", {
                  date: `${data.today.month}/${data.today.day}`,
                })}
              </h3>
              <span className="text-[11px] tabular-nums text-zinc-500">
                {todays.length}
              </span>
            </div>
            {td.state !== "open" ? (
              <p className="mt-2 text-sm text-zinc-500">
                {td.state === "closed"
                  ? td.reason || t("closed")
                  : t("off")}
              </p>
            ) : todays.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">
                {t("todayEmpty")}
              </p>
            ) : (
              <ul className="mt-2 space-y-1">
                {todays.map(({ s, ev }) => (
                  <li key={ev.id}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={(e) =>
                        onBookedTap(td, s, ev, e.currentTarget)
                      }
                      className={`flex w-full items-center gap-3 rounded-md px-2.5 py-1.5 text-sm transition disabled:opacity-50 ${
                        ev.completed
                          ? "bg-emerald-500/12 text-emerald-200 hover:bg-emerald-500/20"
                          : "bg-amber-400/15 text-amber-100 hover:bg-amber-400/25"
                      }`}
                    >
                      <span className="font-mono text-xs tabular-nums text-amber-300">
                        {hm(s)}
                      </span>
                      <span className="font-medium">{ev.customerName}</span>
                      <span className="text-xs text-zinc-400">
                        {ev.service}
                      </span>
                      {ev.completed && (
                        <span className="ml-auto text-xs text-emerald-300">
                          ✓ {t("completed")}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })()}

      {/* 그리드 — 가로 스크롤, 시간축+선택일 sticky */}
      <div className="mt-3 overflow-x-auto [scrollbar-width:thin]">
        <div className="flex min-w-max">
          {/* 시간축 */}
          <div
            className={`${AXIS_W} sticky left-0 z-20 flex shrink-0 flex-col bg-black`}
          >
            <div className={`${ROW_H} shrink-0 border-b border-white/25`} />
            {data.slotAxis.map((s) => (
              <div
                key={s}
                className={`${ROW_H} flex shrink-0 items-start justify-end pr-1.5 pt-1 font-mono text-[10px] tabular-nums text-zinc-500`}
              >
                {hm(s)}
              </div>
            ))}
          </div>

          {visible.map((g, vi) => {
            const isSel = vi === 0;
            const rel = relOf(g);
            const colSticky = isSel
              ? "sticky left-14 z-10 bg-black"
              : "";
            const headTone =
              g.state !== "open"
                ? "text-zinc-600"
                : rel === "today"
                  ? "text-amber-300"
                  : "text-zinc-300";
            return (
              <div
                key={`${g.year}-${g.month}-${g.day}`}
                className={`${COL_W} ${colSticky} flex shrink-0 flex-col border-l border-white/15`}
              >
                <button
                  type="button"
                  onClick={() => setSelIdx(clampSel(selIdx + vi))}
                  className={`${ROW_H} flex w-full shrink-0 flex-col items-center justify-center border-b border-white/25 text-[11px] font-bold leading-tight ${headTone} ${
                    isSel ? "bg-amber-400/10" : "hover:bg-white/5"
                  }`}
                >
                  <span>
                    {g.month}/{g.day}
                  </span>
                  <span className="text-[9px] font-medium opacity-70">
                    {WD[g.weekdayIdx]}
                  </span>
                </button>

                {g.cells.map((c, ci) => {
                  const slotMin = data.slotAxis[ci];
                  if (c.kind === "unavail") {
                    return (
                      <div
                        key={ci}
                        className={`${ROW_H} shrink-0 overflow-hidden border-b border-white/15 bg-zinc-950`}
                      />
                    );
                  }
                  if (c.kind === "free") {
                    const notPast = !slotIsPast(g, slotMin);
                    const target = moving && notPast;
                    const canAdd = !moving && notPast;
                    return (
                      <button
                        key={ci}
                        type="button"
                        disabled={pending || (!target && !canAdd)}
                        onClick={() => {
                          if (moving) onFreeTap(g, slotMin);
                          else if (canAdd) {
                            setErr(null);
                            setCq("");
                            setCresults([]);
                            setModal({ t: "addRes", g, slotMin });
                          }
                        }}
                        className={`${ROW_H} flex w-full shrink-0 items-center justify-center overflow-hidden border-b border-white/15 text-[10px] transition ${
                          target
                            ? "bg-emerald-400/20 text-emerald-200 hover:bg-emerald-400/35"
                            : canAdd
                              ? "bg-zinc-800/60 text-zinc-500 hover:bg-emerald-400/15 hover:text-emerald-300"
                              : "bg-zinc-800/60 text-zinc-700"
                        }`}
                      >
                        {target ? t("tapToMoveHere") : canAdd ? "+" : "·"}
                      </button>
                    );
                  }
                  // booked
                  const done = c.ev.completed;
                  return (
                    <button
                      key={ci}
                      type="button"
                      disabled={pending}
                      onClick={(e) =>
                        onBookedTap(g, slotMin, c.ev, e.currentTarget)
                      }
                      className={`${ROW_H} flex w-full shrink-0 flex-col justify-center overflow-hidden border-b border-white/15 px-1 text-[10px] font-medium leading-none ring-1 ring-inset transition ${
                        done
                          ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/40 hover:bg-emerald-500/25"
                          : "bg-amber-400/20 text-amber-100 ring-amber-400/40 hover:bg-amber-400/30"
                      }`}
                    >
                      <span className="block truncate">
                        {done && "✓ "}
                        {c.ev.customerName}
                      </span>
                      <span
                        className={`mt-0.5 block truncate text-[8px] ${
                          done ? "text-emerald-300/80" : "text-amber-200/70"
                        }`}
                      >
                        {c.ev.service}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* 셀 옆 팝오버 — 클릭한 예약 위치에 바로 액션 표시 */}
      {picked && !moving && (
        <>
          <div className="fixed inset-0 z-40" onClick={reset} />
          {(() => {
            const W = 340;
            const vw =
              typeof window !== "undefined" ? window.innerWidth : 1024;
            const vh =
              typeof window !== "undefined" ? window.innerHeight : 768;
            const left = Math.min(
              Math.max(8, picked.ax - W / 2),
              vw - W - 8,
            );
            const below = picked.ay + 8;
            const placeAbove = picked.ay + 160 > vh;
            const top = placeAbove
              ? Math.max(8, picked.ay - 46 - 150)
              : below;
            return (
              <div
                className="fixed z-50 rounded-xl border border-amber-400/40 bg-zinc-900 p-4 shadow-xl"
                style={{ left, top, width: W }}
              >
                <div className="text-sm">
                  <span className="font-mono tabular-nums text-amber-300">
                    {picked.whenLabel}
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-base font-semibold text-white">
                      {picked.name}
                    </span>
                    <span className="text-sm text-zinc-400">
                      {picked.service}
                    </span>
                    {picked.completed && (
                      <span className="ml-auto rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
                        ✓ {t("completed")}
                      </span>
                    )}
                  </div>
                </div>
                {!picked.completed && (
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      disabled={pending || !canComplete}
                      onClick={doComplete}
                      className="whitespace-nowrap rounded-lg border border-emerald-400/40 bg-emerald-400/15 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/25 disabled:opacity-30"
                    >
                      {t("complete")}
                    </button>
                    <button
                      type="button"
                      disabled={pending || !canMove}
                      onClick={() => setMoving(true)}
                      className="whitespace-nowrap rounded-lg border border-amber-400/40 bg-amber-400/15 py-3 text-sm font-semibold text-amber-300 transition hover:bg-amber-400/25 disabled:opacity-30"
                    >
                      {t("move")}
                    </button>
                    {picked.custId ? (
                      <Link
                        href={`/${lang}/g/${slug}/intake?customer=${picked.custId}`}
                        className="flex items-center justify-center whitespace-nowrap rounded-lg border border-sky-400/40 bg-sky-400/15 py-3 text-sm font-semibold text-sky-300 transition hover:bg-sky-400/25"
                      >
                        {t("addService")}
                      </Link>
                    ) : (
                      <span className="flex items-center justify-center whitespace-nowrap rounded-lg border border-white/10 py-3 text-sm font-semibold text-zinc-600">
                        {t("addService")}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-amber-400/30 bg-zinc-900 p-5 text-zinc-100"
            onClick={(e) => e.stopPropagation()}
          >
            {modal.t === "addRes" && (
              <>
                <h3 className="font-heading text-base text-white">
                  {t("addResTitle", {
                    when: `${modal.g.month}/${modal.g.day} ${hm(
                      modal.slotMin,
                    )}`,
                  })}
                </h3>
                <div className="mt-3 flex gap-2">
                  <input
                    value={cq}
                    onChange={(e) => setCq(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") doSearch();
                    }}
                    placeholder={t("searchPlaceholder")}
                    className="flex-1 rounded-md border border-white/15 bg-zinc-950 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={pending}
                    onClick={doSearch}
                    className="rounded-md border border-white/15 px-3 py-2 text-xs text-zinc-300 disabled:opacity-50"
                  >
                    {t("searchBtn")}
                  </button>
                </div>
                {err && (
                  <p className="mt-2 text-sm text-rose-400">{err}</p>
                )}
                <ul className="mt-3 max-h-60 space-y-1 overflow-y-auto">
                  {cresults.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => doAddRes(c.id)}
                        className="flex w-full items-center justify-between rounded-md border border-white/15 px-3 py-2 text-sm transition hover:border-amber-400/50 hover:bg-amber-400/10 disabled:opacity-50"
                      >
                        <span className="font-medium">{c.name}</span>
                        <span className="text-xs text-zinc-500">
                          {c.phone ?? ""}
                        </span>
                      </button>
                    </li>
                  ))}
                  {cresults.length === 0 && (
                    <li className="text-xs text-zinc-500">
                      {t("searchHint")}
                    </li>
                  )}
                </ul>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-zinc-400"
                  >
                    {t("close")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
