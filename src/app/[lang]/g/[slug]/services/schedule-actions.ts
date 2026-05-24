"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import type { Weekday } from "@/generated/prisma/enums";
import { packageStoreLiabilityRefund } from "@/lib/refunds/store-liability";

const weekdayZ = z.enum(["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]);
const dateZ = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateFormat");
const timeZ = z.string().regex(/^\d{1,2}:\d{2}$/, "startTime");

function parseTime(s: string): number | null {
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function parseYmd(s: string): Date | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return dt;
}

const recurringSchema = z.object({
  slug: z.string().min(1),
  serviceId: z.string().min(1),
  // 담당 트레이너 필수 — 미지정 단체수업은 운영상 책임자가 없어 금지.
  staffId: z.string().min(1, "staffRequired"),
  kind: z.literal("RECURRING"),
  weekdays: z.array(weekdayZ).min(1, "weekdays"),
  startTime: timeZ,
  validFrom: dateZ,
  validUntil: dateZ.optional().nullable(),
  note: z.string().max(120).optional().nullable(),
});

const oneOffSchema = z.object({
  slug: z.string().min(1),
  serviceId: z.string().min(1),
  // 담당 트레이너 필수 — 미지정 단체수업은 운영상 책임자가 없어 금지.
  staffId: z.string().min(1, "staffRequired"),
  kind: z.literal("ONE_OFF"),
  specificDate: dateZ,
  startTime: timeZ,
  note: z.string().max(120).optional().nullable(),
});

const createSchema = z.discriminatedUnion("kind", [
  recurringSchema,
  oneOffSchema,
]);

export type CreateScheduleState = {
  errors?: Record<string, string[] | undefined>;
  ok?: boolean;
  at?: number;
};

export async function createSchedule(
  _prev: CreateScheduleState,
  formData: FormData,
): Promise<CreateScheduleState> {
  const weekdays = formData
    .getAll("weekdays")
    .map((v) => String(v))
    .filter(Boolean);

  const parsed = createSchema.safeParse({
    slug: formData.get("slug"),
    serviceId: formData.get("serviceId"),
    staffId: (formData.get("staffId") as string) || "",
    kind: formData.get("kind"),
    weekdays,
    specificDate: (formData.get("specificDate") as string) || undefined,
    startTime: formData.get("startTime"),
    validFrom: (formData.get("validFrom") as string) || undefined,
    validUntil: (formData.get("validUntil") as string) || null,
    note: (formData.get("note") as string) || null,
  });
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  }
  const data = parsed.data;

  const startMin = parseTime(data.startTime);
  if (startMin == null) {
    return { errors: { startTime: ["startTime"] } };
  }

  const auth = await requireGymStaff(data.slug);
  if (auth.role !== "OWNER" && auth.role !== "MANAGER") {
    return { errors: { _global: ["permission"] } };
  }
  const gymId = auth.business!.id;

  const service = await prisma.service.findUnique({
    where: { id: data.serviceId },
  });
  if (!service || service.gymId !== gymId) {
    return { errors: { _global: ["permission"] } };
  }
  if (service.capacity < 2) {
    return { errors: { _global: ["notGroup"] } };
  }

  if (startMin + service.durationMin > 1440) {
    return { errors: { startTime: ["overflowMidnight"] } };
  }

  const staff = await prisma.staff.findUnique({
    where: { id: data.staffId },
  });
  if (!staff || staff.gymId !== gymId) {
    return { errors: { staffId: ["permission"] } };
  }

  if (data.kind === "RECURRING") {
    const from = parseYmd(data.validFrom);
    if (!from) return { errors: { validFrom: ["dateFormat"] } };
    let until: Date | null = null;
    if (data.validUntil) {
      until = parseYmd(data.validUntil);
      if (!until) return { errors: { validUntil: ["dateFormat"] } };
      if (until < from) {
        return { errors: { validUntil: ["untilBeforeFrom"] } };
      }
    }

    await prisma.scheduledClass.create({
      data: {
        gymId,
        serviceId: data.serviceId,
        staffId: data.staffId,
        kind: "RECURRING",
        weekdays: data.weekdays as Weekday[],
        specificDate: null,
        startMinute: startMin,
        validFrom: from,
        validUntil: until,
        active: true,
        note: data.note || null,
      },
    });
  } else {
    // ONE_OFF
    const date = parseYmd(data.specificDate);
    if (!date) return { errors: { specificDate: ["dateFormat"] } };

    await prisma.scheduledClass.create({
      data: {
        gymId,
        serviceId: data.serviceId,
        staffId: data.staffId,
        kind: "ONE_OFF",
        weekdays: [],
        specificDate: date,
        startMinute: startMin,
        validFrom: date,
        validUntil: null,
        active: true,
        note: data.note || null,
      },
    });
  }

  revalidatePath(`/ko/g/${data.slug}/services`);
  revalidatePath(`/en/g/${data.slug}/services`);
  return { ok: true, at: Date.now() };
}

// ─── 단체수업 삭제 영향 검사 ─────────────────────────────────
//
// 미래 예약 + 잔여 권 보유 회원을 합쳐 사장에게 미리 보여줌. 같은 service에
// 운영 중인 다른 ScheduledClass 개수도 같이 — 다른 시간대가 있으면 회원은
// 그 쪽으로 흡수 가능하니 자동 환불이 과할 수 있어 사장이 선택.
//
// 회차 차감은 "완료" 시점이라(reservation-actions.ts:completeReservation),
// 미래 예약을 취소해도 권 회차 복구가 별도로 필요 없음. 환불은 단순히
// 잔여 회수 × 회당가 × 100%.

export type AffectedMember = {
  packageId: string;
  customerUserId: string;
  customerName: string;
  remainingCount: number;
  paidPhp: number;
  totalCount: number;
  refundPhp: number;
  refundUnits: number;
};

export type ScheduleDeletionImpact =
  | { ok: false; error: "permission" }
  | {
      ok: true;
      serviceId: string;
      serviceName: string;
      // 같은 service에 운영 중(active=true)인 다른 ScheduledClass 개수.
      otherActiveSchedulesCount: number;
      futureReservationsCount: number;
      affectedMembers: AffectedMember[];
      totalRefundPhp: number;
    };

export async function previewScheduleDeletionImpact(
  slug: string,
  scheduleId: string,
): Promise<ScheduleDeletionImpact> {
  const auth = await requireGymStaff(slug);
  if (auth.role !== "OWNER" && auth.role !== "MANAGER") {
    return { ok: false, error: "permission" };
  }
  const gymId = auth.business!.id;

  const sched = await prisma.scheduledClass.findUnique({
    where: { id: scheduleId },
    select: {
      id: true,
      gymId: true,
      serviceId: true,
      service: { select: { name: true, capacity: true } },
    },
  });
  if (!sched || sched.gymId !== gymId) {
    return { ok: false, error: "permission" };
  }

  const [otherActiveSchedulesCount, futureReservationsCount, packages] =
    await Promise.all([
      prisma.scheduledClass.count({
        where: {
          gymId,
          serviceId: sched.serviceId,
          active: true,
          id: { not: scheduleId },
        },
      }),
      prisma.reservation.count({
        where: {
          scheduledClassId: scheduleId,
          status: { in: ["PENDING_PAYMENT", "CONFIRMED"] },
          endAt: { gte: new Date() },
        },
      }),
      prisma.package.findMany({
        where: {
          gymId,
          serviceId: sched.serviceId,
          remainingCount: { gt: 0 },
          refundedAt: null,
        },
        select: {
          id: true,
          userId: true,
          pricePhp: true,
          totalCount: true,
          remainingCount: true,
          user: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

  const affectedMembers: AffectedMember[] = packages.map((p) => {
    const calc = packageStoreLiabilityRefund({
      pricePhp: p.pricePhp,
      totalCount: p.totalCount,
      remainingCount: p.remainingCount,
    });
    return {
      packageId: p.id,
      customerUserId: p.userId,
      customerName: p.user.name,
      remainingCount: p.remainingCount,
      paidPhp: p.pricePhp,
      totalCount: p.totalCount,
      refundPhp: calc.refundPhp,
      refundUnits: calc.refundUnits,
    };
  });

  const totalRefundPhp = affectedMembers.reduce(
    (sum, m) => sum + m.refundPhp,
    0,
  );

  return {
    ok: true,
    serviceId: sched.serviceId,
    serviceName: sched.service.name,
    otherActiveSchedulesCount,
    futureReservationsCount,
    affectedMembers,
    totalRefundPhp,
  };
}

// ─── 단체수업 삭제 적용 ─────────────────────────────────────
//
// 영향 회원이 있으면 RefundRequest(PENDING) 자동 생성 + 각 권 refundedAt 동결.
// 미래 예약은 항상 자동 취소. 스케줄은 hard delete 대신 active=false soft delete —
// 과거 Reservation 의 클래스 참조 + 매출/실적 리포트 역사 보존. 캘린더 표시에서는
// active=false 필터.

export async function applyScheduleDeletion(input: {
  slug: string;
  scheduleId: string;
}): Promise<{ ok?: boolean; error?: string; refundCount?: number }> {
  const auth = await requireGymStaff(input.slug);
  if (auth.role !== "OWNER" && auth.role !== "MANAGER") {
    return { error: "permission" };
  }
  const gymId = auth.business!.id;

  const impact = await previewScheduleDeletionImpact(
    input.slug,
    input.scheduleId,
  );
  if (!impact.ok) return { error: impact.error };

  await prisma.$transaction(async (tx) => {
    // 1) 미래 예약 자동 취소 + 로그.
    const futureResv = await tx.reservation.findMany({
      where: {
        scheduledClassId: input.scheduleId,
        status: { in: ["PENDING_PAYMENT", "CONFIRMED"] },
        endAt: { gte: new Date() },
      },
      select: { id: true, customerUserId: true },
    });
    if (futureResv.length > 0) {
      await tx.reservation.updateMany({
        where: { id: { in: futureResv.map((r) => r.id) } },
        data: { status: "CANCELLED" },
      });
      await tx.reservationLog.createMany({
        data: futureResv.map((r) => ({
          gymId,
          reservationId: r.id,
          action: "CANCELLED_BY_CUSTOMER" as const,
          actorUserId: r.customerUserId,
        })),
      });
    }

    // 2) 영향 회원이 있으면 — 전원에게 RefundRequest 생성 + 권 동결.
    if (impact.affectedMembers.length > 0) {
      for (const m of impact.affectedMembers) {
        await tx.refundRequest.create({
          data: {
            gymId,
            userId: m.customerUserId,
            kind: "PACKAGE",
            packageId: m.packageId,
            serviceName: impact.serviceName,
            trainerName: null,
            paidPhp: m.paidPhp,
            refundPhp: m.refundPhp,
            totalUnits: m.totalCount,
            completedUnits: m.totalCount - m.remainingCount,
            todayUnits: 0,
            refundUnits: m.refundUnits,
            payoutMethod: "IN_PERSON",
            reason: "CLASS_DISCONTINUED",
          },
        });
        await tx.package.update({
          where: { id: m.packageId },
          data: { refundedAt: new Date() },
        });
      }
    }

    // 3) 스케줄 soft delete.
    await tx.scheduledClass.update({
      where: { id: input.scheduleId },
      data: { active: false },
    });
  });

  revalidatePath(`/ko/g/${input.slug}/services`);
  revalidatePath(`/en/g/${input.slug}/services`);
  revalidatePath(`/ko/g/${input.slug}/refunds`);
  revalidatePath(`/en/g/${input.slug}/refunds`);
  return {
    ok: true,
    refundCount: impact.affectedMembers.length,
  };
}

// 구 deleteSchedule 시그니처 호환 — 영향 검사 + 자동 환불 옵션을 모르는
// 호출부가 있을 수 있어 유지. UI 신규는 previewScheduleDeletionImpact +
// applyScheduleDeletion 쌍을 직접 호출.
export async function deleteSchedule(
  slug: string,
  scheduleId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const impact = await previewScheduleDeletionImpact(slug, scheduleId);
  if (!impact.ok) return { error: impact.error };
  if (
    impact.affectedMembers.length > 0 ||
    impact.futureReservationsCount > 0
  ) {
    return { error: "hasImpact" };
  }
  const r = await applyScheduleDeletion({ slug, scheduleId });
  return r;
}
