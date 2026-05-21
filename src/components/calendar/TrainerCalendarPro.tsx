"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type {
  TrainerCalendarData,
  GridDay,
  CellEvent,
  GroupOccurrence,
} from "@/lib/calendar/trainerCalendarPro";
import {
  rescheduleReservation,
  completeReservation,
  uncompleteReservation,
} from "@/app/[lang]/g/[slug]/dashboard/reservation-actions";
import Link from "next/link";
import {
  searchCustomers,
  addReservation,
  listBookableServices,
} from "@/app/[lang]/g/[slug]/dashboard/service-actions";
import { GroupClassModal } from "@/app/[lang]/g/[slug]/dashboard/GroupClassModal";
import { GroupRegisterModal } from "@/app/[lang]/g/[slug]/dashboard/GroupRegisterModal";

type Remaining = { service: string; total: number; remaining: number };

const WD_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;
const WD_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const COLS = 31; // 선택일부터 우측으로 보여줄 일수 (가로 스크롤)
// 슬롯 길이(분). 로더(trainerCalendarPro.ts)의 SLOT_MIN 과 동일 — 값 import는
// 서버 전용 모듈(Prisma)을 클라 번들로 끌어와 금지.
const SLOT_MIN = 60;

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
  // 클릭한 예약 고객의 서비스별 잔여(단체 포함). null=로딩중.
  const [rem, setRem] = useState<Remaining[] | null>(null);
  const [moving, setMoving] = useState(false);
  // 이동 확인 — native confirm(화면 하단/중앙) 대신 탭한 셀 옆 박스.
  const [moveConfirm, setMoveConfirm] = useState<{
    g: GridDay;
    slotMin: number;
    ax: number;
    ay: number;
    when: string;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [cq, setCq] = useState("");
  const [cresults, setCresults] = useState<Cust[]>([]);
  const [csearched, setCsearched] = useState(false);
  // addRes 모달 2단계 — 고객 선택 후 그 고객의 1:1 서비스 선택.
  const [addCust, setAddCust] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [addServices, setAddServices] = useState<
    { serviceId: string; name: string; remaining: number }[] | null
  >(null);
  // 본인 담당 단체수업 셀 탭 → 회차 관리 모달.
  const [groupPick, setGroupPick] = useState<GroupOccurrence | null>(null);
  // 단체수업 칩 선택 → 그 수업 회차가 격자에 표시되는 등록 모드.
  const [classMode, setClassMode] = useState<{
    serviceId: string;
    className: string;
  } | null>(null);
  // 등록 모드에서 회차 셀 탭 → 고객 등록 모달.
  const [groupReg, setGroupReg] = useState<GroupOccurrence | null>(null);
  // 수동 새로고침 전용 transition (다른 액션 pending 과 분리).
  const [refreshing, startRefresh] = useTransition();

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

  // 오늘 일정 헤더 날짜 — 숫자형(5/21)이 한눈에 보기 쉬움 + 요일·연도.
  const todayWeekday = new Intl.DateTimeFormat(
    lang === "en" ? "en-US" : "ko-KR",
    { timeZone: "UTC", weekday: "short" },
  ).format(
    new Date(
      Date.UTC(data.today.year, data.today.month - 1, data.today.day, 12),
    ),
  );
  const todayDateLabel = `${data.today.month}/${data.today.day} (${todayWeekday}) · ${data.today.year}`;

  // 본인 담당 아닌 단체수업의 distinct 목록 (칩) — serviceId 로 묶음.
  // 같은 수업의 정기+단발 스케줄이 별개 row 라도 칩은 하나(같은 수업이므로).
  const groupClassList = useMemo(() => {
    const m = new Map<
      string,
      {
        serviceId: string;
        className: string;
        instructorName: string | null;
        instructorVaries: boolean;
      }
    >();
    for (const o of data.groupClasses) {
      const e = m.get(o.serviceId);
      if (!e) {
        m.set(o.serviceId, {
          serviceId: o.serviceId,
          className: o.className,
          instructorName: o.instructorName,
          instructorVaries: false,
        });
      } else if (e.instructorName !== o.instructorName) {
        e.instructorVaries = true;
      }
    }
    return [...m.values()];
  }, [data.groupClasses]);

  // 등록 모드: 선택한 수업의 회차를 날짜키로 — 격자 셀 표시용.
  // 한 날에 정기+단발이 겹칠 수 있어 날짜당 배열.
  const classOccByDay = useMemo(() => {
    if (!classMode) return null;
    const m = new Map<string, GroupOccurrence[]>();
    for (const o of data.groupClasses) {
      if (o.serviceId !== classMode.serviceId) continue;
      const key = `${o.year}-${o.month}-${o.day}`;
      const arr = m.get(key) ?? [];
      arr.push(o);
      m.set(key, arr);
    }
    return m;
  }, [classMode, data.groupClasses]);

  function selectClass(serviceId: string, className: string) {
    if (classMode?.serviceId === serviceId) {
      setClassMode(null);
      return;
    }
    reset();
    setClassMode({ serviceId, className });
    // 첫 회차로 캘린더 점프 — 트레이너가 바로 등록 가능 날을 봄.
    const first = data.groupClasses.find((o) => o.serviceId === serviceId);
    if (first) {
      const idx = data.days.findIndex(
        (d) =>
          d.year === first.year &&
          d.month === first.month &&
          d.day === first.day,
      );
      if (idx >= 0) setSelIdx(clampSel(idx));
    }
  }

  function reset() {
    setPicked(null);
    setRem(null);
    setMoving(false);
    setMoveConfirm(null);
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
    setCsearched(false);
    setAddCust(null);
    setAddServices(null);
    setErr(null);
  }
  function doSearch() {
    startTransition(async () => {
      const r = await searchCustomers({ slug, q: cq.trim() });
      setCsearched(true);
      if (r.ok) setCresults((r.data as Cust[]) ?? []);
      else setCresults([]);
    });
  }

  // 탭·창이 다시 활성화될 때만 server data 재조회 (태블릿을 두고 갔다 옴).
  // 마운트 시 refresh 는 제거 — dashboard 는 dynamic 라우트라 네비게이션
  // 으로 돌아오면 Next 가 이미 fresh 하게 다시 렌더한다. 마운트 refresh 는
  // 그 위에 불필요한 2차 조회를 더해 "화면이 떴다가 다시 로딩"되게 만들었음.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") router.refresh();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [router]);

  // 입력 시 자동 검색(디바운스 300ms) — addRes 모달 열렸을 때만.
  useEffect(() => {
    if (modal?.t !== "addRes") return;
    const term = cq.trim();
    if (term.length === 0) {
      setCresults([]);
      setCsearched(false);
      return;
    }
    const id = setTimeout(() => {
      startTransition(async () => {
        const r = await searchCustomers({ slug, q: term });
        setCsearched(true);
        if (r.ok) setCresults((r.data as Cust[]) ?? []);
        else setCresults([]);
      });
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cq, slug, modal?.t]);
  // 고객 선택 → 그 고객의 1:1 서비스 목록 조회(다음 단계).
  function pickAddCustomer(c: Cust) {
    setErr(null);
    setAddCust({ id: c.id, name: c.name });
    setAddServices(null);
    startTransition(async () => {
      const r = await listBookableServices({ slug, customerUserId: c.id });
      setAddServices(
        r.ok
          ? ((r.data as {
              serviceId: string;
              name: string;
              remaining: number;
            }[]) ?? [])
          : [],
      );
    });
  }
  // 서비스 선택 → 그 서비스로 예약 등록.
  function confirmAddRes(serviceId: string) {
    if (modal?.t !== "addRes" || !addCust) return;
    const { g, slotMin } = modal;
    run(() =>
      addReservation({
        slug,
        customerUserId: addCust.id,
        serviceId,
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
    // 잔여 횟수는 페이지 로드 때 prefetch 됨 — 탭 즉시 동기 표시(왕복 X).
    setRem(
      ev.customerId
        ? (data.remainingByCustomer[ev.customerId] ?? [])
        : [],
    );
  }

  function onFreeTap(g: GridDay, slotMin: number, el: HTMLElement) {
    if (!moving || !picked) return;
    if (slotIsPast(g, slotMin)) {
      setErr(t("errPast"));
      return;
    }
    setErr(null);
    const r = el.getBoundingClientRect();
    setMoveConfirm({
      g,
      slotMin,
      ax: r.left + r.width / 2,
      ay: r.bottom,
      when: `${g.month}/${g.day} ${hm(slotMin)}`,
    });
  }

  function confirmMoveNow() {
    if (!moveConfirm || !picked) return;
    const { g, slotMin } = moveConfirm;
    setMoveConfirm(null);
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

  // 완료 — 확인창 없이 즉시 처리. "완료"는 자주 누르는 버튼이라 매번 컨펌하면
  // 피곤하다. 실수는 당일 완료취소(doUncompletePt)로 되돌린다 — 단체 수업과
  // 동일 모델.
  function doComplete() {
    if (!picked) return;
    run(() =>
      completeReservation({ slug, reservationId: picked.evId }),
    );
  }
  // 완료 취소(당일 한정) — 실수로 완료한 PT 예약 되돌림 + 권 환불.
  function doUncompletePt() {
    if (!picked) return;
    run(() =>
      uncompleteReservation({ slug, reservationId: picked.evId }),
    );
  }

  const canMove = picked && picked.rel !== "past" && !picked.completed;
  // 완료는 당일 수업만.
  const canComplete =
    picked && picked.rel === "today" && !picked.completed;

  const COL_W = "w-24";
  const AXIS_W = "w-14";
  const ROW_H = "h-10";

  return (
    <section className="rounded-2xl border border-orange-400/25 bg-black p-4 text-zinc-100">
      {/* 오늘 일정 — 맨 위에 (날짜 네비·그리드와 분리) */}
      {(() => {
        const td = data.days[data.todayIdx];
        if (!td) return null;
        // 오늘 일정 = 본인 1:1 예약(booked) + 본인 담당 단체수업(groupClass).
        const todays: (
          | { s: number; kind: "pt"; ev: CellEvent }
          | { s: number; kind: "group"; occ: GroupOccurrence }
        )[] = [];
        td.cells.forEach((c, i) => {
          if (c.kind === "booked") {
            todays.push({ s: data.slotAxis[i], kind: "pt", ev: c.ev });
          } else if (c.kind === "groupClass") {
            todays.push({ s: data.slotAxis[i], kind: "group", occ: c.occ });
          }
        });
        todays.sort((a, b) => a.s - b.s);
        return (
          <div className="rounded-lg bg-zinc-900/70 p-3 ring-1 ring-orange-400/30">
            <div className="flex items-center justify-between">
              <h3 className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="bg-gradient-to-r from-orange-300 via-pink-300 to-purple-300 bg-clip-text font-heading text-lg font-bold tracking-tight text-transparent">
                  {t("todayHeading")}
                </span>
                <span className="text-sm font-medium tracking-tight text-zinc-300">
                  {todayDateLabel}
                </span>
              </h3>
              <span className="text-[11px] tabular-nums text-zinc-500">
                {todays.length}
              </span>
            </div>
            {td.state !== "open" ? (
              <p className="mt-3.5 text-sm text-zinc-500">
                {td.state === "closed"
                  ? td.reason || t("closed")
                  : t("off")}
              </p>
            ) : todays.length === 0 ? (
              <p className="mt-3.5 text-sm text-zinc-500">
                {t("todayEmpty")}
              </p>
            ) : (
              <ul className="mt-3.5 space-y-1">
                {todays.map((item) =>
                  item.kind === "pt" ? (
                    <li key={item.ev.id}>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={(e) =>
                          onBookedTap(td, item.s, item.ev, e.currentTarget)
                        }
                        className={`flex w-full items-center gap-3 rounded-md px-2.5 py-1.5 text-sm transition disabled:opacity-50 ${
                          item.ev.completed
                            ? "bg-emerald-500/12 text-emerald-200 hover:bg-emerald-500/20"
                            : "bg-orange-400/15 text-orange-100 hover:bg-orange-400/25"
                        }`}
                      >
                        <span className="font-mono text-xs tabular-nums text-orange-300">
                          {hm(item.s)}
                        </span>
                        <span className="font-medium">
                          {item.ev.customerName}
                        </span>
                        <span className="text-xs text-zinc-400">
                          {item.ev.service}
                        </span>
                        {item.ev.completed && (
                          <span className="ml-auto text-xs text-emerald-300">
                            ✓ {t("completed")}
                          </span>
                        )}
                      </button>
                    </li>
                  ) : (
                    <li key={`g-${item.occ.scheduleId}`}>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setGroupPick(item.occ)}
                        className="flex w-full items-center gap-3 rounded-md bg-purple-500/15 px-2.5 py-1.5 text-sm text-purple-100 transition hover:bg-purple-500/25 disabled:opacity-50"
                      >
                        <span className="font-mono text-xs tabular-nums text-purple-300">
                          {hm(item.s)}
                        </span>
                        <span className="font-medium">
                          {item.occ.className}
                        </span>
                        <span className="ml-auto text-xs tabular-nums text-purple-200/80">
                          {item.occ.enrolled}/{item.occ.capacity}
                        </span>
                      </button>
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>
        );
      })()}

      {/* 헤더 — 선택일(좌) · 날짜 네비(중앙) · Refresh(우) */}
      <div className="mt-4 grid grid-cols-3 items-center gap-2">
        <div className="flex min-w-0 justify-start">
          <h2 className="truncate font-heading text-sm tracking-tight text-white">
            {selLabel} {t("scheduleSuffix")}
          </h2>
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setSelIdx((i) => clampSel(i - 1))}
            className="h-9 w-14 rounded-md border border-white/15 text-xl text-zinc-300 transition hover:bg-white/10"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setSelIdx(data.todayIdx)}
            className="h-9 rounded-md border border-white/15 px-3 text-sm font-medium text-zinc-300 transition hover:bg-white/10"
          >
            {t("jumpToday")}
          </button>
          <button
            type="button"
            onClick={() => setSelIdx((i) => clampSel(i + 1))}
            className="h-9 w-14 rounded-md border border-white/15 text-xl text-zinc-300 transition hover:bg-white/10"
          >
            ›
          </button>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => startRefresh(() => router.refresh())}
            disabled={refreshing}
            className="h-9 rounded-md border border-sky-400/50 px-4 text-sm font-semibold text-sky-300 transition hover:bg-sky-400/15 disabled:opacity-50"
          >
            {refreshing ? t("refreshing") : t("refresh")}
          </button>
        </div>
      </div>

      {/* 이동 모드 배너만 상단 유지(진행 안내) */}
      {moving && picked && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-orange-400/15 px-3 py-2 text-sm text-orange-200 ring-1 ring-orange-400/40">
          <span>{t("movingBanner", { name: picked.name })}</span>
          <button
            type="button"
            onClick={reset}
            className="shrink-0 rounded-md border border-orange-400/40 px-2 py-1 text-xs hover:bg-orange-400/20"
          >
            {t("movingStop")}
          </button>
        </div>
      )}
      {classMode && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-purple-500/15 px-3 py-2 text-sm text-purple-100 ring-1 ring-purple-400/40">
          <span>{t("groupRegPick", { class: classMode.className })}</span>
          <button
            type="button"
            onClick={() => setClassMode(null)}
            className="shrink-0 rounded-md border border-purple-400/40 px-2 py-1 text-xs hover:bg-purple-400/20"
          >
            {t("movingStop")}
          </button>
        </div>
      )}
      {!picked && !moving && !classMode && (
        <p className="mt-3 text-[11px] text-zinc-500">
          {t("tapBookingHint")}
        </p>
      )}
      {err && <p className="mt-2 text-sm text-rose-400">{err}</p>}

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
                  ? "text-orange-300"
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
                    isSel ? "bg-orange-400/10" : "hover:bg-white/5"
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
                  // 등록 모드 — 선택한 수업 회차 셀만 살리고 나머지는 비움.
                  if (classMode) {
                    const dayOccs = classOccByDay?.get(
                      `${g.year}-${g.month}-${g.day}`,
                    );
                    const occ = dayOccs?.find(
                      (o) =>
                        o.startMin >= slotMin &&
                        o.startMin < slotMin + SLOT_MIN,
                    );
                    if (occ) {
                      const occFull = occ.enrolled >= occ.capacity;
                      return (
                        <button
                          key={ci}
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            if (occFull) {
                              setErr(t("groupFullMsg"));
                              return;
                            }
                            setErr(null);
                            setGroupReg(occ);
                          }}
                          className={`${ROW_H} flex w-full shrink-0 flex-col items-center justify-center overflow-hidden border-b border-white/15 px-1 text-[10px] font-semibold leading-none ring-1 ring-inset transition ${
                            occFull
                              ? "bg-zinc-800 text-zinc-500 ring-white/10 hover:bg-zinc-700"
                              : "bg-purple-500/40 text-white ring-purple-300 hover:bg-purple-500/55"
                          }`}
                        >
                          <span className="tabular-nums">
                            {occ.enrolled}/{occ.capacity}
                          </span>
                          <span className="mt-0.5 text-[8px] opacity-80">
                            {occFull
                              ? t("groupClassFull")
                              : t("groupAddStudent")}
                          </span>
                        </button>
                      );
                    }
                    return (
                      <div
                        key={ci}
                        className={`${ROW_H} shrink-0 overflow-hidden border-b border-white/15 bg-zinc-950/60`}
                      />
                    );
                  }
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
                        title={target ? t("moveHereTitle") : undefined}
                        disabled={pending || (!target && !canAdd)}
                        onClick={(e) => {
                          if (moving) onFreeTap(g, slotMin, e.currentTarget);
                          else if (canAdd) {
                            setErr(null);
                            setCq("");
                            setCresults([]);
                            setCsearched(false);
                            setAddCust(null);
                            setAddServices(null);
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
                        {target ? (
                          <span className="text-base font-bold leading-none">
                            {t("tapToMoveHere")}
                          </span>
                        ) : canAdd ? (
                          "+"
                        ) : (
                          "·"
                        )}
                      </button>
                    );
                  }
                  if (c.kind === "groupClass") {
                    const o = c.occ;
                    // 한 명이라도 완료 처리됐으면 그 회차는 수업이 진행된 것 —
                    // 노쇼 한두 명이 있어도 "완료". PT 셀과 동일하게 emerald.
                    const doneCnt = o.students.filter(
                      (s) => s.completed,
                    ).length;
                    const done = doneCnt > 0;
                    const noShow = o.students.length - doneCnt;
                    return (
                      <button
                        key={ci}
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          setErr(null);
                          setGroupPick(o);
                        }}
                        className={`${ROW_H} flex w-full shrink-0 flex-col justify-center overflow-hidden border-b border-white/15 px-1 text-[10px] font-medium leading-none ring-1 ring-inset transition ${
                          done
                            ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/40 hover:bg-emerald-500/25"
                            : "bg-purple-500/25 text-purple-100 ring-purple-400/40 hover:bg-purple-500/35"
                        }`}
                      >
                        <span className="block truncate">
                          {done && "✓ "}
                          {o.className}
                        </span>
                        <span
                          className={`mt-0.5 block truncate text-[8px] tabular-nums ${
                            done ? "text-emerald-300/80" : "text-purple-200/80"
                          }`}
                        >
                          {/* 완료 후: 노쇼/완료/정원, 완료 전: 등록/정원 */}
                          {done
                            ? `${noShow}/${doneCnt}/${o.capacity}`
                            : `${o.enrolled}/${o.capacity}`}
                        </span>
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
                          : "bg-gradient-to-br from-orange-500/30 via-pink-500/15 to-purple-500/20 text-white ring-pink-400/40 hover:from-orange-500/40 hover:to-purple-500/30"
                      }`}
                    >
                      <span className="block truncate">
                        {done && "✓ "}
                        {c.ev.customerName}
                      </span>
                      <span
                        className={`mt-0.5 block truncate text-[8px] ${
                          done ? "text-emerald-300/80" : "text-white/70"
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

      {/* 단체수업 — 본인 담당 아닌 수업. 칩 선택 시 격자가 등록 모드로. */}
      <div className="mt-4 border-t border-white/10 pt-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-purple-300/90">
          {t("groupPanelTitle")}
        </div>
        {groupClassList.length === 0 ? (
          <p className="mt-2 text-xs text-zinc-500">{t("groupPanelEmpty")}</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {groupClassList.map((gc) => {
              const active = classMode?.serviceId === gc.serviceId;
              return (
                <button
                  key={gc.serviceId}
                  type="button"
                  onClick={() => selectClass(gc.serviceId, gc.className)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
                    active
                      ? "bg-purple-500/40 text-white ring-purple-300"
                      : "bg-purple-500/10 text-purple-200 ring-purple-400/30 hover:bg-purple-500/20"
                  }`}
                >
                  {gc.className}
                  {!gc.instructorVaries && (
                    <span className="ml-1.5 text-[10px] opacity-70">
                      {gc.instructorName ?? t("groupNoInstructor")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 이동 확인 — 탭한 빈 슬롯 바로 옆 (손·시선 이동 최소화) */}
      {moveConfirm && picked && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMoveConfirm(null)}
          />
          {(() => {
            const W = 248;
            const vw =
              typeof window !== "undefined" ? window.innerWidth : 1024;
            const vh =
              typeof window !== "undefined" ? window.innerHeight : 768;
            const left = Math.min(
              Math.max(8, moveConfirm.ax - W / 2),
              vw - W - 8,
            );
            const placeAbove = moveConfirm.ay + 150 > vh;
            const top = placeAbove
              ? Math.max(8, moveConfirm.ay - 40 - 138)
              : moveConfirm.ay + 8;
            return (
              <div
                className="fixed z-50 rounded-xl border border-orange-400/50 bg-zinc-900 p-4 shadow-xl"
                style={{ left, top, width: W }}
              >
                <p className="text-sm text-zinc-200">
                  {t("confirmMove", {
                    name: picked.name,
                    when: moveConfirm.when,
                  })}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMoveConfirm(null)}
                    className="rounded-lg border border-white/15 py-2.5 text-sm text-zinc-300 transition hover:bg-white/10"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={confirmMoveNow}
                    className="rounded-lg border border-orange-400/50 bg-orange-400/20 py-2.5 text-sm font-semibold text-orange-200 transition hover:bg-orange-400/30 disabled:opacity-40"
                  >
                    {t("confirmOk")}
                  </button>
                </div>
              </div>
            );
          })()}
        </>
      )}

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
                className="fixed z-50 rounded-xl border border-orange-400/40 bg-zinc-900 p-4 shadow-xl"
                style={{ left, top, width: W }}
              >
                <div className="text-sm">
                  <span className="font-mono tabular-nums text-orange-300">
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
                <div className="mt-3 rounded-lg border border-white/10 bg-zinc-950/60 p-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
                    {t("remainHeading")}
                  </div>
                  {rem === null ? (
                    <div className="mt-1 text-xs text-zinc-500">
                      {t("remainLoading")}
                    </div>
                  ) : rem.length === 0 ? (
                    <div className="mt-1 text-xs text-zinc-500">
                      {t("remainNone")}
                    </div>
                  ) : (
                    <ul className="mt-1 space-y-0.5">
                      {rem.map((x) => (
                        <li
                          key={x.service}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-zinc-300">{x.service}</span>
                          <span className="tabular-nums">
                            <span className="font-semibold text-orange-300">
                              {t("remainLeft", { n: x.remaining })}
                            </span>
                            <span className="ml-2 text-zinc-500">
                              {t("remainDone", {
                                n: x.total - x.remaining,
                              })}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
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
                      className="whitespace-nowrap rounded-lg border border-orange-400/40 bg-orange-400/15 py-3 text-sm font-semibold text-orange-300 transition hover:bg-orange-400/25 disabled:opacity-30"
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
                {picked.completed && picked.rel === "today" && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={doUncompletePt}
                    className="mt-4 w-full rounded-lg border border-white/15 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-white/5 disabled:opacity-40"
                  >
                    {t("uncomplete")}
                  </button>
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
            className="w-full max-w-sm rounded-2xl border border-orange-400/30 bg-zinc-900 p-5 text-zinc-100"
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
                {!addCust ? (
                  <>
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
                    <ul className="mt-3 max-h-60 space-y-1 overflow-y-auto">
                      {cresults.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => pickAddCustomer(c)}
                            className="flex w-full items-center justify-between rounded-md border border-white/15 px-3 py-2 text-sm transition hover:border-orange-400/50 hover:bg-orange-400/10 disabled:opacity-50"
                          >
                            <span className="font-medium">{c.name}</span>
                            <span className="text-xs text-zinc-500">
                              {c.phone ?? ""}
                            </span>
                          </button>
                        </li>
                      ))}
                      {pending && (
                        <li className="text-xs text-zinc-500">
                          {t("searchTyping")}
                        </li>
                      )}
                      {!pending &&
                        cresults.length === 0 &&
                        (csearched ? (
                          <li className="text-xs text-zinc-500">
                            {t("noResults")}
                          </li>
                        ) : (
                          <li className="text-xs text-zinc-500">
                            {t("searchHint")}
                          </li>
                        ))}
                    </ul>
                  </>
                ) : (
                  <>
                    <div className="mt-3 flex items-center justify-between gap-2 rounded-md bg-zinc-950/60 px-3 py-2">
                      <span className="text-sm font-medium text-white">
                        {addCust.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setAddCust(null);
                          setAddServices(null);
                          setErr(null);
                        }}
                        className="text-xs text-zinc-400 hover:text-zinc-100"
                      >
                        {t("addResBack")}
                      </button>
                    </div>
                    <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-orange-300/90">
                      {t("addResPickService")}
                    </div>
                    {err && (
                      <p className="mt-2 text-sm text-rose-400">{err}</p>
                    )}
                    {addServices === null ? (
                      <p className="mt-2 text-xs text-zinc-500">
                        {t("remainLoading")}
                      </p>
                    ) : addServices.length === 0 ? (
                      <p className="mt-2 text-sm text-zinc-500">
                        {t("addResNoService")}
                      </p>
                    ) : (
                      <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto">
                        {addServices.map((s) => (
                          <li key={s.serviceId}>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => confirmAddRes(s.serviceId)}
                              className="flex w-full items-center justify-between rounded-md border border-white/15 px-3 py-2 text-sm transition hover:border-orange-400/50 hover:bg-orange-400/10 disabled:opacity-50"
                            >
                              <span className="font-medium">{s.name}</span>
                              <span className="text-xs text-orange-300">
                                {t("remainLeft", { n: s.remaining })}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
                {!addCust && err && (
                  <p className="mt-2 text-sm text-rose-400">{err}</p>
                )}
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

      {groupPick && (
        <GroupClassModal
          occ={groupPick}
          moveTargets={data.days
            .flatMap((d) => d.cells)
            .flatMap((c) => (c.kind === "groupClass" ? [c.occ] : []))
            .filter(
              (o) =>
                o.scheduleId === groupPick.scheduleId &&
                keyNum(o.year, o.month, o.day) > todayKey &&
                o.enrolled < o.capacity,
            )}
          slug={slug}
          lang={lang}
          isToday={
            groupPick.year === data.today.year &&
            groupPick.month === data.today.month &&
            groupPick.day === data.today.day
          }
          onClose={() => setGroupPick(null)}
          onChanged={() => {
            setGroupPick(null);
            router.refresh();
          }}
        />
      )}

      {groupReg && (
        <GroupRegisterModal
          slug={slug}
          target={{
            scheduleId: groupReg.scheduleId,
            className: groupReg.className,
            year: groupReg.year,
            month: groupReg.month,
            day: groupReg.day,
          }}
          whenLabel={`${groupReg.month}/${groupReg.day} ${hm(
            groupReg.startMin,
          )}`}
          enrolledCustomerIds={groupReg.students.map((s) => s.customerId)}
          onClose={() => setGroupReg(null)}
          onDone={() => {
            setGroupReg(null);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}
