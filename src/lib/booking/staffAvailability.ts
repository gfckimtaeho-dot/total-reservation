// 트레이너 정기 가용성 검사. 단체수업 schedule 등록 + 1:1 PT availability 양쪽에서
// 같은 룰을 적용하려고 헬퍼로 분리. 매장 영업시간·기존 예약·특정 휴가(StaffLeave) 는
// 호출자가 별도로 본다 — 이 함수는 트레이너 정기 데이터(주간 휴무·근무시간·개인 휴게)만.

import type { Weekday } from "@/generated/prisma/enums";

export type StaffAvailabilityStaff = {
  weeklyOffDays: Weekday[];
  workStartMin: number | null;
  workEndMin: number | null;
  breakStartMin: number | null;
  breakEndMin: number | null;
};

export type StaffAvailabilityReason =
  | "staffWeeklyOff"
  | "outsideWorkingHours"
  | "staffBreakConflict";

export type StaffAvailabilityResult =
  | { ok: true }
  | { ok: false; reason: StaffAvailabilityReason };

export function checkStaffAvailability(input: {
  weekday: Weekday;
  startMin: number;
  endMin: number;
  staff: StaffAvailabilityStaff;
}): StaffAvailabilityResult {
  const { weekday, startMin, endMin, staff } = input;

  if (staff.weeklyOffDays.includes(weekday)) {
    return { ok: false, reason: "staffWeeklyOff" };
  }

  if (staff.workStartMin != null && startMin < staff.workStartMin) {
    return { ok: false, reason: "outsideWorkingHours" };
  }
  if (staff.workEndMin != null && endMin > staff.workEndMin) {
    return { ok: false, reason: "outsideWorkingHours" };
  }

  if (staff.breakStartMin != null && staff.breakEndMin != null) {
    // 슬롯 [startMin, endMin) 과 휴게 [breakStart, breakEnd) 가 겹치면 거부.
    if (startMin < staff.breakEndMin && endMin > staff.breakStartMin) {
      return { ok: false, reason: "staffBreakConflict" };
    }
  }

  return { ok: true };
}

const WEEKDAYS: Weekday[] = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
];

export function weekdayOfUtcDate(d: Date): Weekday {
  return WEEKDAYS[d.getUTCDay()]!;
}
