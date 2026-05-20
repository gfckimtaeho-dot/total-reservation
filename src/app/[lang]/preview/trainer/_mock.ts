// 트레이너 대시보드 시안용 mock — 슬롯 그리드 + 오늘 요약 + 액션 버튼들.
// 모든 시안이 같은 데이터 위에서 디자인만 다르게.

export const TRAINER_NAME = "Kevin";
export const GYM_NAME = "STRONGHEALTH";
export const TODAY_LABEL = "2026년 5월 20일 (화)";
export const TODAY_SHORT = "5/20";

// 슬롯 축 — 10:00 ~ 22:00, 60분 간격
export const SLOT_AXIS = [
  600, 660, 720, 780, 840, 900, 960, 1020, 1080, 1140, 1200, 1260, 1320,
];

export type GridCell =
  | { kind: "unavail" }
  | { kind: "free" }
  | {
      kind: "booked";
      customerName: string;
      service: string;
      completed: boolean;
    };

export type DayCol = {
  month: number;
  day: number;
  weekdayIdx: number;
  isToday: boolean;
  state: "open" | "off";
  cells: GridCell[];
};

// 5일치 컬럼 (오늘 + 다음 4일)
export const DAYS: DayCol[] = [
  {
    month: 5,
    day: 20,
    weekdayIdx: 2,
    isToday: true,
    state: "open",
    cells: [
      { kind: "free" }, // 10:00
      { kind: "free" }, // 11:00
      { kind: "unavail" }, // 12:00 점심
      { kind: "free" }, // 13:00
      { kind: "booked", customerName: "박지영", service: "PT", completed: true }, // 14:00
      { kind: "free" }, // 15:00
      { kind: "free" }, // 16:00
      { kind: "free" }, // 17:00
      { kind: "booked", customerName: "김태호", service: "PT", completed: false }, // 18:00
      { kind: "booked", customerName: "이수민", service: "PT", completed: false }, // 19:00
      { kind: "free" }, // 20:00
      { kind: "free" }, // 21:00
      { kind: "free" }, // 22:00
    ],
  },
  {
    month: 5,
    day: 21,
    weekdayIdx: 3,
    isToday: false,
    state: "open",
    cells: [
      { kind: "free" },
      { kind: "booked", customerName: "조민호", service: "PT", completed: false },
      { kind: "unavail" },
      { kind: "free" },
      { kind: "free" },
      { kind: "booked", customerName: "이혜진", service: "PT", completed: false },
      { kind: "free" },
      { kind: "free" },
      { kind: "booked", customerName: "정시우", service: "PT", completed: false },
      { kind: "free" },
      { kind: "booked", customerName: "윤소라", service: "Yoga", completed: false },
      { kind: "free" },
      { kind: "free" },
    ],
  },
  {
    month: 5,
    day: 22,
    weekdayIdx: 4,
    isToday: false,
    state: "open",
    cells: [
      { kind: "free" },
      { kind: "free" },
      { kind: "unavail" },
      { kind: "free" },
      { kind: "booked", customerName: "박지영", service: "PT", completed: false },
      { kind: "free" },
      { kind: "free" },
      { kind: "free" },
      { kind: "booked", customerName: "김태호", service: "PT", completed: false },
      { kind: "free" },
      { kind: "free" },
      { kind: "free" },
      { kind: "free" },
    ],
  },
  {
    month: 5,
    day: 23,
    weekdayIdx: 5,
    isToday: false,
    state: "off",
    cells: SLOT_AXIS.map(() => ({ kind: "unavail" }) as GridCell),
  },
  {
    month: 5,
    day: 24,
    weekdayIdx: 6,
    isToday: false,
    state: "open",
    cells: [
      { kind: "booked", customerName: "황민서", service: "PT", completed: false },
      { kind: "booked", customerName: "유재현", service: "PT", completed: false },
      { kind: "unavail" },
      { kind: "free" },
      { kind: "free" },
      { kind: "free" },
      { kind: "booked", customerName: "안서연", service: "PT", completed: false },
      { kind: "free" },
      { kind: "free" },
      { kind: "free" },
      { kind: "free" },
      { kind: "free" },
      { kind: "free" },
    ],
  },
];

export function fmtMin(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// 오늘 일정 요약 (날짜 컬럼 0번 = 오늘)
export function getTodaySessions() {
  const today = DAYS[0];
  return today.cells
    .map((c, i) =>
      c.kind === "booked"
        ? {
            slotMin: SLOT_AXIS[i],
            name: c.customerName,
            service: c.service,
            completed: c.completed,
          }
        : null,
    )
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

// 트레이너 dashboard 4개 액션 버튼 라벨
export const ACTIONS = [
  { key: "showcase", label: "내 프로필" },
  { key: "intake", label: "발급" },
  { key: "performance", label: "실적" },
  { key: "logout", label: "로그아웃" },
];

export const WD_KO = ["일", "월", "화", "수", "목", "금", "토"];
