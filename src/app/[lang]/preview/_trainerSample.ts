import { getManilaMonthInfo, formatManilaMonthLabel } from "./_mock";

// Trainer dashboard 시안용 mock — 실제 데이터 wiring 전 visual 비교 목적.

export const SAMPLE_TRAINER_NAME = "박코치";

export const SAMPLE_WEEKLY_OFF = ["SUN"] as const;
export type SampleWeekday =
  | "SUN"
  | "MON"
  | "TUE"
  | "WED"
  | "THU"
  | "FRI"
  | "SAT";

export const WEEKDAY_BY_INDEX: SampleWeekday[] = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
];

// 일자별 단체수업 (이름은 한글 직접)
export const SAMPLE_CLASSES_BY_DAY: Record<number, string[]> = {
  3: ["요가"],
  6: ["필라테스", "요가"],
  9: ["스피닝"],
  13: ["요가", "필라테스"],
  16: ["스피닝"],
  20: ["요가"],
  23: ["필라테스"],
  27: ["요가", "스피닝"],
};

// 매장 휴관일 (예: 매주 일요일이지만 미래 예약 흐름 위해 일부 더 표시)
export const SAMPLE_CLOSED_DAYS = new Set([10, 17, 24, 31]);

// 오늘 예약 샘플 (트레이너 본인 시점)
export type SampleReservation = {
  id: string;
  startMin: number;
  endMin: number;
  customer: string;
  service: string;
  type: "PT" | "GROUP";
  enrolled?: number;
  capacity?: number;
};

export const SAMPLE_RESERVATIONS_TODAY: SampleReservation[] = [
  {
    id: "r1",
    startMin: 7 * 60,
    endMin: 8 * 60,
    customer: "김민수",
    service: "PT 60분",
    type: "PT",
  },
  {
    id: "r2",
    startMin: 9 * 60,
    endMin: 10 * 60,
    customer: "이서연",
    service: "PT 60분",
    type: "PT",
  },
  {
    id: "r3",
    startMin: 11 * 60,
    endMin: 12 * 60,
    customer: "그룹 요가",
    service: "요가 60분",
    type: "GROUP",
    enrolled: 8,
    capacity: 12,
  },
  {
    id: "r4",
    startMin: 14 * 60,
    endMin: 15 * 60,
    customer: "박지훈",
    service: "PT 60분",
    type: "PT",
  },
];

export function fmtTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function isOffDay(
  day: number,
  monthInfo: ReturnType<typeof getManilaMonthInfo>,
): boolean {
  if (SAMPLE_CLOSED_DAYS.has(day)) return true;
  const idx = (monthInfo.firstWeekday + (day - 1)) % 7;
  return (SAMPLE_WEEKLY_OFF as readonly string[]).includes(
    WEEKDAY_BY_INDEX[idx],
  );
}

export function buildSampleProps() {
  const today = new Date();
  return {
    today,
    monthLabel: formatManilaMonthLabel(today, "ko"),
    monthInfo: getManilaMonthInfo(today),
    todayDisplay: new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    }).format(today),
  };
}

export const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;
