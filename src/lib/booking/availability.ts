// 예약 가능 시간 슬롯 계산.
// 매장 영업시간 (BusinessHours + BusinessClosure)
//   ∩ 트레이너 출근일 (Staff.weeklyOffDays / StaffLeave)
//   ∩ 트레이너 근무시간 (Staff.workStartMin / workEndMin)
//   ∖ 매장 휴게시간
//   ∖ 트레이너 개인 휴게 (Staff.breakStartMin / breakEndMin)
//   ∖ 기존 예약 (Reservation, 그 트레이너의 같은 날)
//
// 2026-05-27 결정 — 단체수업 schedule 검사([[decision_class_deletion_refund_flow]]
// 이 아닌 staff availability)와 정책 정렬. 트레이너별 정기 근무시간·개인 휴게가
// 매장 시간과 다를 수 있다면 그것을 우선. 2026-05-11 결정("트레이너는 매장 시간
// 그대로 따른다")은 명시 폐기.

import { prisma } from "@/lib/db/client";
import { computeStatus, weekdayOf, ymd } from "@/lib/hours/status";
import type { Weekday } from "@/generated/prisma/enums";

export type Slot = { startMin: number; endMin: number };

export type Availability =
  | { state: "OPEN"; slots: Slot[]; openMin: number; closeMin: number }
  | { state: "STORE_CLOSED"; reason: string | null }
  | { state: "TRAINER_OFF"; reason: "WEEKLY_OFF" | "ON_LEAVE"; leaveReason: string | null };

// 영업 윈도우에서 휴게시간을 빼고, durationMin step으로 슬라이딩.
function slidingSlots(
  windows: Slot[],
  durationMin: number,
  stepMin: number,
): Slot[] {
  const out: Slot[] = [];
  for (const win of windows) {
    let t = win.startMin;
    while (t + durationMin <= win.endMin) {
      out.push({ startMin: t, endMin: t + durationMin });
      t += stepMin;
    }
  }
  return out;
}

// [a,b)와 [c,d) 겹치는지
function overlaps(a: number, b: number, c: number, d: number): boolean {
  return a < d && c < b;
}

// open~close 영역에서 breaks 영역 제거 → 영업 윈도우들
function applyBreaks(
  openMin: number,
  closeMin: number,
  breaks: Slot[],
): Slot[] {
  let windows: Slot[] = [{ startMin: openMin, endMin: closeMin }];
  for (const br of breaks) {
    const next: Slot[] = [];
    for (const w of windows) {
      if (!overlaps(w.startMin, w.endMin, br.startMin, br.endMin)) {
        next.push(w);
        continue;
      }
      if (w.startMin < br.startMin) {
        next.push({ startMin: w.startMin, endMin: Math.min(w.endMin, br.startMin) });
      }
      if (br.endMin < w.endMin) {
        next.push({ startMin: Math.max(w.startMin, br.endMin), endMin: w.endMin });
      }
    }
    windows = next;
  }
  return windows;
}

export async function getAvailability(args: {
  gymId: string;
  staffId: string;
  serviceId: string;
  date: Date; // 해당 날짜 (UTC 자정 기준 권장)
}): Promise<Availability> {
  const { gymId, staffId, serviceId, date } = args;

  const dateUtc = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

  // 그날 00:00~24:00 reservation 범위
  const dayStart = new Date(dateUtc);
  const dayEnd = new Date(dateUtc);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const [hours, closure, staff, service, leaves, existing] = await Promise.all([
    prisma.businessHours.findMany({ where: { gymId } }),
    prisma.businessClosure.findUnique({
      where: { gymId_date: { gymId, date: dateUtc } },
    }),
    prisma.staff.findUnique({
      where: { id: staffId },
      select: {
        id: true,
        weeklyOffDays: true,
        workStartMin: true,
        workEndMin: true,
        breakStartMin: true,
        breakEndMin: true,
      },
    }),
    prisma.service.findUnique({
      where: { id: serviceId },
      select: { durationMin: true, timeUnit: true },
    }),
    prisma.staffLeave.findMany({
      where: {
        staffId,
        startDate: { lte: dateUtc },
        endDate: { gte: dateUtc },
      },
      select: { reason: true },
    }),
    prisma.reservation.findMany({
      where: {
        gymId,
        staffId,
        startAt: { gte: dayStart, lt: dayEnd },
        status: { in: ["PENDING_PAYMENT", "CONFIRMED"] },
      },
      select: { startAt: true, endAt: true },
    }),
  ]);

  if (!staff || !service) {
    return { state: "STORE_CLOSED", reason: null };
  }

  // 매장 상태
  const storeStatus = computeStatus(dateUtc, hours, closure ?? null);
  if (storeStatus.state !== "OPEN") {
    const reason =
      storeStatus.state === "CLOSED_DAY" ? storeStatus.reason : null;
    return { state: "STORE_CLOSED", reason };
  }

  // 트레이너 휴가
  if (leaves.length > 0) {
    return {
      state: "TRAINER_OFF",
      reason: "ON_LEAVE",
      leaveReason: leaves[0].reason ?? null,
    };
  }

  // 트레이너 주간 휴무
  const wd: Weekday = weekdayOf(dateUtc);
  if (staff.weeklyOffDays.includes(wd)) {
    return { state: "TRAINER_OFF", reason: "WEEKLY_OFF", leaveReason: null };
  }

  const { openMin, closeMin, breakStartMin, breakEndMin } = storeStatus;

  // 트레이너 근무시간 ∩ 매장 영업시간 — workStartMin/EndMin 이 null 이면 매장 시간 그대로.
  const effectiveOpen = Math.max(openMin, staff.workStartMin ?? openMin);
  const effectiveClose = Math.min(closeMin, staff.workEndMin ?? closeMin);
  if (effectiveOpen >= effectiveClose) {
    // 트레이너 근무시간이 매장 영업시간과 겹치지 않음 → 사실상 그 날 출근 불가.
    return { state: "TRAINER_OFF", reason: "WEEKLY_OFF", leaveReason: null };
  }

  const breaks: Slot[] = [];
  if (breakStartMin != null && breakEndMin != null) {
    breaks.push({ startMin: breakStartMin, endMin: breakEndMin });
  }
  // 트레이너 개인 휴게 (매장 휴게와 별개)
  if (staff.breakStartMin != null && staff.breakEndMin != null) {
    breaks.push({
      startMin: staff.breakStartMin,
      endMin: staff.breakEndMin,
    });
  }
  // 기존 예약도 break처럼 처리
  for (const r of existing) {
    const s = r.startAt.getHours() * 60 + r.startAt.getMinutes();
    const e = r.endAt.getHours() * 60 + r.endAt.getMinutes();
    breaks.push({ startMin: s, endMin: e });
  }

  const windows = applyBreaks(effectiveOpen, effectiveClose, breaks);
  const step = service.timeUnit === "M30" ? 30 : 60;
  const slots = slidingSlots(windows, service.durationMin, step);

  return { state: "OPEN", slots, openMin: effectiveOpen, closeMin: effectiveClose };
}

export const __test__ = { applyBreaks, slidingSlots, overlaps };

// 보조: 사람이 읽는 시간 표현 — 캘린더/예약 화면 공용
export function fmtSlot(s: Slot): string {
  const fm = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return `${fm(s.startMin)} ~ ${fm(s.endMin)}`;
}

// ymd re-export (M6 예약 화면에서 날짜 비교용)
export { ymd };
