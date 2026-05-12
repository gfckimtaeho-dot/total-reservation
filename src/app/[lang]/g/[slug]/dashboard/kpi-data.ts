// KPI 카드 안에 끼워넣을 영업시간 + 출근명단 fetch.
// 각 dashboard variant가 이 함수를 호출.

import { prisma } from "@/lib/db/client";
import { computeStatus, fmtMinute } from "@/lib/hours/status";

export type TodayHoursInfo =
  | { state: "OPEN"; openMin: number; closeMin: number; nowOpen: boolean; onBreak: boolean }
  | { state: "CLOSED"; reason: string | null };

export type CheckInRow = {
  userId: string;
  name: string;
  checkInMin: number | null; // null = 미출근
  lateMin: number | null; // null = 시간 데이터 없거나 storeOpen 모름
};

export async function getKpiExtras(gymId: string): Promise<{
  hours: TodayHoursInfo;
  staff: CheckInRow[];
}> {
  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );
  const todayLocalStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [businessHours, closure, staffList, accessLogs] = await Promise.all([
    prisma.businessHours.findMany({ where: { gymId } }),
    prisma.businessClosure.findUnique({
      where: { gymId_date: { gymId, date: todayUtc } },
    }),
    prisma.staff.findMany({
      where: { gymId, role: { in: ["MANAGER", "TRAINER"] } },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.accessLog.findMany({
      where: {
        gymId,
        result: "ALLOWED",
        occurredAt: { gte: todayLocalStart },
      },
      orderBy: { occurredAt: "asc" },
      select: { userId: true, occurredAt: true },
    }),
  ]);

  const firstByUser = new Map<string, Date>();
  for (const log of accessLogs) {
    if (!firstByUser.has(log.userId)) firstByUser.set(log.userId, log.occurredAt);
  }

  const status = computeStatus(todayUtc, businessHours, closure ?? null);
  const storeOpenMin = status.state === "OPEN" ? status.openMin : null;

  let hoursInfo: TodayHoursInfo;
  if (status.state === "OPEN") {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const inBreak =
      status.breakStartMin != null &&
      status.breakEndMin != null &&
      nowMin >= status.breakStartMin &&
      nowMin < status.breakEndMin;
    const open = nowMin >= status.openMin && nowMin < status.closeMin && !inBreak;
    hoursInfo = {
      state: "OPEN",
      openMin: status.openMin,
      closeMin: status.closeMin,
      nowOpen: open,
      onBreak: inBreak,
    };
  } else {
    hoursInfo = { state: "CLOSED", reason: status.state === "CLOSED_DAY" ? status.reason : null };
  }

  const rows: CheckInRow[] = staffList.map((s) => {
    const at = firstByUser.get(s.user.id) ?? null;
    let checkInMin: number | null = null;
    let lateMin: number | null = null;
    if (at) {
      checkInMin = at.getHours() * 60 + at.getMinutes();
      if (storeOpenMin != null) lateMin = checkInMin - storeOpenMin;
    }
    return { userId: s.user.id, name: s.user.name, checkInMin, lateMin };
  });

  // 출근한 사람 시간순, 미출근은 뒤
  rows.sort((a, b) => {
    if (a.checkInMin != null && b.checkInMin != null) return a.checkInMin - b.checkInMin;
    if (a.checkInMin != null) return -1;
    if (b.checkInMin != null) return 1;
    return a.name.localeCompare(b.name);
  });

  // 실제 staff가 0명이면 dev 미리보기용 mock 6명 표시.
  // production 데이터가 들어오면 자동으로 진짜 데이터로 대체됨.
  if (rows.length === 0) {
    return { hours: hoursInfo, staff: MOCK_STAFF_ROWS(storeOpenMin) };
  }

  return { hours: hoursInfo, staff: rows };
}

function MOCK_STAFF_ROWS(openMin: number | null): CheckInRow[] {
  // 매장 영업시작 9시 기준 정시/지각 mix
  const o = openMin ?? 540;
  return [
    { userId: "m1", name: "김민수", checkInMin: o - 5, lateMin: -5 },
    { userId: "m2", name: "이수정", checkInMin: o, lateMin: 0 },
    { userId: "m3", name: "박지훈", checkInMin: o + 12, lateMin: 12 },
    { userId: "m4", name: "최예진", checkInMin: o + 25, lateMin: 25 },
    { userId: "m5", name: "정현우", checkInMin: o - 2, lateMin: -2 },
    { userId: "m6", name: "한지영", checkInMin: null, lateMin: null },
  ];
}

export function fmtHoursRange(info: TodayHoursInfo): string {
  if (info.state === "CLOSED") return "—";
  return `${fmtMinute(info.openMin)} ~ ${fmtMinute(info.closeMin)}`;
}

export function fmtCheckIn(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}
