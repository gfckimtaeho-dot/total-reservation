// Mock data for dashboard preview variants v1~v5.
// Lives only under /preview/* routes — never imported from production code.

export type MockReservation = {
  id: string;
  startMin: number;
  endMin: number;
  customer: string;
  staff: string;
  service: string;
  serviceType: "PT" | "GROUP" | "FREE";
  capacity?: number;
  enrolled?: number;
  status: "CONFIRMED" | "IN_PROGRESS" | "COMPLETED";
};

export const MOCK_BUSINESS = {
  name: "스트롱 헬스",
  slug: "stringhealth2",
  category: "GYM" as const,
  address: "Angeles · Balibago · Real St. 41",
  phone: "+63 915 123 4567",
  email: "owner@stringhealth.ph",
  openingHours: "평일 06:00 - 23:00",
};

export const MOCK_TODAY = {
  iso: "2026-05-05",
  display: "2026년 5월 5일 · 화요일",
  nowMin: 9 * 60 + 30,
};

// 7건 — 진행중 2건 (09:00 동시간대 PT 2명) + 14:00 PT 2명 + 11:00 그룹수업
export const MOCK_RESERVATIONS_TODAY: MockReservation[] = [
  { id: "r1", startMin: 7 * 60, endMin: 8 * 60, customer: "김민수", staff: "박코치", service: "PT 60분", serviceType: "PT", status: "COMPLETED" },
  { id: "r2", startMin: 9 * 60, endMin: 10 * 60, customer: "이서연", staff: "정코치", service: "필라테스 60분", serviceType: "PT", status: "IN_PROGRESS" },
  { id: "r2b", startMin: 9 * 60, endMin: 10 * 60, customer: "김지수", staff: "박코치", service: "PT 60분", serviceType: "PT", status: "IN_PROGRESS" },
  { id: "r3", startMin: 11 * 60, endMin: 12 * 60, customer: "그룹 요가", staff: "한코치", service: "요가 60분", serviceType: "GROUP", capacity: 12, enrolled: 8, status: "CONFIRMED" },
  { id: "r4", startMin: 14 * 60, endMin: 15 * 60, customer: "박지훈", staff: "박코치", service: "PT 60분", serviceType: "PT", status: "CONFIRMED" },
  { id: "r4b", startMin: 14 * 60, endMin: 15 * 60, customer: "최유진", staff: "정코치", service: "PT 60분", serviceType: "PT", status: "CONFIRMED" },
  { id: "r5", startMin: 19 * 60, endMin: 20 * 60, customer: "안소진", staff: "정코치", service: "PT 60분", serviceType: "PT", status: "CONFIRMED" },
];

export const MOCK_KPI = {
  todayBookings: MOCK_RESERVATIONS_TODAY.length,
  inProgress: MOCK_RESERVATIONS_TODAY.filter((r) => r.status === "IN_PROGRESS").length,
  activeMembers: 238,
  totalCustomersEver: 315,
  todayShiftStaff: 3,
};

export type MockExpiring = { name: string; until: string; daysLeft: number };
export const MOCK_EXPIRING: MockExpiring[] = [
  { name: "이서연", until: "2026-05-08", daysLeft: 3 },
  { name: "박지훈", until: "2026-05-09", daysLeft: 4 },
  { name: "최유진", until: "2026-05-11", daysLeft: 6 },
  { name: "김민수", until: "2026-05-12", daysLeft: 7 },
];

export type MockDay = {
  day: number;
  total: number;
  pt: number;
  group: number;
  free: number;
  noShow: number;
  isClosed?: boolean;
  isToday?: boolean;
};

export const MOCK_MONTH_LABEL = "2026년 5월";
export const MOCK_MONTH_START_WEEKDAY = 5; // 1일이 금요일 가정
export const MOCK_MONTH_DAYS = 31;

export const MOCK_MONTH: MockDay[] = [
  { day: 1, total: 28, pt: 18, group: 6, free: 4, noShow: 0 },
  { day: 2, total: 31, pt: 20, group: 7, free: 4, noShow: 0 },
  { day: 3, total: 45, pt: 28, group: 12, free: 5, noShow: 0 },
  { day: 4, total: 42, pt: 26, group: 12, free: 4, noShow: 1 },
  { day: 5, total: 7, pt: 6, group: 1, free: 0, noShow: 0, isToday: true },
  { day: 6, total: 38, pt: 24, group: 10, free: 4, noShow: 0 },
  { day: 7, total: 22, pt: 14, group: 4, free: 4, noShow: 0 },
  { day: 8, total: 35, pt: 22, group: 9, free: 4, noShow: 0 },
  { day: 9, total: 18, pt: 12, group: 2, free: 4, noShow: 0 },
  { day: 10, total: 0, pt: 0, group: 0, free: 0, noShow: 0, isClosed: true },
  { day: 11, total: 0, pt: 0, group: 0, free: 0, noShow: 0 },
  { day: 12, total: 25, pt: 16, group: 5, free: 4, noShow: 0 },
  { day: 13, total: 44, pt: 28, group: 12, free: 4, noShow: 1 },
  { day: 14, total: 21, pt: 14, group: 3, free: 4, noShow: 0 },
  { day: 15, total: 0, pt: 0, group: 0, free: 0, noShow: 0 },
  { day: 16, total: 37, pt: 22, group: 11, free: 4, noShow: 0 },
  { day: 17, total: 0, pt: 0, group: 0, free: 0, noShow: 0, isClosed: true },
  { day: 18, total: 0, pt: 0, group: 0, free: 0, noShow: 0 },
  { day: 19, total: 0, pt: 0, group: 0, free: 0, noShow: 0 },
  { day: 20, total: 0, pt: 0, group: 0, free: 0, noShow: 0 },
  { day: 21, total: 0, pt: 0, group: 0, free: 0, noShow: 0 },
  { day: 22, total: 0, pt: 0, group: 0, free: 0, noShow: 0 },
  { day: 23, total: 0, pt: 0, group: 0, free: 0, noShow: 0 },
  { day: 24, total: 0, pt: 0, group: 0, free: 0, noShow: 0, isClosed: true },
  { day: 25, total: 0, pt: 0, group: 0, free: 0, noShow: 0 },
  { day: 26, total: 0, pt: 0, group: 0, free: 0, noShow: 0 },
  { day: 27, total: 0, pt: 0, group: 0, free: 0, noShow: 0 },
  { day: 28, total: 0, pt: 0, group: 0, free: 0, noShow: 0 },
  { day: 29, total: 0, pt: 0, group: 0, free: 0, noShow: 0 },
  { day: 30, total: 0, pt: 0, group: 0, free: 0, noShow: 0 },
  { day: 31, total: 0, pt: 0, group: 0, free: 0, noShow: 0, isClosed: true },
];

export const MOCK_TOTAL_MONTH_BOOKINGS = MOCK_MONTH.reduce((s, d) => s + d.total, 0);

export function shadeLevel(total: number): 0 | 1 | 2 | 3 {
  if (total === 0) return 0;
  if (total < 20) return 1;
  if (total < 35) return 2;
  return 3;
}

export function fmtTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// 같은 시간 시작 reservation을 묶어 반환 — 동시간대 multi-PT 시각화에 사용.
export function groupByHour(reservations: MockReservation[]): {
  hour: number;
  startMin: number;
  items: MockReservation[];
}[] {
  const map = new Map<number, MockReservation[]>();
  for (const r of reservations) {
    const key = r.startMin;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([startMin, items]) => ({
      hour: Math.floor(startMin / 60),
      startMin,
      items,
    }));
}

export const NAV_ITEMS = [
  { key: "members", label: "회원관리" },
  { key: "trainers", label: "트레이너 관리" },
  { key: "hours", label: "영업일" },
  { key: "services", label: "서비스" },
  { key: "revenue", label: "매출현황" },
  { key: "settings", label: "설정" },
] as const;
