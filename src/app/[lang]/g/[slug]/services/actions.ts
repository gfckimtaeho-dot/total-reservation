"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import type { TimeUnit } from "@/generated/prisma/enums";

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
  if (!svc || svc.gymId !== gymId) {
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

export type DeleteServiceResult =
  | { ok: true }
  | { error: "permission" }
  | {
      error: "hasReferences";
      refs: { plans: number; packages: number; reservations: number };
    };

export async function deleteService(
  slug: string,
  serviceId: string,
): Promise<DeleteServiceResult> {
  const auth = await requireGymStaff(slug);
  if (auth.role !== "OWNER" && auth.role !== "MANAGER") {
    return { error: "permission" };
  }
  const gymId = auth.business!.id;

  const svc = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!svc || svc.gymId !== gymId) {
    return { error: "permission" };
  }

  // 종목 hard delete 는 참조 0건일 때만 허용 — DB의 onDelete: Restrict 와 동일한
  // 가드를 앱 계층에서 사전에 돌려 P2003(외래키 위반) 500 을 친절한 에러로 변환.
  // 활성 운영 종목은 사실상 폐지 불가 — 정식 폐지 흐름(Service.active soft delete)은
  // 별도 결정 대기. [[decision_class_deletion_refund_flow]] 의 "Service 자체 폐지 보류"
  // 항목 참고. ScheduledClass 는 onDelete: Cascade 라 검사 대상 아님.
  const [planCount, packageCount, reservationCount] = await Promise.all([
    prisma.packagePlan.count({ where: { serviceId } }),
    prisma.package.count({ where: { serviceId } }),
    prisma.reservation.count({ where: { serviceId } }),
  ]);
  if (planCount + packageCount + reservationCount > 0) {
    return {
      error: "hasReferences",
      refs: {
        plans: planCount,
        packages: packageCount,
        reservations: reservationCount,
      },
    };
  }

  await prisma.service.delete({ where: { id: serviceId } });

  revalidatePath(`/ko/g/${slug}/services`);
  revalidatePath(`/en/g/${slug}/services`);
  revalidatePath(`/ko/g/${slug}/products`);
  revalidatePath(`/en/g/${slug}/products`);
  return { ok: true };
}
