import { prisma } from "@/lib/db/client";
import { computeStatus, ymd } from "@/lib/hours/status";
import type { Weekday } from "@/generated/prisma/enums";

// 트레이너 슬롯 그리드 데이터 로더.
// 슬롯 = 60분(수업 50분 + 버퍼 10분), 정시 시작. 연속 예약 사이 10분 자동 확보.
// 가용창 = 매장 영업시간 ∩ 트레이너 출근시간 − 휴게 − 휴무/휴가.
// 기존 hours 시스템과 동일 UTC-naive 기준(저장 Date의 UTC 파츠 = 달력일/시각).

export const CLASS_MIN = 50;
export const BUFFER_MIN = 10;
export const SLOT_MIN = CLASS_MIN + BUFFER_MIN; // 60

const WD: Weekday[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export type CellEvent = {
  id: string;
  startMin: number;
  endMin: number;
  customerId: string | null;
  customerName: string;
  service: string;
  status: string;
  completed: boolean;
};

export type GridCell =
  | { kind: "unavail" }
  | { kind: "free" }
  | { kind: "booked"; ev: CellEvent };

export type GridDay = {
  year: number;
  month: number; // 1-12
  day: number;
  weekdayIdx: number; // 0=Sun
  state: "open" | "off" | "closed";
  reason: string | null;
  cells: GridCell[]; // slotAxis 와 1:1 정렬
};

export type IssuablePlan = {
  id: string;
  kind: "PACKAGE" | "MEMBERSHIP";
  name: string;
  pricePhp: number;
  serviceId: string | null; // PACKAGE 만
  sessionCount: number | null; // PACKAGE 만
};

export type TrainerCalendarData = {
  trainerName: string;
  today: { year: number; month: number; day: number };
  slotAxis: number[]; // 자정 기준 분, 60분 간격 (행 축)
  days: GridDay[]; // prev~next 3개월 연속
  todayIdx: number; // days 내 오늘 인덱스
  plans: IssuablePlan[]; // 발급 가능한 횟수권/회원권 (active)
};

function shiftMonth(y: number, m: number, delta: number) {
  const idx = y * 12 + (m - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

export async function loadTrainerCalendar(
  gymId: string,
  staffId: string | null,
  trainerName: string,
): Promise<TrainerCalendarData> {
  const now = new Date();
  const cy = now.getUTCFullYear();
  const cm = now.getUTCMonth() + 1;
  const cd = now.getUTCDate();

  const prev = shiftMonth(cy, cm, -1);
  const afterNext = shiftMonth(cy, cm, 2);
  const windowStart = new Date(Date.UTC(prev.year, prev.month - 1, 1));
  const windowEnd = new Date(
    Date.UTC(afterNext.year, afterNext.month - 1, 1),
  );

  const [
    hours,
    closures,
    staff,
    leaves,
    reservations,
    packagePlans,
    membershipPlans,
  ] = await Promise.all([
    prisma.businessHours.findMany({ where: { gymId } }),
    prisma.businessClosure.findMany({
      where: { gymId, date: { gte: windowStart, lt: windowEnd } },
    }),
    staffId
      ? prisma.staff.findUnique({
          where: { id: staffId },
          select: {
            weeklyOffDays: true,
            workStartMin: true,
            workEndMin: true,
            breakStartMin: true,
            breakEndMin: true,
          },
        })
      : Promise.resolve(null),
    staffId
      ? prisma.staffLeave.findMany({
          where: {
            staffId,
            startDate: { lt: windowEnd },
            endDate: { gte: windowStart },
          },
          select: { startDate: true, endDate: true, reason: true },
        })
      : Promise.resolve([]),
    staffId
      ? prisma.reservation.findMany({
          where: {
            gymId,
            staffId,
            startAt: { gte: windowStart, lt: windowEnd },
          },
          select: {
            id: true,
            startAt: true,
            endAt: true,
            status: true,
            customerUserId: true,
            customer: { select: { id: true, name: true } },
            service: { select: { name: true } },
          },
          orderBy: { startAt: "asc" },
        })
      : Promise.resolve([]),
    prisma.packagePlan.findMany({
      where: { gymId, active: true },
      select: { id: true, name: true, pricePhp: true, serviceId: true, sessionCount: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.membershipPlan.findMany({
      where: { gymId, active: true },
      select: { id: true, name: true, pricePhp: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const closureByYmd = new Map(closures.map((c) => [ymd(c.date), c]));
  const wStart = staff?.workStartMin ?? null;
  const wEnd = staff?.workEndMin ?? null;
  const brkS = staff?.breakStartMin ?? null;
  const brkE = staff?.breakEndMin ?? null;
  const hasBrk = brkS != null && brkE != null && brkE > brkS;
  const offDays = new Set(staff?.weeklyOffDays ?? []);
  const DEAD = new Set(["CANCELLED", "REJECTED"]);

  function onLeave(d: Date): string | null {
    for (const lv of leaves) {
      if (d >= lv.startDate && d <= lv.endDate) return lv.reason ?? "";
    }
    return null;
  }

  // 예약 → ymd 버킷 (취소/거절 제외 → 그 자리는 free 로 보임)
  const evByYmd = new Map<string, CellEvent[]>();
  for (const r of reservations) {
    if (DEAD.has(r.status)) continue;
    const key = ymd(r.startAt);
    const e: CellEvent = {
      id: r.id,
      startMin: r.startAt.getUTCHours() * 60 + r.startAt.getUTCMinutes(),
      endMin: r.endAt.getUTCHours() * 60 + r.endAt.getUTCMinutes(),
      customerId: r.customer?.id ?? r.customerUserId ?? null,
      customerName: r.customer?.name ?? "",
      service: r.service?.name ?? "",
      status: r.status,
      completed: r.status === "COMPLETED",
    };
    const arr = evByYmd.get(key);
    if (arr) arr.push(e);
    else evByYmd.set(key, [e]);
  }

  // 1차 패스: open 일들의 가용창으로 글로벌 슬롯 축 산정
  type Pre = {
    y: number;
    m: number;
    d: number;
    wd: number;
    state: "open" | "off" | "closed";
    reason: string | null;
    openMin: number | null;
    closeMin: number | null;
    key: string;
  };
  const pre: Pre[] = [];
  let minOpen = Infinity;
  let maxClose = -Infinity;

  let cur = new Date(windowStart);
  while (cur < windowEnd) {
    const y = cur.getUTCFullYear();
    const m = cur.getUTCMonth() + 1;
    const d = cur.getUTCDate();
    const wd = cur.getUTCDay();
    const key = ymd(cur);
    const gym = computeStatus(cur, hours, closureByYmd.get(key) ?? null);
    if (gym.state === "CLOSED_DAY" || gym.state === "NO_HOURS_SET") {
      pre.push({
        y,
        m,
        d,
        wd,
        state: "closed",
        reason: gym.state === "CLOSED_DAY" ? gym.reason : null,
        openMin: null,
        closeMin: null,
        key,
      });
    } else {
      const lv = onLeave(cur);
      const isOff = offDays.has(WD[wd]) || lv !== null;
      const oMin = Math.max(gym.openMin, wStart ?? gym.openMin);
      const cMin = Math.min(gym.closeMin, wEnd ?? gym.closeMin);
      const empty = oMin + CLASS_MIN > cMin;
      if (isOff || empty) {
        pre.push({
          y,
          m,
          d,
          wd,
          state: "off",
          reason: lv ?? null,
          openMin: null,
          closeMin: null,
          key,
        });
      } else {
        pre.push({
          y,
          m,
          d,
          wd,
          state: "open",
          reason: null,
          openMin: oMin,
          closeMin: cMin,
          key,
        });
        if (oMin < minOpen) minOpen = oMin;
        if (cMin > maxClose) maxClose = cMin;
      }
    }
    cur = new Date(cur.getTime() + 86400000);
  }

  // 슬롯 축: 정시 기준, start+CLASS_MIN <= maxClose 까지
  if (!Number.isFinite(minOpen)) {
    minOpen = 600;
    maxClose = 1320;
  }
  const axisStart = Math.floor(minOpen / 60) * 60;
  const slotAxis: number[] = [];
  for (let s = axisStart; s + CLASS_MIN <= maxClose; s += SLOT_MIN) {
    slotAxis.push(s);
  }

  const days: GridDay[] = pre.map((p) => {
    if (p.state !== "open") {
      return {
        year: p.y,
        month: p.m,
        day: p.d,
        weekdayIdx: p.wd,
        state: p.state,
        reason: p.reason,
        cells: slotAxis.map(() => ({ kind: "unavail" as const })),
      };
    }
    const evs = evByYmd.get(p.key) ?? [];
    const cells: GridCell[] = slotAxis.map((s) => {
      if (s < p.openMin! || s + CLASS_MIN > p.closeMin!) {
        return { kind: "unavail" };
      }
      // 트레이너 휴게 구간과 겹치면 예약 불가
      if (hasBrk && s < brkE! && s + CLASS_MIN > brkS!) {
        return { kind: "unavail" };
      }
      const ev = evs.find(
        (e) => e.startMin >= s && e.startMin < s + SLOT_MIN,
      );
      return ev ? { kind: "booked", ev } : { kind: "free" };
    });
    return {
      year: p.y,
      month: p.m,
      day: p.d,
      weekdayIdx: p.wd,
      state: "open",
      reason: null,
      cells,
    };
  });

  const todayIdx = days.findIndex(
    (x) => x.year === cy && x.month === cm && x.day === cd,
  );

  const plans: IssuablePlan[] = [
    ...packagePlans.map((p) => ({
      id: p.id,
      kind: "PACKAGE" as const,
      name: p.name,
      pricePhp: p.pricePhp,
      serviceId: p.serviceId,
      sessionCount: p.sessionCount,
    })),
    ...membershipPlans.map((m) => ({
      id: m.id,
      kind: "MEMBERSHIP" as const,
      name: m.name,
      pricePhp: m.pricePhp,
      serviceId: null,
      sessionCount: null,
    })),
  ];

  return {
    trainerName,
    today: { year: cy, month: cm, day: cd },
    slotAxis,
    days,
    todayIdx: todayIdx < 0 ? 0 : todayIdx,
    plans,
  };
}
