import { prisma } from "@/lib/db/client";

// 고객 대시보드 월간 캘린더 — 한 달치 셀(앞뒤 패딩 포함 full weeks).
// 각 셀은 그 날 본인 예약 목록(events)과, 그 날 열리는 단체수업 중 본인이
// 단체권을 보유한 수업(groupClasses)을 담는다.
// startAt 은 UTC-naive(Manila 벽시계를 UTC 파츠로 저장) — 시간대 변환 없이
// getUTC* 로 읽는다(트레이너 캘린더와 동일 기준).

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WEEKDAY_ENUM = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
] as const;

export type MeCalEvent = {
  id: string;
  kind: "pt" | "group"; // 색 구분용: 1:1 / 단체수업
  startMin: number; // 자정 기준 분 (UTC 파츠)
  label: string; // 실제 서비스명 (PT·요가·댄스1 등) — 하드코딩 금지
  staffName: string; // 담당 강사 (데이 시트 상세 표시용)
  status: string; // CONFIRMED·COMPLETED 등 — 완료 표시/액션 가능 판정용
  scheduledClassId: string | null; // 단체수업 회차 id (등록 중복 판정용)
};

// 그 날 열리는 단체수업 — 단, 고객이 그 서비스의 단체권을 보유한 것만.
// 캘린더 마커("이 날 수업 있음") + 데이 시트의 등록 후보로 쓰인다.
export type MeCalGroupClass = {
  scheduleId: string;
  serviceId: string;
  className: string; // 단체수업은 Service 자체가 수업 = service.name
  startMin: number;
};

export type MeCalCell = {
  dayKey: string; // "YYYY-MM-DD"
  day: number;
  weekdayIdx: number; // 0=Sun
  isToday: boolean;
  isPast: boolean;
  isCurrentMonth: boolean; // false = 앞뒤 패딩(다른 달) 칸
  isOpen: boolean; // 매장 영업일 (정기 휴무요일 + 특정 휴무일 반영)
  events: MeCalEvent[]; // 그 날 본인 예약 (시간순)
  groupClasses: MeCalGroupClass[]; // 그 날 열리는 단체수업 (보유 단체권 한정, 시간순)
};

export type MeCalendarMonth = {
  year: number;
  month: number; // 1-12
  cells: MeCalCell[];
};

function dayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export async function loadMeCalendarMonth(
  gymId: string,
  userId: string,
  todayUtcMid: Date,
  year: number,
  month: number, // 1-12
): Promise<MeCalendarMonth> {
  const monthFirst = new Date(Date.UTC(year, month - 1, 1));
  const monthLast = new Date(Date.UTC(year, month, 0));
  // 그리드: 그 달 1일이 속한 주의 일요일 ~ 말일이 속한 주의 토요일.
  const gridStart = new Date(
    monthFirst.getTime() - monthFirst.getUTCDay() * MS_PER_DAY,
  );
  const gridEnd = new Date(
    monthLast.getTime() + (6 - monthLast.getUTCDay()) * MS_PER_DAY,
  );
  const cellCount =
    Math.round((gridEnd.getTime() - gridStart.getTime()) / MS_PER_DAY) + 1;
  const rangeEnd = new Date(gridEnd.getTime() + MS_PER_DAY);

  const [reservations, businessHours, closures, groupPkgs] =
    await Promise.all([
      prisma.reservation.findMany({
        where: {
          gymId,
          customerUserId: userId,
          startAt: { gte: gridStart, lt: rangeEnd },
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
          date: { gte: gridStart, lt: rangeEnd },
          kind: "CLOSED",
        },
        select: { date: true },
      }),
      // 고객이 보유한 잔여 있는 단체권(capacity>1) — 그 서비스의 수업만 마킹.
      prisma.package.findMany({
        where: {
          gymId,
          userId,
          remainingCount: { gt: 0 },
          refundedAt: null, // 환불 동결 권 제외
          service: { capacity: { gt: 1 } },
        },
        select: { serviceId: true },
      }),
    ]);

  // 날짜별 본인 예약 목록 — PT / 단체 구분 + 시각 + 라벨 + 담당 강사.
  const eventsByDay = new Map<string, MeCalEvent[]>();
  for (const r of reservations) {
    const k = dayKey(r.startAt);
    const isGroup =
      r.scheduledClassId !== null || (r.service?.capacity ?? 1) !== 1;
    const arr = eventsByDay.get(k) ?? [];
    arr.push({
      id: r.id,
      kind: isGroup ? "group" : "pt",
      startMin: r.startAt.getUTCHours() * 60 + r.startAt.getUTCMinutes(),
      // 라벨은 항상 실제 등록된 서비스명 — 1:1 이라고 "PT" 로 못박지 않는다
      // (요가 1:1, 헬스 상담 등 1:1 서비스가 여럿).
      label: r.service?.name ?? "서비스",
      staffName: r.staff?.user.name ?? "",
      status: r.status,
      scheduledClassId: r.scheduledClassId,
    });
    eventsByDay.set(k, arr);
  }
  for (const arr of eventsByDay.values()) {
    arr.sort((a, b) => a.startMin - b.startMin);
  }

  // 단체수업 occurrence 전개 — 보유 단체권 서비스의 active schedule 만.
  const groupServiceIds = [
    ...new Set(groupPkgs.map((p) => p.serviceId)),
  ];
  const schedules =
    groupServiceIds.length === 0
      ? []
      : await prisma.scheduledClass.findMany({
          where: {
            gymId,
            active: true,
            serviceId: { in: groupServiceIds },
            validFrom: { lt: rangeEnd },
            OR: [{ validUntil: null }, { validUntil: { gte: gridStart } }],
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

  const groupByDay = new Map<string, MeCalGroupClass[]>();
  if (schedules.length > 0) {
    for (let i = 0; i < cellCount; i++) {
      const d = new Date(gridStart.getTime() + i * MS_PER_DAY);
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

  const openWeekdays = new Set<string>(
    businessHours.map((b) => b.weekday),
  );
  const closedDays = new Set(closures.map((c) => dayKey(c.date)));
  const todayKey = dayKey(todayUtcMid);

  const cells: MeCalCell[] = [];
  for (let i = 0; i < cellCount; i++) {
    const d = new Date(gridStart.getTime() + i * MS_PER_DAY);
    const k = dayKey(d);
    const wd = WEEKDAY_ENUM[d.getUTCDay()]!;
    cells.push({
      dayKey: k,
      day: d.getUTCDate(),
      weekdayIdx: d.getUTCDay(),
      isToday: k === todayKey,
      isPast: k < todayKey,
      isCurrentMonth:
        d.getUTCMonth() + 1 === month && d.getUTCFullYear() === year,
      isOpen: openWeekdays.has(wd) && !closedDays.has(k),
      events: eventsByDay.get(k) ?? [],
      groupClasses: groupByDay.get(k) ?? [],
    });
  }
  return { year, month, cells };
}
