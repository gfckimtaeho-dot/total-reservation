"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import type { TimeUnit } from "@/generated/prisma/enums";
import { packageStoreLiabilityRefund } from "@/lib/refunds/store-liability";

// 숫자 input은 모두 type="text" + 콤마 포맷팅 ("5,000")으로 들어오므로
// 콤마 제거 후 정수 변환. 빈 문자열은 0으로.
const intWithCommas = z.preprocess((v) => {
  if (typeof v !== "string") return v;
  const cleaned = v.replace(/,/g, "").trim();
  if (cleaned === "") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}, z.number().int());

const schema = z.object({
  slug: z.string().min(1),
  type: z.enum(["personal", "group"]),
  name: z.string().trim().min(1, "name").max(60),
  durationMin: intWithCommas.pipe(z.number().int().min(5).max(480)),
  capacity: intWithCommas.pipe(z.number().int().min(1).max(100)),
  pricePhp: intWithCommas.pipe(z.number().int().min(0)),
  payoutPhp: intWithCommas.pipe(z.number().int().min(0)),
});

export type CreateServiceState = {
  errors?: Record<string, string[] | undefined>;
  ok?: boolean;
  at?: number;
};

export async function createService(
  _prev: CreateServiceState,
  formData: FormData,
): Promise<CreateServiceState> {
  const parsed = schema.safeParse({
    slug: formData.get("slug"),
    type: formData.get("type"),
    name: formData.get("name"),
    durationMin: formData.get("durationMin"),
    capacity: formData.get("capacity") || "1",
    pricePhp: formData.get("pricePhp") || "0",
    payoutPhp: formData.get("payoutPhp") || "0",
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

  const fieldErrors: Record<string, string[]> = {};
  if (data.type === "group" && data.capacity < 2) {
    fieldErrors.capacity = ["capacity"];
  }
  if (data.payoutPhp > data.pricePhp) {
    fieldErrors.payoutPhp = ["payoutOverPrice"];
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { errors: fieldErrors };
  }

  const auth = await requireGymStaff(data.slug);
  if (auth.role !== "OWNER" && auth.role !== "MANAGER") {
    return { errors: { _global: ["permission"] } };
  }
  const gymId = auth.business!.id;

  // 60의 배수 → 정시 슬롯(M60), 그 외 → 30분 슬롯(M30)으로 자동 추론.
  // step은 슬롯 시작 간격이며 durationMin과 다른 개념: 50분 PT라도 30분마다
  // 시작 가능(M30), 60분 요가는 정시 시작(M60)이 자연스러움.
  const timeUnit: TimeUnit = data.durationMin % 60 === 0 ? "M60" : "M30";
  const capacity = data.type === "personal" ? 1 : data.capacity;

  await prisma.service.create({
    data: {
      gymId,
      name: data.name,
      capacity,
      timeUnit,
      durationMin: data.durationMin,
      pricePhp: data.pricePhp,
      payoutPhp: data.payoutPhp,
    },
  });

  revalidatePath(`/ko/g/${data.slug}/services`);
  revalidatePath(`/en/g/${data.slug}/services`);
  revalidatePath(`/ko/g/${data.slug}/products`);
  revalidatePath(`/en/g/${data.slug}/products`);
  return { ok: true, at: Date.now() };
}

const updateSchema = z.object({
  serviceId: z.string().min(1),
  slug: z.string().min(1),
  type: z.enum(["personal", "group"]),
  name: z.string().trim().min(1, "name").max(60),
  durationMin: intWithCommas.pipe(z.number().int().min(5).max(480)),
  capacity: intWithCommas.pipe(z.number().int().min(1).max(100)),
  pricePhp: intWithCommas.pipe(z.number().int().min(0)),
  payoutPhp: intWithCommas.pipe(z.number().int().min(0)),
});

export type UpdateServiceState = {
  errors?: Record<string, string[] | undefined>;
  ok?: boolean;
  at?: number;
};

export async function updateService(
  _prev: UpdateServiceState,
  formData: FormData,
): Promise<UpdateServiceState> {
  const parsed = updateSchema.safeParse({
    serviceId: formData.get("serviceId"),
    slug: formData.get("slug"),
    type: formData.get("type"),
    name: formData.get("name"),
    durationMin: formData.get("durationMin"),
    capacity: formData.get("capacity") || "1",
    pricePhp: formData.get("pricePhp") || "0",
    payoutPhp: formData.get("payoutPhp") || "0",
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

  const fieldErrors: Record<string, string[]> = {};
  if (data.type === "group" && data.capacity < 2) {
    fieldErrors.capacity = ["capacity"];
  }
  if (data.payoutPhp > data.pricePhp) {
    fieldErrors.payoutPhp = ["payoutOverPrice"];
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { errors: fieldErrors };
  }

  const auth = await requireGymStaff(data.slug);
  if (auth.role !== "OWNER" && auth.role !== "MANAGER") {
    return { errors: { _global: ["permission"] } };
  }
  const gymId = auth.business!.id;

  const svc = await prisma.service.findUnique({
    where: { id: data.serviceId },
  });
  if (!svc || svc.gymId !== gymId || !svc.active) {
    return { errors: { _global: ["permission"] } };
  }

  const timeUnit: TimeUnit = data.durationMin % 60 === 0 ? "M60" : "M30";
  const capacity = data.type === "personal" ? 1 : data.capacity;

  // 가격·payout 변경 시 PriceChangeLog row 자동 생성. pricePhp와 payoutPhp는
  // 별개 entity로 추적 — 사장 가격 vs 트레이너 지급은 매출/정산 산식에서
  // 다른 의미라 분리 저장. 트랜잭션으로 update와 묶어 atomic.
  const priceChanged = svc.pricePhp !== data.pricePhp;
  const payoutChanged = svc.payoutPhp !== data.payoutPhp;

  await prisma.$transaction(async (tx) => {
    await tx.service.update({
      where: { id: data.serviceId },
      data: {
        name: data.name,
        capacity,
        timeUnit,
        durationMin: data.durationMin,
        pricePhp: data.pricePhp,
        payoutPhp: data.payoutPhp,
      },
    });
    if (priceChanged) {
      await tx.priceChangeLog.create({
        data: {
          gymId,
          entityType: "SERVICE_PRICE",
          entityId: data.serviceId,
          oldValuePhp: svc.pricePhp,
          newValuePhp: data.pricePhp,
          changedById: auth.id,
        },
      });
    }
    if (payoutChanged) {
      await tx.priceChangeLog.create({
        data: {
          gymId,
          entityType: "SERVICE_PAYOUT",
          entityId: data.serviceId,
          oldValuePhp: svc.payoutPhp,
          newValuePhp: data.payoutPhp,
          changedById: auth.id,
        },
      });
    }
  });

  revalidatePath(`/ko/g/${data.slug}/services`);
  revalidatePath(`/en/g/${data.slug}/services`);
  revalidatePath(`/ko/g/${data.slug}/products`);
  revalidatePath(`/en/g/${data.slug}/products`);
  return { ok: true, at: Date.now() };
}

// ─── Service(종목) 폐지 ─────────────────────────────────────
//
// 단체수업 스케줄 폐지([[decision_class_deletion_refund_flow]])와 동일 흐름을
// 종목 단위로 확장. 영향 = 그 종목의 모든 미래 예약 + 모든 잔여 권. 트랜잭션:
//   1) 미래 예약 자동 취소
//   2) 영향 회원 전원에게 RefundRequest(CLASS_DISCONTINUED) + 권 동결
//   3) 그 종목의 ScheduledClass 전부 active=false
//   4) Service active=false (hard delete 는 Package/Reservation FK 영구 차단)

export type ServiceDeletionAffectedMember = {
  packageId: string;
  customerUserId: string;
  customerName: string;
  remainingCount: number;
  paidPhp: number;
  totalCount: number;
  refundPhp: number;
  refundUnits: number;
};

export type ServiceDeletionImpact =
  | { ok: false; error: "permission" }
  | {
      ok: true;
      serviceId: string;
      serviceName: string;
      activeSchedulesCount: number;
      futureReservationsCount: number;
      affectedMembers: ServiceDeletionAffectedMember[];
      totalRefundPhp: number;
    };

export async function previewServiceDeletionImpact(
  slug: string,
  serviceId: string,
): Promise<ServiceDeletionImpact> {
  const auth = await requireGymStaff(slug);
  if (auth.role !== "OWNER" && auth.role !== "MANAGER") {
    return { ok: false, error: "permission" };
  }
  const gymId = auth.business!.id;

  const svc = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { id: true, gymId: true, name: true },
  });
  if (!svc || svc.gymId !== gymId) {
    return { ok: false, error: "permission" };
  }

  const [activeSchedulesCount, futureReservationsCount, packages] =
    await Promise.all([
      prisma.scheduledClass.count({
        where: { gymId, serviceId, active: true },
      }),
      prisma.reservation.count({
        where: {
          gymId,
          serviceId,
          status: { in: ["PENDING_PAYMENT", "CONFIRMED"] },
          endAt: { gte: new Date() },
        },
      }),
      prisma.package.findMany({
        where: {
          gymId,
          serviceId,
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

  const affectedMembers: ServiceDeletionAffectedMember[] = packages.map((p) => {
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
    serviceId: svc.id,
    serviceName: svc.name,
    activeSchedulesCount,
    futureReservationsCount,
    affectedMembers,
    totalRefundPhp,
  };
}

export async function applyServiceDeletion(input: {
  slug: string;
  serviceId: string;
}): Promise<{ ok?: boolean; error?: string; refundCount?: number }> {
  const auth = await requireGymStaff(input.slug);
  if (auth.role !== "OWNER" && auth.role !== "MANAGER") {
    return { error: "permission" };
  }
  const gymId = auth.business!.id;

  const impact = await previewServiceDeletionImpact(
    input.slug,
    input.serviceId,
  );
  if (!impact.ok) return { error: impact.error };

  await prisma.$transaction(async (tx) => {
    // 1) 미래 예약 자동 취소 + 로그
    const futureResv = await tx.reservation.findMany({
      where: {
        gymId,
        serviceId: input.serviceId,
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

    // 2) 영향 회원 환불 자동 생성 + 권 동결
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

    // 3) 그 종목의 모든 ScheduledClass active=false
    await tx.scheduledClass.updateMany({
      where: { gymId, serviceId: input.serviceId, active: true },
      data: { active: false },
    });

    // 4) Service active=false (soft delete)
    await tx.service.update({
      where: { id: input.serviceId },
      data: { active: false },
    });
  });

  revalidatePath(`/ko/g/${input.slug}/services`);
  revalidatePath(`/en/g/${input.slug}/services`);
  revalidatePath(`/ko/g/${input.slug}/products`);
  revalidatePath(`/en/g/${input.slug}/products`);
  revalidatePath(`/ko/g/${input.slug}/refunds`);
  revalidatePath(`/en/g/${input.slug}/refunds`);
  return { ok: true, refundCount: impact.affectedMembers.length };
}
