"use client";

import { useState, useTransition, useEffect, useMemo, useRef } from "react";
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
  cancelReservation,
} from "@/app/[lang]/g/[slug]/dashboard/reservation-actions";
import Link from "next/link";
import {
  searchCustomers,
  addReservation,
  listBookableServices,
  listMyAssignedCustomers,
} from "@/app/[lang]/g/[slug]/dashboard/service-actions";
import { updateReservationNote } from "@/app/[lang]/g/[slug]/my-clients/actions";
import { GroupClassModal } from "@/app/[lang]/g/[slug]/dashboard/GroupClassModal";
import { GroupRegisterModal } from "@/app/[lang]/g/[slug]/dashboard/GroupRegisterModal";

type Remaining = {
  service: string;
  serviceId: string;
  total: number;
  remaining: number;
  upcoming: number;
  done: number;
  remain: number;
};

const WD_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;
const WD_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const COLS = 60; // 선택일부터 우측으로 보여줄 일수 (가로 스크롤, 2개월)
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
// 요일 짧은 라벨 (Mon/Tue/...). UTC 정오 기준으로 잡아 DST·타임존 이슈 회피.
function weekdayShort(y: number, m: number, d: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

type Picked = {
  evId: string;
  custId: string | null;
  name: string;
  service: string;
  whenLabel: string;
  rel: "past" | "today" | "future";
  completed: boolean;
  // 완료된 PT 만 의미 있음 — 팝오버 메모 편집 영역에서 view/edit.
  completionNote: string | null;
  // 클릭한 셀 기준 팝오버 위치 (뷰포트 좌표)
  ax: number;
  ay: number;
};

type Cust = { id: string; name: string; phone: string | null };
// 내 담당 고객 — service 정보 포함(어떤 권 가졌는지 트레이너에게 미리 보여줌).
type MyCust = Cust & {
  services: { name: string; isGroup: boolean; remaining: number }[];
};
type Modal =
  | null
  | { t: "addRes"; g: GridDay; slotMin: number }
  | { t: "cancelRes" };

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
  // 빈 검색 시 자동 표시될 내 담당 고객(알파벳 순). 모달 진입 시 1회 fetch +
  // 액션 성공 시 null 로 invalidate → 다음 진입에 잔여 회수 fresh.
  const [myCustomers, setMyCustomers] = useState<MyCust[] | null>(null);
  // addRes 모달 2단계 — 고객 선택 후 그 고객의 1:1 서비스 선택.
  const [addCust, setAddCust] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [addServices, setAddServices] = useState<
    {
      serviceId: string;
      name: string;
      total: number;
      done: number;
      upcoming: number;
      free: number;
    }[] | null
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
  // PT 완료 운동 부위 메모(인라인 입력). null=미진입(기본 그리드 표시),
  // ""=메모 모드 진입(input 표시). 사장 결정: 끝내자마자 1줄 적어 다음 PT
  // 회고에 쓰이게 — 사후 수정은 my-clients 상세 또는 본 팝오버에서.
  const [completeNote, setCompleteNote] = useState<string | null>(null);
  // 완료된 PT 셀 팝오버에서 메모 사후 편집(놓쳤거나 수정). null=view 모드,
  // 문자열=edit 모드에서 입력 중 값. picked 가 바뀌면 자동으로 view 로 복귀.
  const [noteEdit, setNoteEdit] = useState<string | null>(null);

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

  // 점프(헤더 버튼·컬럼 헤더 클릭·classMode) 시 visible 윈도우가 selIdx로
  // 옮겨가지만, 가로 스크롤 위치(scrollLeft)는 사용자가 직전에 끌어둔 값이
  // 남아 있어 첫 컬럼이 화면 밖으로 어긋남. selIdx 변경마다 scrollLeft=0 으로
  // 되돌려 새 visible 의 첫 컬럼(= 이동 후 기준일)을 항상 화면 좌측에 맞춤.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ left: 0 });
  }, [selIdx]);

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
    setCompleteNote(null);
  }
  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setErr(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) {
        setErr(r.error || t("actionFailed"));
        return;
      }
      // 등록/취소/완료 등 액션 후 내 고객 권 잔여가 stale — 다음 모달 진입
      // 시 refetch 되도록 캐시 invalidate.
      setMyCustomers(null);
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

  // addRes 모달 진입 시 내 담당 고객 한 번 fetch (캐시 hit 면 skip).
  // 알파벳 순으로 정렬해 빈 검색 영역에 기본 노출 — 트레이너가 거의 매번
  // 자기 고객이라 타이핑 단계를 생략.
  useEffect(() => {
    if (modal?.t !== "addRes") return;
    if (myCustomers !== null) return;
    let cancelled = false;
    startTransition(async () => {
      const r = await listMyAssignedCustomers({ slug, limit: 50 });
      if (cancelled) return;
      if (r.ok) {
        // 빈 셀(1:1 슬롯)이라 단체 권만 가진 고객은 어차피 등록 못 함
        // (listBookableServices 가 capacity=1 만 반환). 노출 자체가 노이즈라
        // 1:1 권 하나라도 가진 고객만 통과.
        const rows = (r.data as { rows: MyCust[] }).rows.filter((u) =>
          u.services.some((s) => !s.isGroup),
        );
        rows.sort((a, b) => a.name.localeCompare(b.name));
        setMyCustomers(rows);
      } else {
        setMyCustomers([]);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal?.t, slug]);
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
              total: number;
              done: number;
              upcoming: number;
              free: number;
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
      whenLabel: `${hm(slotMin)} · ${g.month}/${g.day} (${weekdayShort(g.year, g.month, g.day)})`,
      rel: relOf(g),
      completed: ev.completed,
      completionNote: ev.completionNote,
      ax: r.left + r.width / 2,
      ay: r.bottom,
    });
    // 팝오버 다시 열면 메모 편집은 view 모드부터.
    setNoteEdit(null);
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

  // 완료 진입 — 인라인 메모 input 표시(autoFocus). 메모 적고 Enter 또는
  // "완료" 클릭 = doCompleteWithNote. 빈 채로도 완료 가능 — 운영 바쁠 땐 skip,
  // 사후에 my-clients 상세에서 입력 가능.
  function doComplete() {
    if (!picked || !canComplete) return;
    setCompleteNote("");
  }
  function doCompleteWithNote() {
    if (!picked || !canComplete) return;
    const note = (completeNote ?? "").trim();
    run(() =>
      completeReservation({
        slug,
        reservationId: picked.evId,
        note: note || undefined,
      }),
    );
  }
  // 완료 취소(당일 한정) — 실수로 완료한 PT 예약 되돌림 + 권 환불.
  function doUncompletePt() {
    if (!picked) return;
    run(() =>
      uncompleteReservation({ slug, reservationId: picked.evId }),
    );
  }
  // 예약 취소 — 트레이너 재량(당일 포함). 확인 모달 거쳐 실행.
  function doCancel() {
    if (!picked) return;
    run(() => cancelReservation({ slug, reservationId: picked.evId }));
  }

  const canMove = picked && picked.rel !== "past" && !picked.completed;
  // 취소 가능 = 지난 예약 아님 + 미완료 (이동과 동일 조건).
  const canCancel = picked && picked.rel !== "past" && !picked.completed;
  // 완료는 당일 수업만.
  const canComplete =
    picked && picked.rel === "today" && !picked.completed;

  // 한 화면(태블릿 ~1024px) 에 7컬럼 = 1주일 fit. (1024-56)/7 ≈ 138px → w-36.
  // 셀 행도 키워서 글자 가독성 확보.
  const COL_W = "w-36";
  const AXIS_W = "w-14";
  const ROW_H = "h-14";

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
          <div className="rounded-2xl bg-zinc-900/70 p-5 ring-1 ring-orange-400/30">
            <div className="flex items-center justify-between">
              <h3 className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="bg-gradient-to-r from-orange-300 via-pink-300 to-purple-300 bg-clip-text font-heading text-2xl font-bold tracking-tight text-transparent">
                  {t("todayHeading")}
                </span>
                <span className="text-base font-medium tracking-tight text-zinc-300">
                  {todayDateLabel}
                </span>
              </h3>
              <span className="text-base tabular-nums text-zinc-500">
                {todays.length}
              </span>
            </div>
            {td.state !== "open" ? (
              <p className="mt-4 text-base text-zinc-500">
                {td.state === "closed"
                  ? td.reason || t("closed")
                  : t("off")}
              </p>
            ) : todays.length === 0 ? (
              <p className="mt-4 text-base text-zinc-500">
                {t("todayEmpty")}
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {todays.map((item) =>
                  item.kind === "pt" ? (
                    <li key={item.ev.id}>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={(e) =>
                          onBookedTap(td, item.s, item.ev, e.currentTarget)
                        }
                        className={`flex w-full items-center gap-3 rounded-lg px-4 py-3.5 text-base transition disabled:opacity-50 ${
                          item.ev.completed
                            ? "bg-emerald-500/12 text-emerald-200 hover:bg-emerald-500/20"
                            : "bg-orange-400/15 text-orange-100 hover:bg-orange-400/25"
                        }`}
                      >
                        <span className="font-mono text-lg font-bold tabular-nums text-orange-300">
                          {hm(item.s)}
                        </span>
                        <span className="text-lg font-semibold">
                          {item.ev.customerName}
                        </span>
                        <span className="text-sm text-zinc-400">
                          {item.ev.service}
                        </span>
                        {item.ev.completed && (
                          <span className="ml-auto text-sm text-emerald-300">
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
                        className="flex w-full items-center gap-3 rounded-lg bg-purple-500/15 px-4 py-3.5 text-base text-purple-100 transition hover:bg-purple-500/25 disabled:opacity-50"
                      >
                        <span className="font-mono text-lg font-bold tabular-nums text-purple-300">
                          {hm(item.s)}
                        </span>
                        <span className="text-lg font-semibold">
                          {item.occ.className}
                        </span>
                        <span className="ml-auto text-sm tabular-nums text-purple-200/80">
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

      {/* 헤더 — 이전 한 달 / 오늘 / 새로고침. visible 윈도우(selIdx ~ +COLS)
          가 오늘부터라 좌측에 과거가 없어 가로 스크롤로 못 봄 → "이전 한 달"
          버튼이 selIdx를 30일 앞으로 당겨 가로에 과거가 보이게 함. data.days
          자체는 prev~next 3개월 연속이므로 데이터는 이미 충분. Today는 회귀점. */}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setSelIdx(clampSel(selIdx - 30))}
          className="h-9 rounded-md border border-zinc-500/50 px-4 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-500/15"
        >
          {t("backOneMonth")}
        </button>
        <button
          type="button"
          onClick={() => setSelIdx(clampSel(selIdx - 7))}
          className="h-9 rounded-md border border-zinc-500/50 px-4 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-500/15"
        >
          {t("backOneWeek")}
        </button>
        <button
          type="button"
          onClick={() => setSelIdx(clampSel(data.todayIdx))}
          className="h-9 rounded-md border border-orange-400/50 px-4 text-sm font-semibold text-orange-300 transition hover:bg-orange-400/15"
        >
          {t("today")}
        </button>
        <button
          type="button"
          onClick={() => startRefresh(() => router.refresh())}
          disabled={refreshing}
          className="h-9 rounded-md border border-sky-400/50 px-4 text-sm font-semibold text-sky-300 transition hover:bg-sky-400/15 disabled:opacity-50"
        >
          {refreshing ? t("refreshing") : t("refresh")}
        </button>
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
      {/* 안내 문구 — picked/moving/classMode 일 땐 시각만 hidden, 자리는 유지.
          조건부 제거 시 28px 줄이 사라져 그리드가 위로 튀던 layout shift 차단. */}
      <p
        className={`mt-3 text-sm text-zinc-500 ${
          picked || moving || classMode ? "invisible" : ""
        }`}
      >
        {t("tapBookingHint")}
      </p>
      {err && <p className="mt-2 text-sm text-rose-400">{err}</p>}

      {/* 그리드 — 가로 스크롤, 시간축+선택일 sticky.
          셀 button onMouseDown 의 default focus 동작이 브라우저 scrollIntoView
          를 유발해 그리드가 위·아래로 살짝 튀던 문제 → mousedown 시 focus 만
          막아서 그리드 위치를 고정. onClick 은 정상 동작. */}
      <div
        ref={scrollRef}
        className="mt-3 overflow-x-auto [scrollbar-width:thin]"
        onMouseDown={(e) => {
          if (
            e.target instanceof HTMLElement &&
            e.target.closest("button")
          ) {
            e.preventDefault();
          }
        }}
      >
        <div className="flex min-w-max">
          {/* 시간축 */}
          <div
            className={`${AXIS_W} sticky left-0 z-20 flex shrink-0 flex-col bg-black`}
          >
            <div className={`${ROW_H} shrink-0 border-b border-white/25`} />
            {data.slotAxis.map((s) => (
              <div
                key={s}
                className={`${ROW_H} flex shrink-0 items-start justify-end pr-1.5 pt-1 font-mono text-sm tabular-nums text-zinc-500`}
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
                  className={`${ROW_H} flex w-full shrink-0 flex-col items-center justify-center border-b border-white/25 text-sm font-bold leading-tight ${headTone} ${
                    isSel ? "bg-orange-400/10" : "hover:bg-white/5"
                  }`}
                >
                  <span>
                    {g.month}/{g.day}
                  </span>
                  <span className="text-xs font-medium opacity-70">
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
                          className={`${ROW_H} flex w-full shrink-0 flex-col items-center justify-center overflow-hidden border-b border-white/15 px-1 text-sm font-semibold leading-none ring-1 ring-inset transition ${
                            occFull
                              ? "bg-zinc-800 text-zinc-500 ring-white/10 hover:bg-zinc-700"
                              : "bg-purple-500/40 text-white ring-purple-300 hover:bg-purple-500/55"
                          }`}
                        >
                          <span className="tabular-nums">
                            {occ.enrolled}/{occ.capacity}
                          </span>
                          <span className="mt-0.5 text-xs opacity-80">
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
                        className={`${ROW_H} flex w-full shrink-0 items-center justify-center overflow-hidden border-b border-white/15 text-sm transition ${
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
                        className={`${ROW_H} flex w-full shrink-0 flex-col justify-center overflow-hidden border-b border-white/15 px-1 text-sm font-medium leading-none ring-1 ring-inset transition ${
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
                          className={`mt-0.5 block truncate text-xs tabular-nums ${
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
                      className={`${ROW_H} flex w-full shrink-0 flex-col justify-center overflow-hidden border-b border-white/15 px-1 text-sm font-medium leading-none ring-1 ring-inset transition ${
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
                        className={`mt-0.5 block truncate text-xs ${
                          done ? "text-emerald-300/80" : "text-white/70"
                        }`}
                      >
                        {c.ev.service}
                        {done && c.ev.completionNote && (
                          <span className="ml-1 text-emerald-300">
                            {" · "}
                            {c.ev.completionNote.length > 8
                              ? c.ev.completionNote.slice(0, 6) + ".."
                              : c.ev.completionNote}
                          </span>
                        )}
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
        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-purple-300/90">
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
                    <span className="ml-1.5 text-sm opacity-70">
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
                <div className="text-base">
                  <span className="font-mono tabular-nums text-orange-300">
                    {picked.whenLabel}
                  </span>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-lg font-bold text-white">
                      {picked.name}
                    </span>
                    <span className="text-base text-zinc-400">
                      {picked.service}
                    </span>
                    {picked.completed && (
                      <span className="ml-auto rounded bg-emerald-500/15 px-2 py-0.5 text-sm text-emerald-300">
                        ✓ {t("completed")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-3 rounded-lg border border-white/10 bg-zinc-950/60 p-3">
                  {rem === null ? (
                    <div className="text-sm text-zinc-500">
                      {t("remainLoading")}
                    </div>
                  ) : rem.length === 0 ? (
                    <div className="text-sm text-zinc-500">
                      {t("remainNone")}
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {rem.map((x) => (
                        <li key={x.serviceId} className="text-sm">
                          <div className="font-semibold text-zinc-200">
                            {x.service}
                          </div>
                          <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 tabular-nums">
                            <span>
                              <span className="font-semibold text-white">
                                {x.remaining}
                              </span>
                              <span className="text-zinc-500"> left</span>
                            </span>
                            <span className="text-zinc-600">·</span>
                            <span>
                              <span className="font-semibold text-orange-300">
                                {x.upcoming}
                              </span>
                              <span className="text-zinc-500"> 예약중</span>
                            </span>
                            <span className="text-zinc-600">·</span>
                            <span>
                              <span className="font-semibold text-emerald-300">
                                {x.done}
                              </span>
                              <span className="text-zinc-500"> 완료</span>
                            </span>
                            <span className="text-zinc-600">·</span>
                            <span>
                              <span className="font-semibold text-amber-300">
                                {x.remain}
                              </span>
                              <span className="text-zinc-500"> 잔여</span>
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {/* 완료된 PT 셀에서만 메모 사후 편집 — 놓쳤거나 수정. */}
                {picked.completed && (
                  <div className="mt-2 rounded-lg border border-white/10 bg-zinc-950/60 p-2.5">
                    {noteEdit === null ? (
                      <button
                        type="button"
                        onClick={() =>
                          setNoteEdit(picked.completionNote ?? "")
                        }
                        className="block w-full text-left text-sm text-zinc-300 transition hover:text-emerald-300"
                      >
                        {picked.completionNote ? (
                          <span>📝 {picked.completionNote}</span>
                        ) : (
                          <span className="text-zinc-500">
                            + {t("noteAddPrompt")}
                          </span>
                        )}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={noteEdit}
                          onChange={(e) => setNoteEdit(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const val = noteEdit;
                              const pickedSnap = picked;
                              startTransition(async () => {
                                const r = await updateReservationNote({
                                  slug,
                                  reservationId: pickedSnap.evId,
                                  note: val,
                                });
                                if (r.ok) {
                                  const trimmed =
                                    val.trim().slice(0, 80) || null;
                                  setPicked({
                                    ...pickedSnap,
                                    completionNote: trimmed,
                                  });
                                  setNoteEdit(null);
                                  router.refresh();
                                } else {
                                  setErr(r.error);
                                }
                              });
                            } else if (e.key === "Escape") {
                              setNoteEdit(null);
                            }
                          }}
                          autoFocus
                          maxLength={80}
                          placeholder={t("notePlaceholder")}
                          className="flex-1 rounded bg-zinc-900 px-2 py-1.5 text-sm text-white ring-1 ring-white/15 placeholder:text-zinc-600 focus:outline-none focus:ring-emerald-400/50"
                        />
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            const val = noteEdit;
                            const pickedSnap = picked;
                            startTransition(async () => {
                              const r = await updateReservationNote({
                                slug,
                                reservationId: pickedSnap.evId,
                                note: val,
                              });
                              if (r.ok) {
                                const trimmed =
                                  val.trim().slice(0, 80) || null;
                                setPicked({
                                  ...pickedSnap,
                                  completionNote: trimmed,
                                });
                                setNoteEdit(null);
                                router.refresh();
                              } else {
                                setErr(r.error);
                              }
                            });
                          }}
                          className="rounded bg-emerald-500 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          onClick={() => setNoteEdit(null)}
                          className="rounded border border-white/15 px-2.5 py-1.5 text-xs text-zinc-400 transition hover:text-white"
                        >
                          ✗
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {!picked.completed && completeNote === null && (
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
                {!picked.completed && completeNote === null && (
                  <button
                    type="button"
                    disabled={pending || !canCancel}
                    onClick={() => setModal({ t: "cancelRes" })}
                    className="mt-2 w-full rounded-lg border border-rose-400/40 bg-rose-400/10 py-3 text-sm font-semibold text-rose-300 transition hover:bg-rose-400/20 disabled:opacity-30"
                  >
                    {t("cancelBooking")}
                  </button>
                )}
                {!picked.completed && completeNote !== null && (
                  <div className="mt-4 space-y-2">
                    <input
                      autoFocus
                      value={completeNote}
                      onChange={(e) => setCompleteNote(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") doCompleteWithNote();
                        else if (e.key === "Escape") setCompleteNote(null);
                      }}
                      placeholder={t("notePlaceholder")}
                      maxLength={80}
                      className="w-full rounded-lg border border-emerald-400/40 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-400/60"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCompleteNote(null)}
                        className="rounded-lg border border-white/15 py-2.5 text-sm text-zinc-300 transition hover:bg-white/5"
                      >
                        {t("cancel")}
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={doCompleteWithNote}
                        className="rounded-lg border border-emerald-400/50 bg-emerald-400/20 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/30 disabled:opacity-40"
                      >
                        {t("complete")}
                      </button>
                    </div>
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
                    {!cq.trim() ? (
                      // 빈 검색 — 내 담당 고객 알파벳 순 자동 표시 (트레이너가
                      // 매번 자기 고객이라 타이핑 단계 생략).
                      <ul className="mt-3 max-h-60 space-y-1 overflow-y-auto">
                        {myCustomers === null ? (
                          <li className="text-xs text-zinc-500">
                            {t("myCustomersLoading")}
                          </li>
                        ) : myCustomers.length === 0 ? (
                          <li className="text-xs text-zinc-500">
                            {t("noMyCustomers")}
                          </li>
                        ) : (
                          <>
                            <li className="px-1 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-orange-300/70">
                              {t("myCustomersHeading")} · {myCustomers.length}
                            </li>
                            {myCustomers.map((c) => {
                              const oneToOne = c.services.filter(
                                (s) => !s.isGroup,
                              );
                              return (
                                <li key={c.id}>
                                  <button
                                    type="button"
                                    disabled={pending}
                                    onClick={() => pickAddCustomer(c)}
                                    className="flex w-full items-center justify-between gap-2 rounded-md border border-white/15 px-3 py-2 text-sm transition hover:border-orange-400/50 hover:bg-orange-400/10 disabled:opacity-50"
                                  >
                                    <span className="min-w-0 flex-1 truncate font-medium">
                                      {c.name}
                                    </span>
                                    {oneToOne.length > 0 && (
                                      <span className="shrink-0 text-xs text-orange-300/80">
                                        {oneToOne
                                          .map((s) => s.name)
                                          .join(" · ")}
                                      </span>
                                    )}
                                  </button>
                                </li>
                              );
                            })}
                          </>
                        )}
                      </ul>
                    ) : (
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
                    )}
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
                    <div className="mt-3 text-sm font-semibold uppercase tracking-[0.15em] text-orange-300/90">
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
                                {t("bookableBreakdown", {
                                  done: s.done,
                                  upcoming: s.upcoming,
                                  free: s.free,
                                })}
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
            {modal.t === "cancelRes" && picked && (
              <>
                <h3 className="font-heading text-base text-white">
                  {t("cancelBooking")}
                </h3>
                <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <div className="text-sm font-medium text-white">
                    {picked.name}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-400">
                    {picked.service} · {picked.whenLabel}
                  </div>
                </div>
                <p className="mt-3 text-sm text-zinc-300">
                  {t("cancelConfirm")}
                </p>
                {err && (
                  <p className="mt-2 text-sm text-rose-400">{err}</p>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-zinc-400"
                  >
                    {t("close")}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={doCancel}
                    className="rounded-md border border-rose-400/40 bg-rose-400/15 px-3 py-1.5 text-xs font-semibold text-rose-300 disabled:opacity-50"
                  >
                    {t("cancelYes")}
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
