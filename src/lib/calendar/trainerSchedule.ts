import { prisma } from "@/lib/db/client";
import {
  type MonthInfo,
  type TrainerEvent,
  manilaMonthUtcRange,
  toManilaParts,
} from "./manila";

// 트레이너 본인이 담당하는 예약만 (staffId 필터). 1:1 자유예약 + 본인이
// 담당인 단체수업 예약이 모두 staffId=본인 으로 들어오므로 이 한 필터로
// "단체 전체가 아니라 본인 담당만" 요구가 자동 충족된다.
// staffId 없으면(트레이너 레코드 미생성) 빈 결과.
export async function loadTrainerMonth(
  gymId: string,
  staffId: string | null,
  info: MonthInfo,
): Promise<{
  eventsByDay: Record<number, TrainerEvent[]>;
  closedDays: number[];
}> {
  const { start, end } = manilaMonthUtcRange(info);

  const [reservations, closures] = await Promise.all([
    staffId
      ? prisma.reservation.findMany({
          where: {
            gymId,
            staffId,
            startAt: { gte: start, lt: end },
          },
          select: {
            id: true,
            startAt: true,
            endAt: true,
            status: true,
            scheduledClassId: true,
            service: { select: { name: true, capacity: true } },
            customer: { select: { name: true } },
          },
          orderBy: { startAt: "asc" },
        })
      : Promise.resolve([]),
    prisma.businessClosure.findMany({
      where: { gymId, date: { gte: start, lt: end } },
      select: { date: true },
    }),
  ]);

  // 단체수업 등록 인원 = 같은 scheduledClassId 예약 수 (본인 담당분 기준).
  const enrolledByClass = new Map<string, number>();
  for (const r of reservations) {
    if (r.scheduledClassId) {
      enrolledByClass.set(
        r.scheduledClassId,
        (enrolledByClass.get(r.scheduledClassId) ?? 0) + 1,
      );
    }
  }

  const eventsByDay: Record<number, TrainerEvent[]> = {};
  for (const r of reservations) {
    const s = toManilaParts(r.startAt);
    const e = toManilaParts(r.endAt);
    const isGroup = (r.service?.capacity ?? 1) > 1;
    const evt: TrainerEvent = {
      id: r.id,
      day: s.day,
      startMin: s.minuteOfDay,
      endMin: e.minuteOfDay,
      title: isGroup
        ? (r.service?.name ?? "")
        : (r.customer?.name ?? r.service?.name ?? ""),
      service: r.service?.name ?? "",
      isGroup,
      capacity: isGroup ? (r.service?.capacity ?? null) : null,
      enrolled:
        isGroup && r.scheduledClassId
          ? (enrolledByClass.get(r.scheduledClassId) ?? 1)
          : null,
      status: r.status,
    };
    (eventsByDay[s.day] ??= []).push(evt);
  }

  const closedDays = closures.map((c) => c.date.getUTCDate());

  return { eventsByDay, closedDays };
}
