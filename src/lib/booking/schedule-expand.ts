// ScheduledClass row들을 특정 달의 day별 이벤트로 확장.
// RECURRING: weekdays + validFrom/Until 범위 안에서 매칭되는 모든 day.
// ONE_OFF: specificDate가 그 달이면 그 day.

import type { Weekday } from "@/generated/prisma/enums";

const WEEKDAY_ENUM: Weekday[] = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
];

export type ClassEvent = {
  scheduleId: string;
  serviceId: string;
  serviceName: string;
  capacity: number;
  enrolled: number;
  customers: string[];
  startMin: number;
  endMin: number;
  durationMin: number;
  staffName: string | null;
  note: string | null;
  kind: "RECURRING" | "ONE_OFF";
};

export type ScheduleInput = {
  id: string;
  serviceId: string;
  service: { name: string; capacity: number; durationMin: number };
  staff: { user: { name: string } } | null;
  kind: "RECURRING" | "ONE_OFF";
  weekdays: Weekday[];
  specificDate: Date | null;
  startMinute: number;
  validFrom: Date;
  validUntil: Date | null;
  note: string | null;
  reservations: Array<{ startAt: Date; customerName: string }>;
};

export function expandSchedulesToMonth(
  schedules: ScheduleInput[],
  year: number,
  monthIdx: number,
): Map<number, ClassEvent[]> {
  const map = new Map<number, ClassEvent[]>();
  const daysInMonth = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();

  for (const s of schedules) {
    const endMin = (s.startMinute + s.service.durationMin) % (24 * 60);
    const common = {
      scheduleId: s.id,
      serviceId: s.serviceId,
      serviceName: s.service.name,
      capacity: s.service.capacity,
      startMin: s.startMinute,
      endMin,
      durationMin: s.service.durationMin,
      staffName: s.staff?.user.name ?? null,
      note: s.note,
      kind: s.kind,
    };

    const namesOnDay = (day: number): string[] => {
      const dayStart = new Date(Date.UTC(year, monthIdx, day));
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
      return s.reservations
        .filter((r) => r.startAt >= dayStart && r.startAt < dayEnd)
        .map((r) => r.customerName);
    };

    if (s.kind === "ONE_OFF") {
      if (!s.specificDate) continue;
      if (
        s.specificDate.getUTCFullYear() !== year ||
        s.specificDate.getUTCMonth() !== monthIdx
      ) {
        continue;
      }
      const day = s.specificDate.getUTCDate();
      const names = namesOnDay(day);
      pushTo(map, day, { ...common, enrolled: names.length, customers: names });
      continue;
    }

    // RECURRING — weekdays + validFrom/Until 범위 안 모든 day 매칭
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(Date.UTC(year, monthIdx, d));
      if (dt < s.validFrom) continue;
      if (s.validUntil && dt > s.validUntil) continue;
      const wd = WEEKDAY_ENUM[dt.getUTCDay()]!;
      if (!s.weekdays.includes(wd)) continue;
      const names = namesOnDay(d);
      pushTo(map, d, { ...common, enrolled: names.length, customers: names });
    }
  }

  for (const list of map.values()) {
    list.sort((a, b) => a.startMin - b.startMin);
  }
  return map;
}

function pushTo<K, V>(m: Map<K, V[]>, key: K, value: V) {
  const list = m.get(key) ?? [];
  list.push(value);
  m.set(key, list);
}

export function fmtMin(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
