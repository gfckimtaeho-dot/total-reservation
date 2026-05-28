"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { hotelDb } from "@/lib/hotel-db";
import { requireAdmin } from "@/lib/auth/dal";
import {
  daysForYears,
  extendEndDateByDays,
} from "@/lib/subscription/plans";

type Vertical = "GYM" | "HOTEL";

const verticalEnum = z.enum(["GYM", "HOTEL"]);

const recordSchema = z.object({
  vertical: verticalEnum,
  // URL param 이름 호환 위해 gymId 유지. HOTEL 일 때는 호텔 Business.id 가 들어감.
  gymId: z.string().min(1),
  years: z.coerce.number().int().positive("년수는 1 이상").max(20),
  amountKrw: z.coerce.number().int().nonnegative(),
  paidAt: z.string().min(1, "입금 일자를 입력해 주세요"),
  memo: z.string().max(500).optional().or(z.literal("")),
});

export type RecordPaymentState = {
  errors?: Record<string, string[] | undefined>;
  message?: string;
  ok?: boolean;
};

function parseVertical(value: FormDataEntryValue | null): Vertical {
  return value === "HOTEL" ? "HOTEL" : "GYM";
}

export async function recordPayment(
  _prev: RecordPaymentState,
  formData: FormData,
): Promise<RecordPaymentState> {
  await requireAdmin();
  const parsed = recordSchema.safeParse({
    vertical: parseVertical(formData.get("vertical")),
    gymId: formData.get("gymId"),
    years: formData.get("years"),
    amountKrw: formData.get("amountKrw"),
    paidAt: formData.get("paidAt"),
    memo: formData.get("memo"),
  });
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  }
  const { vertical, gymId, years, amountKrw, paidAt, memo } = parsed.data;
  const paidAtDate = new Date(paidAt);
  if (Number.isNaN(paidAtDate.getTime())) {
    return { errors: { paidAt: ["입금 일자 형식이 올바르지 않습니다"] } };
  }

  const days = daysForYears(years);

  if (vertical === "HOTEL") {
    const business = await hotelDb.business.findUnique({
      where: { id: gymId },
      include: { subscription: true },
    });
    if (!business) return { message: "매장을 찾을 수 없습니다." };

    const newEnd = extendEndDateByDays(
      business.subscription?.endDate ?? null,
      days,
      paidAtDate,
    );

    await hotelDb.$transaction([
      hotelDb.payment.create({
        data: {
          hotelId: gymId,
          // 헬스장과 동일 룰: amountPhp 컬럼에 KRW 값 저장 (rename 은 별도 migration).
          amountPhp: amountKrw,
          paidAt: paidAtDate,
          confirmedAt: new Date(),
          memo: memo ? memo : null,
        },
      }),
      hotelDb.subscription.upsert({
        where: { hotelId: gymId },
        create: {
          hotelId: gymId,
          plan: "ANNUAL",
          startDate: paidAtDate,
          endDate: newEnd,
        },
        update: {
          plan: "ANNUAL",
          endDate: newEnd,
        },
      }),
      hotelDb.business.updateMany({
        where: { id: gymId, status: { not: "BLOCKED" } },
        data: { status: "ACTIVE" },
      }),
    ]);
  } else {
    const business = await prisma.business.findUnique({
      where: { id: gymId },
      include: { subscription: true },
    });
    if (!business) return { message: "매장을 찾을 수 없습니다." };

    const newEnd = extendEndDateByDays(
      business.subscription?.endDate ?? null,
      days,
      paidAtDate,
    );

    await prisma.$transaction([
      prisma.payment.create({
        data: {
          gymId,
          // schema 의 amountPhp 컬럼은 그대로 두되 값은 KRW. rename 은 별도 migration.
          amountPhp: amountKrw,
          paidAt: paidAtDate,
          confirmedAt: new Date(),
          memo: memo ? memo : null,
        },
      }),
      prisma.subscription.upsert({
        where: { gymId },
        create: {
          gymId,
          // SubscriptionPlan enum 의 ANNUAL 만 admin 측에서 사용. 다년은 endDate 가 표현.
          plan: "ANNUAL",
          startDate: paidAtDate,
          endDate: newEnd,
        },
        update: {
          plan: "ANNUAL",
          endDate: newEnd,
        },
      }),
      prisma.business.updateMany({
        where: { id: gymId, status: { not: "BLOCKED" } },
        data: { status: "ACTIVE" },
      }),
    ]);
  }

  revalidatePath("/admin/subscriptions");
  revalidatePath(`/admin/subscriptions/${gymId}`);
  revalidatePath(`/admin/businesses/${gymId}`);
  return { ok: true };
}

const refundSchema = z.object({
  vertical: verticalEnum,
  gymId: z.string().min(1),
  amountKrw: z.coerce.number().int().positive("환불 금액은 1 이상"),
  memo: z.string().min(1, "환불 사유 메모를 입력해 주세요").max(500),
});

export type RefundPaymentState = {
  errors?: Record<string, string[] | undefined>;
  message?: string;
  ok?: boolean;
};

export async function refundPayment(
  _prev: RefundPaymentState,
  formData: FormData,
): Promise<RefundPaymentState> {
  await requireAdmin();
  const parsed = refundSchema.safeParse({
    vertical: parseVertical(formData.get("vertical")),
    gymId: formData.get("gymId"),
    amountKrw: formData.get("amountKrw"),
    memo: formData.get("memo"),
  });
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  }
  const { vertical, gymId, amountKrw, memo } = parsed.data;
  const now = new Date();

  // spec admin.md "환불은 매장 직접 입금 (현금 운영, 시스템은 기록만)".
  // Payment 의 amountPhp(컬럼) 를 음수로 박아 결제 이력에서 환불 row 로 식별.
  if (vertical === "HOTEL") {
    const exists = await hotelDb.business.findUnique({
      where: { id: gymId },
      select: { id: true },
    });
    if (!exists) return { message: "매장을 찾을 수 없습니다." };

    await hotelDb.payment.create({
      data: {
        hotelId: gymId,
        amountPhp: -amountKrw,
        paidAt: now,
        confirmedAt: now,
        memo: `[환불] ${memo}`,
      },
    });
  } else {
    const exists = await prisma.business.findUnique({
      where: { id: gymId },
      select: { id: true },
    });
    if (!exists) return { message: "매장을 찾을 수 없습니다." };

    await prisma.payment.create({
      data: {
        gymId,
        amountPhp: -amountKrw,
        paidAt: now,
        confirmedAt: now,
        memo: `[환불] ${memo}`,
      },
    });
  }

  revalidatePath("/admin/subscriptions");
  revalidatePath(`/admin/subscriptions/${gymId}`);
  return { ok: true };
}
