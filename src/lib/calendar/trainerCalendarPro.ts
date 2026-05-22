import { prisma } from "@/lib/db/client";
import { computeStatus, ymd } from "@/lib/hours/status";
import { gymTodayUtcMidnight } from "./gymTime";
import type { Weekday } from "@/generated/prisma/enums";

// 트레이너 슬롯 그리드 데이터 로더.
// 슬롯 = 60분(수업 50분 + 버퍼 10분), 정시 시작. 연속 예약 사이 10분 자동 확보.
// 가용창 = 매장 영업시간 ∩ 트레이너 출근시간 − 휴게 − 휴무/휴가.
// 기존 hours 시스템과 동일 UTC-naive 기준(저장 Date의 UTC 파츠 = 달력일/시각).
//
// 단체수업(ScheduledClass, service.capacity>1)도 함께 로드한다:
//  - 본인 담당 단체수업 → 격자 셀(kind:"groupClass")로 그 슬롯을 막음.
//  - 타 트레이너 담당 → groupClasses 목록(캘린더 아래 패널에서 등록 처리).

export const CLASS_MIN = 50;
export const BUFFER_MIN = 10;
export const SLOT_MIN = CLASS_MIN + BUFFER_MIN; // 60

const WD: Weekday[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const DEAD = new Set(["CANCELLED", "REJECTED"]);
const MS_PER_DAY = 24 * 60 * 60 * 1000; // 하루(UTC·Manila 모두 DST 없음 → 고정)

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

// 단체수업 회차 1건에 등록된 수강생.
export type GroupStudent = {
  reservationId: string;
  customerId: string;
  name: string;
  completed: boolean; // 수업 완료 처리됨
};

// 단체수업 1회차(특정 날짜). 격자 셀(본인 담당)·패널(타 담당) 양쪽이 공유.
export type GroupOccurrence = {
  scheduleId: string;
  serviceId: string;
  className: string; // 단체수업은 Service 자체가 수업 = service.name
  instructorName: string | null;
  year: number;
  month: number;
  day: number;
  weekdayIdx: number; // 0=Sun
  startMin: number;
  durationMin: number;
  capacity: number;
  enrolled: number;
  isMine: boolean; // 로그인 트레이너가 이 수업 담당인가
  students: GroupStudent[]; // 비취소 등록자 (본인 담당 셀 관리용)
};

export type GridCell =
  | { kind: "unavail" }
  | { kind: "free" }
  | { kind: "booked"; ev: CellEvent }
  | { kind: "groupClass"; occ: GroupOccurrence };

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

// 고객의 서비스별 잔여 횟수 — booked 셀 팝오버에 즉시 표시.
export type CustomerRemaining = {
  service: string;
  total: number;
  remaining: number;
};

export type TrainerCalendarData = {
  trainerName: string;
  today: { year: number; month: number; day: number };
  slotAxis: number[]; // 자정 기준 분, 60분 간격 (행 축)
  days: GridDay[]; // prev~next 3개월 연속
  todayIdx: number; // days 내 오늘 인덱스
  // 캘린더 아래 패널용 — 본인 담당이 아닌 단체수업 회차(오늘 이후), 날짜·시각순.
  groupClasses: GroupOccurrence[];
  // 예약 고객 id → 서비스별 잔여 — 셀 탭 시 서버 왕복 없이 즉시 표시.
  remainingByCustomer: Record<string, CustomerRemaining[]>;
};

function shiftMonth(y: number, m: number, delta: number) {
  const idx = y * 12 + (m - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

export async function loadTrainerCalendar(
  gymId: string,
  staffId: string | null,
  trainerName: string,
  timeZone: string,
): Promise<TrainerCalendarData> {
  // "오늘" = 매장 타임존 기준 달력일. new Date() 의 UTC 파츠를 그대로 쓰면
  // UTC 와 매장 현지 날짜가 갈리는 시간대(예: UTC 16~24시)에 하루가 밀려,
  // 그 날 예약이 "미래"로 잘못 분류된다(완료 버튼 비활성 등).
  const todayMid = gymTodayUtcMidnight(timeZone);
  const cy = todayMid.getUTCFullYear();
  const cm = todayMid.getUTCMonth() + 1;
  const cd = todayMid.getUTCDate();

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
    scheduledClasses,
    groupEnrollments,
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
            scheduledClassId: true,
            customer: { select: { id: true, name: true } },
            service: { select: { name: true } },
          },
          orderBy: { startAt: "asc" },
        })
      : Promise.resolve([]),
    // 매장 전체 단체수업(capacity>1) — 담당 무관. 윈도우와 유효기간이 겹치는 것만.
    prisma.scheduledClass.findMany({
      where: {
        gymId,
        active: true,
        service: { capacity: { gt: 1 } },
        validFrom: { lt: windowEnd },
        OR: [{ validUntil: null }, { validUntil: { gte: windowStart } }],
      },
      select: {
        id: true,
        serviceId: true,
        staffId: true,
        kind: true,
        weekdays: true,
        specificDate: true,
        startMinute: true,
        validFrom: true,
        validUntil: true,
        service: {
          select: { name: true, capacity: true, durationMin: true },
        },
        staff: { select: { user: { select: { name: true } } } },
      },
    }),
    // 단체수업 등록 예약(전 클래스) — 회차별 등록 인원·수강생 명단 산출용.
    prisma.reservation.findMany({
      where: {
        gymId,
        scheduledClassId: { not: null },
        startAt: { gte: windowStart, lt: windowEnd },
        status: { notIn: ["CANCELLED", "REJECTED"] },
      },
      select: {
        id: true,
        scheduledClassId: true,
        startAt: true,
        status: true,
        customerUserId: true,
        customer: { select: { name: true } },
      },
    }),
  ]);

  const closureByYmd = new Map(closures.map((c) => [ymd(c.date), c]));
  const wStart = staff?.workStartMin ?? null;
  const wEnd = staff?.workEndMin ?? null;
  const brkS = staff?.breakStartMin ?? null;
  const brkE = staff?.breakEndMin ?? null;
  const hasBrk = brkS != null && brkE != null && brkE > brkS;
  const offDays = new Set(staff?.weeklyOffDays ?? []);

  function onLeave(d: Date): string | null {
    for (const lv of leaves) {
      if (d >= lv.startDate && d <= lv.endDate) return lv.reason ?? "";
    }
    return null;
  }

  // 1:1 예약 → ymd 버킷. 단체수업 등록(scheduledClassId 있음)은 제외 —
  // 그건 groupClass 셀로 따로 그린다(수강생별 개별 셀 방지).
  const evByYmd = new Map<string, CellEvent[]>();
  for (const r of reservations) {
    if (DEAD.has(r.status)) continue;
    if (r.scheduledClassId) continue;
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

  // 단체수업 등록 버킷: `scheduleId|ymd` → 수강생들.
  const enrollByKey = new Map<string, GroupStudent[]>();
  for (const r of groupEnrollments) {
    if (!r.scheduledClassId) continue;
    const key = `${r.scheduledClassId}|${ymd(r.startAt)}`;
    const arr = enrollByKey.get(key) ?? [];
    arr.push({
      reservationId: r.id,
      customerId: r.customerUserId,
      name: r.customer?.name ?? "",
      completed: r.status === "COMPLETED",
    });
    enrollByKey.set(key, arr);
  }

  // occurrence 전개: 윈도우 안의 모든 단체수업 회차를 ymd 키로.
  const occByYmd = new Map<string, GroupOccurrence[]>();
  {
    let c = new Date(windowStart);
    while (c < windowEnd) {
      const y = c.getUTCFullYear();
      const m = c.getUTCMonth() + 1;
      const d = c.getUTCDate();
      const wd = c.getUTCDay();
      const key = ymd(c);
      for (const sc of scheduledClasses) {
        if (c < sc.validFrom) continue;
        if (sc.validUntil && c > sc.validUntil) continue;
        if (sc.kind === "ONE_OFF") {
          if (!sc.specificDate || ymd(sc.specificDate) !== key) continue;
        } else if (!sc.weekdays.includes(WD[wd])) {
          continue;
        }
        const students = enrollByKey.get(`${sc.id}|${key}`) ?? [];
        const occ: GroupOccurrence = {
          scheduleId: sc.id,
          serviceId: sc.serviceId,
          className: sc.service.name,
          instructorName: sc.staff?.user.name ?? null,
          year: y,
          month: m,
          day: d,
          weekdayIdx: wd,
          startMin: sc.startMinute,
          durationMin: sc.service.durationMin,
          capacity: sc.service.capacity,
          enrolled: students.length,
          isMine: staffId != null && sc.staffId === staffId,
          students,
        };
        const arr = occByYmd.get(key) ?? [];
        arr.push(occ);
        occByYmd.set(key, arr);
      }
      c = new Date(c.getTime() + MS_PER_DAY);
    }
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
    cur = new Date(cur.getTime() + MS_PER_DAY);
  }

  // 모든 단체수업 시각을 슬롯 축에 포함 — 트레이너 근무시간 밖 수업이라도
  // 격자에 그 슬롯 행이 존재해야 등록 모드에서 셀로 표시할 수 있음.
  for (const occs of occByYmd.values()) {
    for (const o of occs) {
      if (o.startMin < minOpen) minOpen = o.startMin;
      const e = o.startMin + o.durationMin;
      if (e > maxClose) maxClose = e;
    }
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

  // 본인 담당 단체수업을 셀에 덮어쓰기 — 시작 슬롯=groupClass, 겹치는
  // 이후 슬롯=unavail(PT 중복 예약 방지). 예약(booked)과 겹치면 그건 유지.
  function overlayGroup(cells: GridCell[], occs: GroupOccurrence[]): GridCell[] {
    const mine = occs.filter((o) => o.isMine);
    if (mine.length === 0) return cells;
    const out = cells.slice();
    for (const occ of mine) {
      const endMin = occ.startMin + occ.durationMin;
      for (let i = 0; i < slotAxis.length; i++) {
        const s = slotAxis[i];
        const slotEnd = s + SLOT_MIN;
        if (occ.startMin >= slotEnd || endMin <= s) continue; // 안 겹침
        if (s <= occ.startMin && occ.startMin < slotEnd) {
          out[i] = { kind: "groupClass", occ };
        } else if (out[i].kind === "free" || out[i].kind === "unavail") {
          out[i] = { kind: "unavail" };
        }
      }
    }
    return out;
  }

  const days: GridDay[] = pre.map((p) => {
    const occs = occByYmd.get(p.key) ?? [];
    if (p.state !== "open") {
      return {
        year: p.y,
        month: p.m,
        day: p.d,
        weekdayIdx: p.wd,
        state: p.state,
        reason: p.reason,
        cells: overlayGroup(
          slotAxis.map(() => ({ kind: "unavail" as const })),
          occs,
        ),
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
      cells: overlayGroup(cells, occs),
    };
  });

  const todayIdx = days.findIndex(
    (x) => x.year === cy && x.month === cm && x.day === cd,
  );

  // 패널용 — 본인 담당 아닌 단체수업 중 오늘 이후, 날짜·시각순.
  const todayNum = cy * 10000 + cm * 100 + cd;
  const groupClasses: GroupOccurrence[] = [];
  for (const occs of occByYmd.values()) {
    for (const o of occs) {
      if (o.isMine) continue;
      if (o.year * 10000 + o.month * 100 + o.day < todayNum) continue;
      groupClasses.push(o);
    }
  }
  groupClasses.sort(
    (a, b) =>
      a.year - b.year ||
      a.month - b.month ||
      a.day - b.day ||
      a.startMin - b.startMin,
  );

  // 예약 고객의 서비스별 잔여 횟수 prefetch — booked 셀 팝오버가 탭 즉시
  // 채워지도록(서버 왕복 없이). 윈도우 내 예약 고객만 대상.
  const custIds = Array.from(
    new Set(reservations.map((r) => r.customerUserId)),
  );
  const remainingByCustomer: Record<string, CustomerRemaining[]> = {};
  if (custIds.length > 0) {
    const pkgs = await prisma.package.findMany({
      where: { gymId, userId: { in: custIds } },
      select: {
        userId: true,
        totalCount: true,
        remainingCount: true,
        service: { select: { name: true } },
      },
    });
    const byUser = new Map<string, Map<string, CustomerRemaining>>();
    for (const p of pkgs) {
      const svc = p.service?.name ?? "-";
      let m = byUser.get(p.userId);
      if (!m) {
        m = new Map();
        byUser.set(p.userId, m);
      }
      const cur = m.get(svc) ?? { service: svc, total: 0, remaining: 0 };
      cur.total += p.totalCount;
      cur.remaining += p.remainingCount;
      m.set(svc, cur);
    }
    for (const [uid, m] of byUser) {
      remainingByCustomer[uid] = [...m.values()];
    }
  }

  return {
    trainerName,
    today: { year: cy, month: cm, day: cd },
    slotAxis,
    days,
    todayIdx: todayIdx < 0 ? 0 : todayIdx,
    groupClasses,
    remainingByCustomer,
  };
}

// ─── 단일 하루 트레이너 가용성 ──────────────────────────────
// loadTrainerCalendar 는 3개월 그리드를 통째로 계산한다 — 데이 시트처럼
// "그 날 하루" 만 알면 되는 곳엔 과하다. 이 함수는 그 날짜 1일치만 조회해
// open/off/closed + 빈 슬롯 존재 여부를 빠르게 돌려준다.
//
// 주의: 트레이너 담당 단체수업 슬롯은 그 수업의 학생 예약(staffId=트레이너)
// 으로 reservations 에 잡혀 막힌다. 등록자 0인 단체수업만 예외적으로 비는
// 것처럼 보일 수 있으나, 실제 예약 화면(loadTrainerCalendar)이 최종 차단한다.
export type TrainerDayAvailability = {
  state: "open" | "off" | "closed";
  onLeave: boolean; // off 가 휴가 때문이면 true (정기 휴무 요일이면 false)
  hasFree: boolean; // open 일 때 빈 슬롯이 하나라도 있나
};

export async function loadTrainerDayAvailability(
  gymId: string,
  staffId: string,
  dayUtcMid: Date, // 그 날 자정(UTC-naive)
): Promise<TrainerDayAvailability> {
  const dayEnd = new Date(dayUtcMid.getTime() + MS_PER_DAY);
  const [hours, closure, staff, leave, reservations] = await Promise.all([
    prisma.businessHours.findMany({ where: { gymId } }),
    prisma.businessClosure.findFirst({
      where: { gymId, date: dayUtcMid },
    }),
    prisma.staff.findUnique({
      where: { id: staffId },
      select: {
        weeklyOffDays: true,
        workStartMin: true,
        workEndMin: true,
        breakStartMin: true,
        breakEndMin: true,
      },
    }),
    prisma.staffLeave.findFirst({
      where: {
        staffId,
        startDate: { lte: dayUtcMid },
        endDate: { gte: dayUtcMid },
      },
      select: { id: true },
    }),
    prisma.reservation.findMany({
      where: {
        gymId,
        staffId,
        startAt: { gte: dayUtcMid, lt: dayEnd },
        status: { notIn: ["CANCELLED", "REJECTED"] },
      },
      select: { startAt: true },
    }),
  ]);

  const gym = computeStatus(dayUtcMid, hours, closure);
  if (gym.state === "CLOSED_DAY" || gym.state === "NO_HOURS_SET") {
    return { state: "closed", onLeave: false, hasFree: false };
  }

  const offDay = (staff?.weeklyOffDays ?? []).includes(
    WD[dayUtcMid.getUTCDay()]!,
  );
  const onLeave = leave !== null;
  if (offDay || onLeave) {
    return { state: "off", onLeave, hasFree: false };
  }

  const oMin = Math.max(gym.openMin, staff?.workStartMin ?? gym.openMin);
  const cMin = Math.min(gym.closeMin, staff?.workEndMin ?? gym.closeMin);
  const brkS = staff?.breakStartMin ?? null;
  const brkE = staff?.breakEndMin ?? null;
  const hasBrk = brkS != null && brkE != null && brkE > brkS;

  const bookedStarts = reservations.map(
    (r) => r.startAt.getUTCHours() * 60 + r.startAt.getUTCMinutes(),
  );

  let hasFree = false;
  const axisStart = Math.floor(oMin / 60) * 60;
  for (let s = axisStart; s + CLASS_MIN <= cMin; s += SLOT_MIN) {
    if (s < oMin) continue;
    if (hasBrk && s < brkE! && s + CLASS_MIN > brkS!) continue;
    const slotBooked = bookedStarts.some(
      (bm) => bm >= s && bm < s + SLOT_MIN,
    );
    if (!slotBooked) {
      hasFree = true;
      break;
    }
  }
  return { state: "open", onLeave: false, hasFree };
}
