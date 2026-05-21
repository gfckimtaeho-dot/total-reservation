"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { pickBookablePackage } from "@/lib/packages/availability";
import { gymTodayUtcMidnight } from "@/lib/calendar/gymTime";
import type { Weekday } from "@/generated/prisma/enums";

// 트레이너 dashboard 단체수업 운영. 정책:
//  - 등록: 그 단체수업 서비스의 잔여 단체권(FIFO)이 있어야 함. 잔여는
//    "수업 완료" 시점에 차감(고객 self-join·1:1 예약과 동일 모델).
//  - 취소: status=CANCELLED 만. 잔여 카운트는 손대지 않음 — 미완료 등록은
//    애초에 차감된 적이 없어 복구할 게 없음(+1 하면 무료 1회를 주는 셈).
//  - 이동: 같은 단체수업의 다른 회차로만. 정원/중복/과거 검증.

type R = { ok: true } | { ok: false; error: string };

const WEEKDAY = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
] as const;

const DEAD = ["CANCELLED", "REJECTED"] as const;
const MS_PER_DAY = 24 * 60 * 60 * 1000; // 하루(UTC·Manila 모두 DST 없음 → 고정)

function rev(slug: string) {
  revalidatePath(`/ko/g/${slug}/dashboard`);
  revalidatePath(`/en/g/${slug}/dashboard`);
}

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// schedule.staffId 가 null(강사 미지정)이어도 Reservation.staffId 는 not-null
// 컬럼 — 매장 아무 staff 1명을 폴백(표시용. 정산 로직은 후속).
async function fallbackStaffId(tx: TxClient, gymId: string): Promise<string> {
  const any = await tx.staff.findFirst({
    where: { gymId },
    select: { id: true },
  });
  if (!any) throw new Error("매장에 등록된 트레이너가 없습니다");
  return any.id;
}

// (year,month,day) 가 이 schedule 의 유효 회차인지.
function occurrenceValid(
  sched: {
    kind: string;
    weekdays: Weekday[];
    specificDate: Date | null;
    validFrom: Date;
    validUntil: Date | null;
  },
  year: number,
  month: number,
  day: number,
): boolean {
  const occ = new Date(Date.UTC(year, month - 1, day));
  if (occ < sched.validFrom) return false;
  if (sched.validUntil && occ > sched.validUntil) return false;
  if (sched.kind === "ONE_OFF") {
    if (!sched.specificDate) return false;
    return (
      sched.specificDate.getUTCFullYear() === year &&
      sched.specificDate.getUTCMonth() + 1 === month &&
      sched.specificDate.getUTCDate() === day
    );
  }
  return sched.weekdays.includes(WEEKDAY[occ.getUTCDay()] as Weekday);
}

// 트레이너가 고객을 단체수업 1회차에 등록.
export async function registerGroupClass(input: {
  slug: string;
  scheduleId: string;
  customerUserId: string;
  year: number;
  month: number;
  day: number;
}): Promise<R> {
  const auth = await requireGymStaff(input.slug);
  const gymId = auth.business!.id;

  const sched = await prisma.scheduledClass.findFirst({
    where: { id: input.scheduleId, gymId },
    include: {
      service: {
        select: { capacity: true, durationMin: true, deductCount: true },
      },
    },
  });
  if (!sched) return { ok: false, error: "단체 수업을 찾을 수 없습니다" };
  if (!sched.active)
    return { ok: false, error: "운영 중지된 단체 수업입니다" };
  if (sched.service.capacity <= 1)
    return { ok: false, error: "단체 수업이 아닙니다" };
  if (!occurrenceValid(sched, input.year, input.month, input.day))
    return { ok: false, error: "그 날짜에 열리지 않는 수업입니다" };

  const h = Math.floor(sched.startMinute / 60);
  const m = sched.startMinute % 60;
  const startAt = new Date(
    Date.UTC(input.year, input.month - 1, input.day, h, m, 0),
  );
  const endAt = new Date(
    startAt.getTime() + sched.service.durationMin * 60000,
  );
  if (startAt.getTime() < Date.now())
    return { ok: false, error: "지난 수업에는 등록할 수 없습니다" };

  const cust = await prisma.user.findFirst({
    where: { id: input.customerUserId, gymId, role: "CUSTOMER" },
    select: { id: true },
  });
  if (!cust) return { ok: false, error: "고객을 찾을 수 없습니다" };

  const dayStart = new Date(
    Date.UTC(input.year, input.month - 1, input.day),
  );
  const dayEnd = new Date(dayStart.getTime() + MS_PER_DAY);

  const enrolled = await prisma.reservation.count({
    where: {
      gymId,
      scheduledClassId: sched.id,
      status: { notIn: [...DEAD] },
      startAt: { gte: dayStart, lt: dayEnd },
    },
  });
  if (enrolled >= sched.service.capacity)
    return { ok: false, error: "정원이 찼습니다" };

  const dup = await prisma.reservation.findFirst({
    where: {
      gymId,
      customerUserId: cust.id,
      scheduledClassId: sched.id,
      status: { notIn: [...DEAD] },
      startAt: { gte: dayStart, lt: dayEnd },
    },
    select: { id: true },
  });
  if (dup) return { ok: false, error: "이미 등록된 고객입니다" };

  // 그 서비스의 잔여 단체권 FIFO 1장 — 잔여는 있으나 미완료 예약으로
  // 모두 선점된 권은 건너뛴다(초과 예약 차단).
  const pkg = await pickBookablePackage(
    gymId,
    cust.id,
    sched.serviceId,
    sched.service.deductCount,
  );
  if (!pkg)
    return {
      ok: false,
      error: "이 수업으로 더 예약할 잔여 횟수가 없습니다. 먼저 발급해 주세요.",
    };

  await prisma.$transaction(async (tx) => {
    const r = await tx.reservation.create({
      data: {
        gymId,
        serviceId: sched.serviceId,
        staffId: sched.staffId ?? (await fallbackStaffId(tx, gymId)),
        customerUserId: cust.id,
        startAt,
        endAt,
        status: "CONFIRMED",
        packageId: pkg.id,
        scheduledClassId: sched.id,
      },
      select: { id: true },
    });
    await tx.reservationLog.create({
      data: {
        gymId,
        reservationId: r.id,
        action: "CREATED",
        actorUserId: auth.id,
      },
    });
  });

  rev(input.slug);
  return { ok: true };
}

// 단체수업 등록 취소(수강생 1명). 잔여 카운트 불변.
export async function cancelGroupEnrollment(input: {
  slug: string;
  reservationId: string;
}): Promise<R> {
  const auth = await requireGymStaff(input.slug);
  const gymId = auth.business!.id;

  const res = await prisma.reservation.findFirst({
    where: { id: input.reservationId, gymId },
    select: {
      id: true,
      scheduledClassId: true,
      status: true,
      startAt: true,
    },
  });
  if (!res) return { ok: false, error: "예약을 찾을 수 없습니다" };
  if (!res.scheduledClassId)
    return { ok: false, error: "단체 수업 등록이 아닙니다" };
  if ((DEAD as readonly string[]).includes(res.status))
    return { ok: false, error: "이미 취소된 등록입니다" };
  if (res.status === "COMPLETED")
    return { ok: false, error: "완료된 수업은 취소할 수 없습니다" };
  if (res.startAt.getTime() < Date.now())
    return { ok: false, error: "지난 수업은 취소할 수 없습니다" };

  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id: res.id },
      data: { status: "CANCELLED" },
    });
    await tx.reservationLog.create({
      data: {
        gymId,
        reservationId: res.id,
        action: "CANCELLED_BY_STAFF",
        actorUserId: auth.id,
      },
    });
  });

  rev(input.slug);
  return { ok: true };
}

// 단체수업 수강생 1명을 같은 수업의 다른 회차로 이동.
export async function moveGroupEnrollment(input: {
  slug: string;
  reservationId: string;
  year: number;
  month: number;
  day: number;
}): Promise<R> {
  const auth = await requireGymStaff(input.slug);
  const gymId = auth.business!.id;

  const res = await prisma.reservation.findFirst({
    where: { id: input.reservationId, gymId },
    select: {
      id: true,
      scheduledClassId: true,
      status: true,
      startAt: true,
      customerUserId: true,
    },
  });
  if (!res) return { ok: false, error: "예약을 찾을 수 없습니다" };
  if (!res.scheduledClassId)
    return { ok: false, error: "단체 수업 등록이 아닙니다" };
  if (
    (
      ["CANCELLED", "REJECTED", "COMPLETED", "NO_SHOW"] as readonly string[]
    ).includes(res.status)
  )
    return { ok: false, error: "이동할 수 없는 등록입니다" };
  if (res.startAt.getTime() < Date.now())
    return { ok: false, error: "지난 수업은 이동할 수 없습니다" };

  const sched = await prisma.scheduledClass.findFirst({
    where: { id: res.scheduledClassId, gymId },
    include: {
      service: { select: { capacity: true, durationMin: true } },
    },
  });
  if (!sched) return { ok: false, error: "단체 수업을 찾을 수 없습니다" };
  if (!occurrenceValid(sched, input.year, input.month, input.day))
    return { ok: false, error: "그 날짜에 열리지 않는 수업입니다" };

  const h = Math.floor(sched.startMinute / 60);
  const m = sched.startMinute % 60;
  const newStart = new Date(
    Date.UTC(input.year, input.month - 1, input.day, h, m, 0),
  );
  const newEnd = new Date(
    newStart.getTime() + sched.service.durationMin * 60000,
  );
  if (newStart.getTime() < Date.now())
    return { ok: false, error: "지난 시간으로는 이동할 수 없습니다" };
  if (newStart.getTime() === res.startAt.getTime())
    return { ok: false, error: "같은 회차입니다" };

  const dayStart = new Date(
    Date.UTC(input.year, input.month - 1, input.day),
  );
  const dayEnd = new Date(dayStart.getTime() + MS_PER_DAY);

  // 대상 회차 정원(본인 제외).
  const enrolled = await prisma.reservation.count({
    where: {
      gymId,
      scheduledClassId: sched.id,
      id: { not: res.id },
      status: { notIn: [...DEAD] },
      startAt: { gte: dayStart, lt: dayEnd },
    },
  });
  if (enrolled >= sched.service.capacity)
    return { ok: false, error: "그 회차는 정원이 찼습니다" };

  // 그 고객이 대상 회차에 이미 등록돼 있나.
  const dup = await prisma.reservation.findFirst({
    where: {
      gymId,
      customerUserId: res.customerUserId,
      scheduledClassId: sched.id,
      id: { not: res.id },
      status: { notIn: [...DEAD] },
      startAt: { gte: dayStart, lt: dayEnd },
    },
    select: { id: true },
  });
  if (dup) return { ok: false, error: "그 날 이미 등록돼 있습니다" };

  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id: res.id },
      data: { startAt: newStart, endAt: newEnd },
    });
    await tx.reservationLog.create({
      data: {
        gymId,
        reservationId: res.id,
        action: "CHANGED_BY_STAFF",
        actorUserId: auth.id,
      },
    });
  });

  rev(input.slug);
  return { ok: true };
}

// 단체수업 회차 출석 완료 — 체크된 수강생들의 예약을 COMPLETED 로.
// 완료 시 각 수강생의 단체권에서 service.deductCount 만큼 차감(PT·1:1 과
// 동일 모델). 멱등 — 이미 완료/취소된 건 건너뜀(중복 차감 방지).
export async function completeGroupEnrollments(input: {
  slug: string;
  reservationIds: string[];
}): Promise<R> {
  const auth = await requireGymStaff(input.slug);
  const gymId = auth.business!.id;
  if (input.reservationIds.length === 0) {
    return { ok: false, error: "완료할 수강생을 선택해 주세요" };
  }

  // 완료는 당일 회차만 — 미래·과거는 완료 처리 불가.
  // Manila 기준 오늘 — new Date() UTC 파츠는 16:00 UTC 이후 하루 밀린다.
  const todayMid = gymTodayUtcMidnight(auth.business!.timeZone);
  const todayEnd = new Date(todayMid.getTime() + MS_PER_DAY);

  await prisma.$transaction(async (tx) => {
    for (const id of input.reservationIds) {
      const res = await tx.reservation.findFirst({
        where: { id, gymId },
        select: {
          id: true,
          status: true,
          startAt: true,
          scheduledClassId: true,
          serviceId: true,
          packageId: true,
        },
      });
      if (!res || !res.scheduledClassId) continue;
      if ((DEAD as readonly string[]).includes(res.status)) continue;
      if (res.status === "COMPLETED") continue;
      if (res.startAt < todayMid || res.startAt >= todayEnd) continue;

      await tx.reservation.update({
        where: { id: res.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      // 연결된 단체권에서 차감 — totalCount 불변, 잔여만 ↓.
      if (res.packageId) {
        const svc = await tx.service.findUnique({
          where: { id: res.serviceId },
          select: { deductCount: true },
        });
        const pkg = await tx.package.findUnique({
          where: { id: res.packageId },
          select: { remainingCount: true },
        });
        if (pkg) {
          const deduct = svc?.deductCount ?? 1;
          const next = Math.max(0, pkg.remainingCount - deduct);
          await tx.package.update({
            where: { id: res.packageId },
            data: { remainingCount: next },
          });
        }
      }
      await tx.reservationLog.create({
        data: {
          gymId,
          reservationId: res.id,
          action: "COMPLETED",
          actorUserId: auth.id,
        },
      });
    }
  });

  rev(input.slug);
  return { ok: true };
}

// 단체수업 완료 취소(당일 한정) — 실수로 완료한 수강생 1명을 되돌림.
// status COMPLETED → CONFIRMED, 차감했던 권 1회분 환불(totalCount 초과 금지).
export async function uncompleteGroupEnrollment(input: {
  slug: string;
  reservationId: string;
}): Promise<R> {
  const auth = await requireGymStaff(input.slug);
  const gymId = auth.business!.id;

  const res = await prisma.reservation.findFirst({
    where: { id: input.reservationId, gymId },
    select: {
      id: true,
      status: true,
      startAt: true,
      scheduledClassId: true,
      serviceId: true,
      packageId: true,
    },
  });
  if (!res) return { ok: false, error: "예약을 찾을 수 없습니다" };
  if (!res.scheduledClassId)
    return { ok: false, error: "단체 수업 등록이 아닙니다" };
  if (res.status !== "COMPLETED")
    return { ok: false, error: "완료된 등록이 아닙니다" };

  // Manila 기준 오늘 — new Date() UTC 파츠는 16:00 UTC 이후 하루 밀린다.
  const todayMid = gymTodayUtcMidnight(auth.business!.timeZone);
  const todayEnd = new Date(todayMid.getTime() + MS_PER_DAY);
  if (res.startAt < todayMid || res.startAt >= todayEnd) {
    return { ok: false, error: "당일 수업만 완료를 취소할 수 있습니다" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id: res.id },
      data: { status: "CONFIRMED", completedAt: null },
    });
    // 완료 시 차감했던 만큼 환불 — 원본 totalCount 초과 금지.
    if (res.packageId) {
      const svc = await tx.service.findUnique({
        where: { id: res.serviceId },
        select: { deductCount: true },
      });
      const pkg = await tx.package.findUnique({
        where: { id: res.packageId },
        select: { remainingCount: true, totalCount: true },
      });
      if (pkg) {
        const deduct = svc?.deductCount ?? 1;
        const next = Math.min(
          pkg.totalCount,
          pkg.remainingCount + deduct,
        );
        await tx.package.update({
          where: { id: res.packageId },
          data: { remainingCount: next },
        });
      }
    }
    await tx.reservationLog.create({
      data: {
        gymId,
        reservationId: res.id,
        action: "CHANGED_BY_STAFF",
        actorUserId: auth.id,
      },
    });
  });

  rev(input.slug);
  return { ok: true };
}
