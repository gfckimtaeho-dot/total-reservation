// 5개 시안 공통 mock — 같은 데이터 위에서 디자인 차이만 비교하기 위함.
// 실제 데이터 binding 은 컨펌 후 /me 본 페이지에서.

export type MockRes = {
  id: string;
  dayKey: string; // YYYY-MM-DD
  startMin: number;
  endMin: number;
  service: string;
  trainer: string;
  isGroup: boolean;
};

export type CalCell = {
  dayKey: string;
  day: number;
  month: number;
  weekdayIdx: number; // 0=Sun
  isToday: boolean;
  isPast: boolean;
  isCurrentMonth: boolean;
  hasEvent: boolean;
  isGroupEvent: boolean;
  isPersonalEvent: boolean;
};

export const TODAY_KEY = "2026-05-20";
export const TODAY_LABEL = "5월 20일 (화)";
export const GYM_NAME = "STRONGHEALTH";
export const MEMBER_NAME = "김태호";

export const TODAY_RES: MockRes[] = [
  {
    id: "t1",
    dayKey: TODAY_KEY,
    startMin: 18 * 60,
    endMin: 18 * 60 + 50,
    service: "PT",
    trainer: "Kevin",
    isGroup: false,
  },
];

export const UPCOMING: MockRes[] = [
  {
    id: "u1",
    dayKey: "2026-05-22",
    startMin: 19 * 60,
    endMin: 19 * 60 + 50,
    service: "Yoga (Group)",
    trainer: "Nari",
    isGroup: true,
  },
  {
    id: "u2",
    dayKey: "2026-05-24",
    startMin: 9 * 60,
    endMin: 9 * 60 + 50,
    service: "PT",
    trainer: "Kevin",
    isGroup: false,
  },
  {
    id: "u3",
    dayKey: "2026-05-27",
    startMin: 18 * 60,
    endMin: 18 * 60 + 50,
    service: "PT",
    trainer: "Kevin",
    isGroup: false,
  },
  {
    id: "u4",
    dayKey: "2026-05-30",
    startMin: 19 * 60,
    endMin: 19 * 60 + 50,
    service: "Yoga (Group)",
    trainer: "Nari",
    isGroup: true,
  },
  {
    id: "u5",
    dayKey: "2026-06-03",
    startMin: 18 * 60,
    endMin: 18 * 60 + 50,
    service: "PT",
    trainer: "Kevin",
    isGroup: false,
  },
  {
    id: "u6",
    dayKey: "2026-06-08",
    startMin: 18 * 60,
    endMin: 18 * 60 + 50,
    service: "PT",
    trainer: "Kevin",
    isGroup: false,
  },
];

export const MEMBERSHIPS = [
  { id: "m1", name: "30일 회원권", daysLeft: 23, expiresOn: "2026-06-12" },
  {
    id: "m2",
    name: "PT 보너스 30일권",
    daysLeft: 7,
    expiresOn: "2026-05-27",
  },
];

export const PACKAGES = [
  { id: "p1", service: "PT", remaining: 6, total: 10, trainer: "Kevin" },
  { id: "p2", service: "Yoga", remaining: 3, total: 8, trainer: "Nari" },
];

export function fmtMin(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function buildCalendar(): CalCell[] {
  const cells: CalCell[] = [];
  // 2026-05-17 (일) ~ 2026-06-20 (토) — 5주
  const start = new Date(Date.UTC(2026, 4, 17));
  const todayKey = TODAY_KEY;
  const currentMonth = 5;

  const eventByKey = new Map<
    string,
    { isGroup: boolean; isPersonal: boolean }
  >();
  for (const r of [...TODAY_RES, ...UPCOMING]) {
    const cur = eventByKey.get(r.dayKey) ?? {
      isGroup: false,
      isPersonal: false,
    };
    if (r.isGroup) cur.isGroup = true;
    else cur.isPersonal = true;
    eventByKey.set(r.dayKey, cur);
  }

  for (let i = 0; i < 35; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const yyyy = d.getUTCFullYear();
    const mm = d.getUTCMonth() + 1;
    const dd = d.getUTCDate();
    const key = `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    const ev = eventByKey.get(key);
    cells.push({
      dayKey: key,
      day: dd,
      month: mm,
      weekdayIdx: d.getUTCDay(),
      isToday: key === todayKey,
      isPast: key < todayKey,
      isCurrentMonth: mm === currentMonth,
      hasEvent: !!ev,
      isGroupEvent: ev?.isGroup ?? false,
      isPersonalEvent: ev?.isPersonal ?? false,
    });
  }
  return cells;
}

export const UPCOMING_BY_DAY = (() => {
  const m = new Map<string, MockRes[]>();
  for (const r of [...TODAY_RES, ...UPCOMING]) {
    const arr = m.get(r.dayKey) ?? [];
    arr.push(r);
    m.set(r.dayKey, arr);
  }
  return m;
})();
