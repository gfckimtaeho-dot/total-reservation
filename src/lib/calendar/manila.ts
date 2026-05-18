// Manila(UTC+8, DST 없음) 기준 달력 유틸 + 트레이너 일정 타입.
// 기존 preview/_mock 의 순수 헬퍼를 production 코드용으로 분리한 것
// (_mock 은 /preview 전용이라 production import 금지였음).

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

export type MonthInfo = {
  year: number;
  month: number; // 1-12
  daysInMonth: number;
  firstWeekday: number; // 0=Sun
  todayDay: number;
};

// 트레이너가 담당하는 단일 예약(1:1) 또는 단체수업 1건.
export type TrainerEvent = {
  id: string;
  day: number; // Manila 기준 일(1-31)
  startMin: number; // Manila 자정 기준 분
  endMin: number;
  title: string; // 1:1=고객명 / 단체=수업명
  service: string;
  isGroup: boolean;
  capacity: number | null;
  enrolled: number | null;
  status: string;
};

export function getManilaMonthInfo(now: Date = new Date()): MonthInfo {
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      ...opts,
    }).format(now);
  const year = parseInt(fmt({ year: "numeric" }), 10);
  const month = parseInt(fmt({ month: "numeric" }), 10);
  const todayDay = parseInt(fmt({ day: "numeric" }), 10);

  // 정오(UTC 04:00 = Manila 12:00) 기준 — 시차 영향 회피
  const firstOfMonthUtc = new Date(Date.UTC(year, month - 1, 1, 4, 0, 0));
  const firstWeekday = firstOfMonthUtc.getUTCDay();
  const lastOfMonthUtc = new Date(Date.UTC(year, month, 0, 4, 0, 0));
  const daysInMonth = lastOfMonthUtc.getUTCDate();

  return { year, month, daysInMonth, firstWeekday, todayDay };
}

export function formatManilaMonthLabel(now: Date, lang: string): string {
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "ko-KR", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "long",
  }).format(now);
}

// UTC Timestamptz → Manila 기준 {day, minuteOfDay}
export function toManilaParts(utc: Date): {
  day: number;
  minuteOfDay: number;
} {
  const m = new Date(utc.getTime() + MANILA_OFFSET_MS);
  return {
    day: m.getUTCDate(),
    minuteOfDay: m.getUTCHours() * 60 + m.getUTCMinutes(),
  };
}

// 해당 Manila 월의 UTC 범위 [start, end) — Reservation.startAt 쿼리용
export function manilaMonthUtcRange(info: MonthInfo): {
  start: Date;
  end: Date;
} {
  const start = new Date(
    Date.UTC(info.year, info.month - 1, 1) - MANILA_OFFSET_MS,
  );
  const end = new Date(Date.UTC(info.year, info.month, 1) - MANILA_OFFSET_MS);
  return { start, end };
}

export function fmtTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// 같은 시작시각 이벤트를 묶음 — 동시간대 다중 세션 시각화.
export function groupByStart(events: TrainerEvent[]): {
  startMin: number;
  items: TrainerEvent[];
}[] {
  const map = new Map<number, TrainerEvent[]>();
  for (const e of events) {
    if (!map.has(e.startMin)) map.set(e.startMin, []);
    map.get(e.startMin)!.push(e);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([startMin, items]) => ({ startMin, items }));
}
