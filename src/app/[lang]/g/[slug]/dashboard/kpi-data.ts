// 사장 dashboard 실데이터 로더 — 오늘 예약/일정, 출근, 활성회원, 출입현황.
// 3개 dashboard variant(Normal/Black/White)가 공통으로 호출. mock 없음.

import { prisma } from "@/lib/db/client";
import { computeStatus } from "@/lib/hours/status";
import { gymTodayUtcMidnight } from "@/lib/calendar/gymTime";
import { DEFAULT_TIME_ZONE } from "@/lib/calendar/timezones";

export type CheckInRow = {
  userId: string;
  name: string;
  checkInMin: number | null; // null = 미출근
  lateMin: number | null; // null = 시간 데이터 없거나 storeOpen 모름
};

// 오늘 예약 타임라인 1줄 — 1:1 은 건별, 단체수업은 회차로 묶음.
export type TimelineItem = {
  id: string;
  startMin: number;
  customer: string; // 1:1=고객명 / 단체=수업명
  staff: string;
  service: string;
  serviceType: "PT" | "GROUP";
  capacity: number | null;
  enrolled: number | null;
  status: string;
};

export type AccessRow = {
  id: string;
  name: string;
  role: string;
  hour: number;
  min: number;
};

export type OwnerKpi = {
  staff: CheckInRow[];
  todayBuckets: { startMin: number; items: TimelineItem[] }[];
  ptCount: number; // 오늘 1:1(PT) 건수
  groupParticipants: number; // 오늘 단체수업 참여 인원
  activeMembers: number; // 유효 회원권 보유 고객 수
  totalCustomers: number; // 누적 고객 수
  accessToday: AccessRow[];
};

const DEAD = ["CANCELLED", "REJECTED"] as const;

export async function getKpiExtras(gymId: string): Promise<OwnerKpi> {
  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );
  const todayLocalStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  // 매장 타임존 기준 오늘의 UTC-naive 범위 — Reservation.startAt 과 동일 기준.
  const biz = await prisma.business.findUnique({
    where: { id: gymId },
    select: { timeZone: true },
  });
  const todayMid = gymTodayUtcMidnight(
    biz?.timeZone ?? DEFAULT_TIME_ZONE,
    now,
  );
  const todayEnd = new Date(todayMid.getTime() + 86400000);

  const [
    businessHours,
    closure,
    staffList,
    accessLogs,
    todayReservations,
    activeMembers,
    totalCustomers,
  ] = await Promise.all([
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
      select: {
        id: true,
        userId: true,
        occurredAt: true,
        user: { select: { name: true, role: true } },
      },
    }),
    prisma.reservation.findMany({
      where: {
        gymId,
        startAt: { gte: todayMid, lt: todayEnd },
        status: { notIn: [...DEAD] },
      },
      select: {
        id: true,
        startAt: true,
        status: true,
        scheduledClassId: true,
        service: { select: { name: true, capacity: true } },
        staff: { select: { user: { select: { name: true } } } },
        customer: { select: { name: true } },
      },
      orderBy: { startAt: "asc" },
    }),
    prisma.user.count({
      where: {
        gymId,
        role: "CUSTOMER",
        memberships: { some: { endDate: { gte: todayMid } } },
      },
    }),
    prisma.user.count({ where: { gymId, role: "CUSTOMER" } }),
  ]);

  // 출근 — 사용자별 첫 출입 시각
  const firstByUser = new Map<string, Date>();
  for (const log of accessLogs) {
    if (!firstByUser.has(log.userId)) {
      firstByUser.set(log.userId, log.occurredAt);
    }
  }
  const status = computeStatus(todayUtc, businessHours, closure ?? null);
  const storeOpenMin = status.state === "OPEN" ? status.openMin : null;

  const staff: CheckInRow[] = staffList.map((s) => {
    const at = firstByUser.get(s.user.id) ?? null;
    let checkInMin: number | null = null;
    let lateMin: number | null = null;
    if (at) {
      checkInMin = at.getHours() * 60 + at.getMinutes();
      if (storeOpenMin != null) lateMin = checkInMin - storeOpenMin;
    }
    return { userId: s.user.id, name: s.user.name, checkInMin, lateMin };
  });
  staff.sort((a, b) => {
    if (a.checkInMin != null && b.checkInMin != null) {
      return a.checkInMin - b.checkInMin;
    }
    if (a.checkInMin != null) return -1;
    if (b.checkInMin != null) return 1;
    return a.name.localeCompare(b.name);
  });

  // 출입현황 — 오늘 통과 기록, 최근순 최대 12건.
  const accessToday: AccessRow[] = accessLogs
    .map((l) => ({
      id: l.id,
      name: l.user?.name ?? "—",
      role: (l.user?.role ?? "CUSTOMER") as string,
      hour: l.occurredAt.getHours(),
      min: l.occurredAt.getMinutes(),
    }))
    .reverse()
    .slice(0, 12);

  // 오늘 예약 — 1:1 은 건별, 단체수업은 (회차+시각)으로 묶어 인원 집계.
  let ptCount = 0;
  let groupParticipants = 0;
  const ptItems: TimelineItem[] = [];
  const groupMap = new Map<string, { item: TimelineItem; count: number }>();
  for (const r of todayReservations) {
    const startMin =
      r.startAt.getUTCHours() * 60 + r.startAt.getUTCMinutes();
    const isGroup =
      r.scheduledClassId != null || (r.service?.capacity ?? 1) > 1;
    if (!isGroup) {
      ptCount++;
      ptItems.push({
        id: r.id,
        startMin,
        customer: r.customer?.name ?? "—",
        staff: r.staff?.user.name ?? "—",
        service: r.service?.name ?? "—",
        serviceType: "PT",
        capacity: null,
        enrolled: null,
        status: r.status === "COMPLETED" ? "COMPLETED" : "CONFIRMED",
      });
    } else {
      groupParticipants++;
      const key = `${r.scheduledClassId ?? r.id}|${startMin}`;
      const ex = groupMap.get(key);
      if (ex) {
        ex.count++;
      } else {
        groupMap.set(key, {
          count: 1,
          item: {
            id: key,
            startMin,
            customer: r.service?.name ?? "—",
            staff: r.staff?.user.name ?? "—",
            service: r.service?.name ?? "—",
            serviceType: "GROUP",
            capacity: r.service?.capacity ?? null,
            enrolled: 0,
            status: "CONFIRMED",
          },
        });
      }
    }
  }
  const items: TimelineItem[] = [
    ...ptItems,
    ...[...groupMap.values()].map((g) => ({
      ...g.item,
      enrolled: g.count,
    })),
  ];
  const bucketMap = new Map<number, TimelineItem[]>();
  for (const it of items) {
    const arr = bucketMap.get(it.startMin) ?? [];
    arr.push(it);
    bucketMap.set(it.startMin, arr);
  }
  const todayBuckets = [...bucketMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([startMin, list]) => ({ startMin, items: list }));

  return {
    staff,
    todayBuckets,
    ptCount,
    groupParticipants,
    activeMembers,
    totalCustomers,
    accessToday,
  };
}

export function fmtCheckIn(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(
    min % 60,
  ).padStart(2, "0")}`;
}
