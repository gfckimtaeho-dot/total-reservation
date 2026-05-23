// 매장 타임존 기준 시간 계산.
//
// 예약·수업 시각(Reservation.startAt 등)은 UTC-naive 로 저장된다 — 매장
// 벽시계 시각을 그대로 UTC 파츠에 넣는 방식. 그래서 "오늘"도 매장 타임존의
// 달력일을 UTC 자정 Date 로 표현해, 같은 기준(UTC 파츠 = 매장 벽시계)으로
// 비교한다. IANA 타임존 + Intl 변환이라 DST 도 알아서 처리된다(고정 오프셋 X).

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// 주어진 순간(now)이 timeZone 기준 며칠인지 → 그 날짜의 UTC 자정 Date.
export function gymTodayUtcMidnight(
  timeZone: string,
  now: Date = new Date(),
): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const num = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return new Date(Date.UTC(num("year"), num("month") - 1, num("day")));
}

// 매장 타임존 기준 오늘 하루의 UTC-naive 범위 [start, end).
export function gymTodayRange(
  timeZone: string,
  now: Date = new Date(),
): { start: Date; end: Date } {
  const start = gymTodayUtcMidnight(timeZone, now);
  return { start, end: new Date(start.getTime() + MS_PER_DAY) };
}

// 매장 타임존 기준 "지금"을 UTC-naive(벽시계 → UTC 파츠)로 반환.
// startAt/endAt 등 UTC-naive 저장값과 같은 표현이라 직접 비교 가능.
// "당일 + 1시간 이후" 룰 등 시각 비교에 사용.
export function gymNowUtcNaive(
  timeZone: string,
  now: Date = new Date(),
): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const num = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return new Date(
    Date.UTC(
      num("year"),
      num("month") - 1,
      num("day"),
      num("hour"),
      num("minute"),
      num("second"),
    ),
  );
}

export type MonthInfo = {
  year: number;
  month: number; // 1-12
  daysInMonth: number;
  firstWeekday: number; // 0=Sun
  todayDay: number;
};

// 매장 타임존 기준 현재 월 정보 (사장 대시보드 월 달력 위젯용).
export function getGymMonthInfo(
  timeZone: string,
  now: Date = new Date(),
): MonthInfo {
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    parseInt(
      new Intl.DateTimeFormat("en-US", { timeZone, ...opts }).format(now),
      10,
    );
  const year = fmt({ year: "numeric" });
  const month = fmt({ month: "numeric" });
  const todayDay = fmt({ day: "numeric" });
  // 월의 일수·시작요일은 연·월만으로 결정 — 타임존 무관. 정오로 잡아 안전.
  const firstWeekday = new Date(
    Date.UTC(year, month - 1, 1, 12),
  ).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
  return { year, month, daysInMonth, firstWeekday, todayDay };
}

// 매장 타임존 기준 현재 월 라벨 (예: "2026년 5월").
export function formatGymMonthLabel(
  timeZone: string,
  now: Date,
  lang: string,
): string {
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "ko-KR", {
    timeZone,
    year: "numeric",
    month: "long",
  }).format(now);
}

// 자정 기준 분 → "HH:MM". 벽시계 분이라 타임존 무관.
export function fmtTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
