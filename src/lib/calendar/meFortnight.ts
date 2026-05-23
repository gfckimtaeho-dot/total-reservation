import { prisma } from "@/lib/db/client";

// 고객 예약 페이지 — 오늘부터 14일 cells. /me/calendar 가 사용한다.
// loadMeCalendarMonth 와 같은 데이터 구조이지만 grid 가 아닌 단순 14칸 배열로,
// 앞뒤 패딩(다른 달) 칸 없음. 14일 윈도우는 본 /me 의 maxBookKey(3개월)보다
// 좁지만 일반적인 예약 빈도(주 1~2회)에 충분.

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const FORTNIGHT_DAYS = 14;
const WEEKDAY_ENUM = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
] as const;

export type MeFortnightEvent = {
  id: string;
  kind: "pt" | "group";
  startMin: number;
  label: string;
  staffName: string;
  status: string;
};

export type MeFortnightGroupClass = {
  scheduleId: string;
  serviceId: string;
  className: string;
  startMin: number;
};

export type MeFortnightCell = {
  dayKey: string; // "YYYY-MM-DD"
  day: number;
  month: number;
  weekdayIdx: number; // 0=Sun
  isToday: boolean;
  isOpen: boolean;
  events: MeFortnightEvent[];
  groupClasses: MeFortnightGroupClass[];
};

export type MeFortnight = {
  todayKey: string;
  cells: MeFortnightCell[]; // 길이 14
};

function dayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export async function loadMeFortnight(
  gymId: string,
  userId: string,
  todayUtcMid: Date,
): Promise<MeFortnight> {
  const rangeStart = todayUtcMid;
  const rangeEnd = new Date(todayUtcMid.getTime() + FORTNIGHT_DAYS * MS_PER_DAY);

  const [reservations, businessHours, closures, groupPkgs] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        gymId,
        customerUserId: userId,
        startAt: { gte: rangeStart, lt: rangeEnd },
        status: { notIn: ["CANCELLED", "REJECTED"] },
      },
      select: {
        id: true,
        startAt: true,
        scheduledClassId: true,
        status: true,
        service: { select: { name: true, capacity: true } },
        staff: { select: { user: { select: { name: true } } } },
      },
    }),
    prisma.businessHours.findMany({
      where: { gymId },
      select: { weekday: true },
    }),
    prisma.businessClosure.findMany({
      where: {
        gymId,
        date: { gte: rangeStart, lt: rangeEnd },
        kind: "CLOSED",
      },
      select: { date: true },
    }),
    // 단체권 보유 서비스 — 해당 서비스 단체수업만 마킹.
    prisma.package.findMany({
      where: {
        gymId,
        userId,
        remainingCount: { gt: 0 },
        refundedAt: null,
        service: { capacity: { gt: 1 } },
      },
      select: { serviceId: true },
    }),
  ]);

  const eventsByDay = new Map<string, MeFortnightEvent[]>();
  for (const r of reservations) {
    const k = dayKey(r.startAt);
    const isGroup =
      r.scheduledClassId !== null || (r.service?.capacity ?? 1) !== 1;
    const arr = eventsByDay.get(k) ?? [];
    arr.push({
      id: r.id,
      kind: isGroup ? "group" : "pt",
      startMin: r.startAt.getUTCHours() * 60 + r.startAt.getUTCMinutes(),
      label: r.service?.name ?? "서비스",
      staffName: r.staff?.user.name ?? "",
      status: r.status,
    });
    eventsByDay.set(k, arr);
  }
  for (const arr of eventsByDay.values()) {
    arr.sort((a, b) => a.startMin - b.startMin);
  }

  // 단체수업 — 보유 단체권 서비스의 active schedule 만, 14일 범위로.
  const groupServiceIds = [...new Set(groupPkgs.map((p) => p.serviceId))];
  const schedules =
    groupServiceIds.length === 0
      ? []
      : await prisma.scheduledClass.findMany({
          where: {
            gymId,
            active: true,
            serviceId: { in: groupServiceIds },
            validFrom: { lt: rangeEnd },
            OR: [{ validUntil: null }, { validUntil: { gte: rangeStart } }],
          },
          select: {
            id: true,
            serviceId: true,
            kind: true,
            weekdays: true,
            specificDate: true,
            startMinute: true,
            validFrom: true,
            validUntil: true,
            service: { select: { name: true } },
          },
        });

  const groupByDay = new Map<string, MeFortnightGroupClass[]>();
  if (schedules.length > 0) {
    for (let i = 0; i < FORTNIGHT_DAYS; i++) {
      const d = new Date(rangeStart.getTime() + i * MS_PER_DAY);
      const k = dayKey(d);
      const wd = WEEKDAY_ENUM[d.getUTCDay()]!;
      for (const sc of schedules) {
        if (d < sc.validFrom) continue;
        if (sc.validUntil && d > sc.validUntil) continue;
        if (sc.kind === "ONE_OFF") {
          if (!sc.specificDate || dayKey(sc.specificDate) !== k) continue;
        } else if (!sc.weekdays.includes(wd)) {
          continue;
        }
        const arr = groupByDay.get(k) ?? [];
        arr.push({
          scheduleId: sc.id,
          serviceId: sc.serviceId,
          className: sc.service.name,
          startMin: sc.startMinute,
        });
        groupByDay.set(k, arr);
      }
    }
    for (const arr of groupByDay.values()) {
      arr.sort((a, b) => a.startMin - b.startMin);
    }
  }

  const openWeekdays = new Set<string>(businessHours.map((b) => b.weekday));
  const closedDays = new Set(closures.map((c) => dayKey(c.date)));
  const todayKey = dayKey(todayUtcMid);

  const cells: MeFortnightCell[] = [];
  for (let i = 0; i < FORTNIGHT_DAYS; i++) {
    const d = new Date(rangeStart.getTime() + i * MS_PER_DAY);
    const k = dayKey(d);
    const wd = WEEKDAY_ENUM[d.getUTCDay()]!;
    cells.push({
      dayKey: k,
      day: d.getUTCDate(),
      month: d.getUTCMonth() + 1,
      weekdayIdx: d.getUTCDay(),
      isToday: k === todayKey,
      isOpen: openWeekdays.has(wd) && !closedDays.has(k),
      events: eventsByDay.get(k) ?? [],
      groupClasses: groupByDay.get(k) ?? [],
    });
  }
  return { todayKey, cells };
}
