// 오늘/특정 날짜의 매장 영업 상태 계산. BusinessHours(주간) + BusinessClosure(특정일 override) 결합.
// dashboard 위젯과 hours 페이지에서 공유.

import type { BusinessClosure, BusinessHours } from "@/generated/prisma/client";
import type { ClosureKind, Weekday } from "@/generated/prisma/enums";

const WEEKDAYS: Weekday[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export type OpenStatus =
  | { state: "OPEN"; openMin: number; closeMin: number; breakStartMin: number | null; breakEndMin: number | null; reason: string | null; overridden: boolean }
  | { state: "CLOSED_DAY"; reason: string | null; overridden: boolean }
  | { state: "NO_HOURS_SET" };

export function fmtMinute(min: number): string {
  if (min === 1440) return "24:00";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// YYYY-MM-DD (gym local — 일단 서버 timezone 그대로 사용. UTC stored Date 그대로 YMD 변환)
export function ymd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function weekdayOf(d: Date): Weekday {
  return WEEKDAYS[d.getUTCDay()];
}

export function computeStatus(
  date: Date,
  hours: BusinessHours[],
  closure: BusinessClosure | null,
): OpenStatus {
  if (closure) {
    if (closure.kind === ("CLOSED" as ClosureKind)) {
      return { state: "CLOSED_DAY", reason: closure.reason, overridden: true };
    }
    if (closure.kind === ("SHORTENED" as ClosureKind)) {
      const wd = weekdayOf(date);
      const base = hours.find((h) => h.weekday === wd);
      return {
        state: "OPEN",
        openMin: closure.openMinute ?? 0,
        closeMin: closure.closeMinute ?? 1440,
        breakStartMin: base?.breakStartMin ?? null,
        breakEndMin: base?.breakEndMin ?? null,
        reason: closure.reason,
        overridden: true,
      };
    }
  }
  const wd = weekdayOf(date);
  const base = hours.find((h) => h.weekday === wd);
  if (!base) return { state: "CLOSED_DAY", reason: null, overridden: false };
  return {
    state: "OPEN",
    openMin: base.openMinute,
    closeMin: base.closeMinute,
    breakStartMin: base.breakStartMin,
    breakEndMin: base.breakEndMin,
    reason: null,
    overridden: false,
  };
}

// 다가오는 closure (오늘 포함). limit 만큼 반환.
export function upcomingClosures(
  closures: BusinessClosure[],
  todayYmd: string,
  limit = 5,
): BusinessClosure[] {
  return closures
    .filter((c) => ymd(c.date) >= todayYmd)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .slice(0, limit);
}
