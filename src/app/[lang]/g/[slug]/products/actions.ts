"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";

// 숫자 input은 type="text" + 콤마 포맷팅으로 들어오므로 콤마 제거 후 정수 변환.
const intWithCommas = z.preprocess((v) => {
  if (typeof v !== "string") return v;
  const cleaned = v.replace(/,/g, "").trim();
  if (cleaned === "") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}, z.number().int());

const createSchema = z.object({
  slug: z.string().min(1),
  name: z.string().trim().min(1, "name").max(60),
  durationDays: intWithCommas.pipe(z.number().int().min(1).max(3650)),
  pricePhp: intWithCommas.pipe(z.number().int().min(0)),
});

const updateSchema = createSchema.extend({
  planId: z.string().min(1),
  active: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

export type MembershipPlanState = {
  errors?: Record<string, string[] | undefined>;
  ok?: boolean;
  at?: number;
};

function revalidateProducts(slug: string) {
  revalidatePath(`/ko/g/${slug}/products`);
  revalidatePath(`/en/g/${slug}/products`);
}

export async function createMembershipPlan(
  _prev: MembershipPlanState,
  formData: FormData,
): Promise<MembershipPlanState> {
  const parsed = createSchema.safeParse({
    slug: formData.get("slug"),
    name: formData.get("name"),
    durationDays: formData.get("durationDays"),
    pricePhp: formData.get("pricePhp") || "0",
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

  const auth = await requireGymStaff(data.slug);
  if (auth.role !== "OWNER" && auth.role !== "MANAGER") {
    return { errors: { _global: ["permission"] } };
  }
  const gymId = auth.business!.id;

  await prisma.membershipPlan.create({
    data: {
      gymId,
      name: data.name,
      durationDays: data.durationDays,
      pricePhp: data.pricePhp,
    },
  });

  revalidateProducts(data.slug);
  return { ok: true, at: Date.now() };
}

export async function updateMembershipPlan(
  _prev: MembershipPlanState,
  formData: FormData,
): Promise<MembershipPlanState> {
  const parsed = updateSchema.safeParse({
    planId: formData.get("planId"),
    slug: formData.get("slug"),
    name: formData.get("name"),
    durationDays: formData.get("durationDays"),
    pricePhp: formData.get("pricePhp") || "0",
    active: formData.get("active") ?? "false",
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

  const auth = await requireGymStaff(data.slug);
  if (auth.role !== "OWNER" && auth.role !== "MANAGER") {
    return { errors: { _global: ["permission"] } };
  }
  const gymId = auth.business!.id;

  const existing = await prisma.membershipPlan.findUnique({
    where: { id: data.planId },
  });
  if (!existing || existing.gymId !== gymId) {
    return { errors: { _global: ["permission"] } };
  }

  // 가격 변경 감지 — PriceChangeLog row 생성 (변경된 경우만).
  // 이름·기간·active 변경은 audit 안 함 (금액 영향 없음). 트랜잭션으로
  // 로그와 업데이트를 묶어 부분 실패 시 둘 다 롤백.
  const priceChanged = existing.pricePhp !== data.pricePhp;

  await prisma.$transaction(async (tx) => {
    await tx.membershipPlan.update({
      where: { id: data.planId },
      data: {
        name: data.name,
        durationDays: data.durationDays,
        pricePhp: data.pricePhp,
        active: data.active,
      },
    });
    if (priceChanged) {
      await tx.priceChangeLog.create({
        data: {
          gymId,
          entityType: "MEMBERSHIP_PLAN_PRICE",
          entityId: data.planId,
          oldValuePhp: existing.pricePhp,
          newValuePhp: data.pricePhp,
          changedById: auth.id,
        },
      });
    }
  });

  revalidateProducts(data.slug);
  return { ok: true, at: Date.now() };
}

export async function deleteMembershipPlan(
  slug: string,
  planId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const auth = await requireGymStaff(slug);
  if (auth.role !== "OWNER" && auth.role !== "MANAGER") {
    return { error: "permission" };
  }
  const gymId = auth.business!.id;

  const plan = await prisma.membershipPlan.findUnique({
    where: { id: planId },
  });
  if (!plan || plan.gymId !== gymId) {
    return { error: "permission" };
  }

  // 이미 발급된 Membership 인스턴스가 있는지 확인. 있으면 삭제 차단 —
  // 회원권 이력을 보호해야 매출 추적 가능. 비활성화(active=false)로 안내.
  // 현재 Membership 모델에 planId FK가 없어 직접 추적 어려움 — 향후 FK 추가 후 정확한 차단 필요.
  // 임시로 매장 내 어떤 Membership이라도 있으면 차단(보수적).
  // TODO: Membership.planId? 컬럼 추가 후 정확하게 plan별 카운트로 변경.
  // 일단은 단순 삭제 (instance 추적 미구현 단계라).

  await prisma.membershipPlan.delete({ where: { id: planId } });

  revalidateProducts(slug);
  return { ok: true };
}

// ─── PackagePlan CRUD ─────────────────────────────────────

const packageCreateSchema = z.object({
  slug: z.string().min(1),
  name: z.string().trim().min(1, "name").max(60),
  serviceId: z.string().min(1, "service"),
  sessionCount: intWithCommas.pipe(z.number().int().min(1).max(1000)),
  pricePhp: intWithCommas.pipe(z.number().int().min(0)),
});

const packageUpdateSchema = packageCreateSchema.extend({
  planId: z.string().min(1),
  active: z.preprocess(
    (v) => v === "on" || v === "true" || v === true,
    z.boolean(),
  ),
});

export async function createPackagePlan(
  _prev: MembershipPlanState,
  formData: FormData,
): Promise<MembershipPlanState> {
  const parsed = packageCreateSchema.safeParse({
    slug: formData.get("slug"),
    name: formData.get("name"),
    serviceId: formData.get("serviceId"),
    sessionCount: formData.get("sessionCount"),
    pricePhp: formData.get("pricePhp") || "0",
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

  const auth = await requireGymStaff(data.slug);
  if (auth.role !== "OWNER" && auth.role !== "MANAGER") {
    return { errors: { _global: ["permission"] } };
  }
  const gymId = auth.business!.id;

  // service 소유권 확인 + payout 정보 fetch (마진 음수 차단용)
  const svc = await prisma.service.findUnique({
    where: { id: data.serviceId },
  });
  if (!svc || svc.gymId !== gymId) {
    return { errors: { serviceId: ["service"] } };
  }

  // 사장 마진 음수 차단 — 트레이너 지급 합계가 가격보다 크면 거부.
  const payoutTotal = svc.payoutPhp * data.sessionCount;
  if (payoutTotal > data.pricePhp) {
    return { errors: { pricePhp: ["marginNegative"] } };
  }

  await prisma.packagePlan.create({
    data: {
      gymId,
      name: data.name,
      serviceId: data.serviceId,
      sessionCount: data.sessionCount,
      pricePhp: data.pricePhp,
    },
  });

  revalidateProducts(data.slug);
  return { ok: true, at: Date.now() };
}

export async function updatePackagePlan(
  _prev: MembershipPlanState,
  formData: FormData,
): Promise<MembershipPlanState> {
  const parsed = packageUpdateSchema.safeParse({
    planId: formData.get("planId"),
    slug: formData.get("slug"),
    name: formData.get("name"),
    serviceId: formData.get("serviceId"),
    sessionCount: formData.get("sessionCount"),
    pricePhp: formData.get("pricePhp") || "0",
    active: formData.get("active") ?? "false",
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

  const auth = await requireGymStaff(data.slug);
  if (auth.role !== "OWNER" && auth.role !== "MANAGER") {
    return { errors: { _global: ["permission"] } };
  }
  const gymId = auth.business!.id;

  const existing = await prisma.packagePlan.findUnique({
    where: { id: data.planId },
  });
  if (!existing || existing.gymId !== gymId) {
    return { errors: { _global: ["permission"] } };
  }

  const svc = await prisma.service.findUnique({
    where: { id: data.serviceId },
  });
  if (!svc || svc.gymId !== gymId) {
    return { errors: { serviceId: ["service"] } };
  }

  const payoutTotal = svc.payoutPhp * data.sessionCount;
  if (payoutTotal > data.pricePhp) {
    return { errors: { pricePhp: ["marginNegative"] } };
  }

  const priceChanged = existing.pricePhp !== data.pricePhp;

  await prisma.$transaction(async (tx) => {
    await tx.packagePlan.update({
      where: { id: data.planId },
      data: {
        name: data.name,
        serviceId: data.serviceId,
        sessionCount: data.sessionCount,
        pricePhp: data.pricePhp,
        active: data.active,
      },
    });
    if (priceChanged) {
      await tx.priceChangeLog.create({
        data: {
          gymId,
          entityType: "PACKAGE_PLAN_PRICE",
          entityId: data.planId,
          oldValuePhp: existing.pricePhp,
          newValuePhp: data.pricePhp,
          changedById: auth.id,
        },
      });
    }
  });

  revalidateProducts(data.slug);
  return { ok: true, at: Date.now() };
}

export async function deletePackagePlan(
  slug: string,
  planId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const auth = await requireGymStaff(slug);
  if (auth.role !== "OWNER" && auth.role !== "MANAGER") {
    return { error: "permission" };
  }
  const gymId = auth.business!.id;

  const plan = await prisma.packagePlan.findUnique({
    where: { id: planId },
    include: { _count: { select: { comboItems: true } } },
  });
  if (!plan || plan.gymId !== gymId) {
    return { error: "permission" };
  }

  // 콤보에 포함된 패키지는 삭제 차단 — Restrict FK가 막아주지만 사용자 친화적 메시지를
  // 위해 먼저 확인.
  if (plan._count.comboItems > 0) {
    return { error: "hasInComboPlan" };
  }

  await prisma.packagePlan.delete({ where: { id: planId } });

  revalidateProducts(slug);
  return { ok: true };
}

// ─── ComboPlan CRUD ───────────────────────────────────────

const comboCreateSchema = z.object({
  slug: z.string().min(1),
  name: z.string().trim().min(1, "name").max(60),
  membershipPlanId: z.string().optional(),
  packagePlanIds: z.string(), // JSON-encoded string[] from hidden input
  pricePhp: intWithCommas.pipe(z.number().int().min(0)),
});

const comboUpdateSchema = comboCreateSchema.extend({
  planId: z.string().min(1),
  active: z.preprocess(
    (v) => v === "on" || v === "true" || v === true,
    z.boolean(),
  ),
});

function parsePackageIds(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

async function calcComboPayoutTotal(
  packagePlanIds: string[],
  gymId: string,
): Promise<number> {
  if (packagePlanIds.length === 0) return 0;
  const packs = await prisma.packagePlan.findMany({
    where: { id: { in: packagePlanIds }, gymId },
    include: { service: true },
  });
  return packs.reduce(
    (sum, p) => sum + p.service.payoutPhp * p.sessionCount,
    0,
  );
}

export async function createComboPlan(
  _prev: MembershipPlanState,
  formData: FormData,
): Promise<MembershipPlanState> {
  const parsed = comboCreateSchema.safeParse({
    slug: formData.get("slug"),
    name: formData.get("name"),
    membershipPlanId: formData.get("membershipPlanId") || undefined,
    packagePlanIds: formData.get("packagePlanIds"),
    pricePhp: formData.get("pricePhp") || "0",
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
  const packageIds = parsePackageIds(data.packagePlanIds);

  if (!data.membershipPlanId && packageIds.length === 0) {
    return { errors: { items: ["items"] } };
  }

  const auth = await requireGymStaff(data.slug);
  if (auth.role !== "OWNER" && auth.role !== "MANAGER") {
    return { errors: { _global: ["permission"] } };
  }
  const gymId = auth.business!.id;

  // 사장 마진 음수 차단 — 콤보가가 트레이너 지급 총합보다 작으면 거부.
  const payoutTotal = await calcComboPayoutTotal(packageIds, gymId);
  if (payoutTotal > data.pricePhp) {
    return { errors: { pricePhp: ["marginNegative"] } };
  }

  await prisma.comboPlan.create({
    data: {
      gymId,
      name: data.name,
      membershipPlanId: data.membershipPlanId || null,
      pricePhp: data.pricePhp,
      packageItems: {
        create: packageIds.map((pid) => ({ packagePlanId: pid })),
      },
    },
  });

  revalidateProducts(data.slug);
  return { ok: true, at: Date.now() };
}

export async function updateComboPlan(
  _prev: MembershipPlanState,
  formData: FormData,
): Promise<MembershipPlanState> {
  const parsed = comboUpdateSchema.safeParse({
    planId: formData.get("planId"),
    slug: formData.get("slug"),
    name: formData.get("name"),
    membershipPlanId: formData.get("membershipPlanId") || undefined,
    packagePlanIds: formData.get("packagePlanIds"),
    pricePhp: formData.get("pricePhp") || "0",
    active: formData.get("active") ?? "false",
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
  const packageIds = parsePackageIds(data.packagePlanIds);

  if (!data.membershipPlanId && packageIds.length === 0) {
    return { errors: { items: ["items"] } };
  }

  const auth = await requireGymStaff(data.slug);
  if (auth.role !== "OWNER" && auth.role !== "MANAGER") {
    return { errors: { _global: ["permission"] } };
  }
  const gymId = auth.business!.id;

  const existing = await prisma.comboPlan.findUnique({
    where: { id: data.planId },
  });
  if (!existing || existing.gymId !== gymId) {
    return { errors: { _global: ["permission"] } };
  }

  const payoutTotal = await calcComboPayoutTotal(packageIds, gymId);
  if (payoutTotal > data.pricePhp) {
    return { errors: { pricePhp: ["marginNegative"] } };
  }

  const priceChanged = existing.pricePhp !== data.pricePhp;

  await prisma.$transaction(async (tx) => {
    await tx.comboPlan.update({
      where: { id: data.planId },
      data: {
        name: data.name,
        membershipPlanId: data.membershipPlanId || null,
        pricePhp: data.pricePhp,
        active: data.active,
        // packageItems는 한 번에 교체 — 기존 row 다 지우고 새로 생성.
        // 콤보는 가벼운 테이블이라 비용 무시 가능.
        packageItems: {
          deleteMany: {},
          create: packageIds.map((pid) => ({ packagePlanId: pid })),
        },
      },
    });
    if (priceChanged) {
      await tx.priceChangeLog.create({
        data: {
          gymId,
          entityType: "COMBO_PLAN_PRICE",
          entityId: data.planId,
          oldValuePhp: existing.pricePhp,
          newValuePhp: data.pricePhp,
          changedById: auth.id,
        },
      });
    }
  });

  revalidateProducts(data.slug);
  return { ok: true, at: Date.now() };
}

export async function deleteComboPlan(
  slug: string,
  planId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const auth = await requireGymStaff(slug);
  if (auth.role !== "OWNER" && auth.role !== "MANAGER") {
    return { error: "permission" };
  }
  const gymId = auth.business!.id;

  const plan = await prisma.comboPlan.findUnique({
    where: { id: planId },
  });
  if (!plan || plan.gymId !== gymId) {
    return { error: "permission" };
  }

  await prisma.comboPlan.delete({ where: { id: planId } });

  revalidateProducts(slug);
  return { ok: true };
}

// ─── Promotion CRUD ───────────────────────────────────────

const promotionCreateSchema = z.object({
  slug: z.string().min(1),
  name: z.string().trim().min(1, "name").max(60),
  scope: z.enum([
    "ALL",
    "MEMBERSHIP_ONLY",
    "PACKAGE_ONLY",
    "SPECIFIC_MEMBERSHIP",
    "SPECIFIC_PACKAGE",
  ]),
  targetId: z.string().optional(),
  discountType: z.enum(["PERCENT", "FIXED"]),
  discountValue: intWithCommas.pipe(z.number().int().min(1)),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
});

const promotionUpdateSchema = promotionCreateSchema.extend({
  promotionId: z.string().min(1),
  active: z.preprocess(
    (v) => v === "on" || v === "true" || v === true,
    z.boolean(),
  ),
});

// 이벤트 기간은 날짜 단위 입력(YYYY-MM-DD). 시작일 00:00:00Z ~ 종료일
// 23:59:59.999Z 로 박제 — 종료일 inclusive(그날 하루 종일 유효),
// UTC 고정이라 dev/prod 일관 + 편집 시 날짜 drift 없음. 검증·생성·수정 공유.
function periodBounds(startsAt: string, endsAt: string): {
  s: Date;
  e: Date;
} {
  return {
    s: new Date(`${startsAt}T00:00:00.000Z`),
    e: new Date(`${endsAt}T23:59:59.999Z`),
  };
}

function validatePromotion(data: {
  scope: string;
  targetId?: string;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  startsAt: string;
  endsAt: string;
}): Record<string, string[]> | null {
  const errors: Record<string, string[]> = {};
  if (
    (data.scope === "SPECIFIC_MEMBERSHIP" ||
      data.scope === "SPECIFIC_PACKAGE") &&
    !data.targetId
  ) {
    errors.targetId = ["target"];
  }
  if (data.discountType === "PERCENT" && data.discountValue > 100) {
    errors.discountValue = ["discountPercent"];
  }
  const { s, e } = periodBounds(data.startsAt, data.endsAt);
  if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime())) {
    errors.startsAt = ["period"];
  } else if (e <= s) {
    errors.endsAt = ["period"];
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

export async function createPromotion(
  _prev: MembershipPlanState,
  formData: FormData,
): Promise<MembershipPlanState> {
  const parsed = promotionCreateSchema.safeParse({
    slug: formData.get("slug"),
    name: formData.get("name"),
    scope: formData.get("scope"),
    targetId: formData.get("targetId") || undefined,
    discountType: formData.get("discountType"),
    discountValue: formData.get("discountValue"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
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

  const fieldErrors = validatePromotion(data);
  if (fieldErrors) return { errors: fieldErrors };

  const auth = await requireGymStaff(data.slug);
  if (auth.role !== "OWNER" && auth.role !== "MANAGER") {
    return { errors: { _global: ["permission"] } };
  }
  const gymId = auth.business!.id;

  // SPECIFIC_* scope일 때만 targetId 저장. ALL/*_ONLY는 NULL.
  const targetId =
    data.scope === "SPECIFIC_MEMBERSHIP" || data.scope === "SPECIFIC_PACKAGE"
      ? (data.targetId ?? null)
      : null;

  const { s: startsAt, e: endsAt } = periodBounds(data.startsAt, data.endsAt);
  await prisma.promotion.create({
    data: {
      gymId,
      name: data.name,
      scope: data.scope,
      targetId,
      discountType: data.discountType,
      discountValue: data.discountValue,
      startsAt,
      endsAt,
    },
  });

  revalidateProducts(data.slug);
  return { ok: true, at: Date.now() };
}

export async function updatePromotion(
  _prev: MembershipPlanState,
  formData: FormData,
): Promise<MembershipPlanState> {
  const parsed = promotionUpdateSchema.safeParse({
    promotionId: formData.get("promotionId"),
    slug: formData.get("slug"),
    name: formData.get("name"),
    scope: formData.get("scope"),
    targetId: formData.get("targetId") || undefined,
    discountType: formData.get("discountType"),
    discountValue: formData.get("discountValue"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    active: formData.get("active") ?? "false",
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

  const fieldErrors = validatePromotion(data);
  if (fieldErrors) return { errors: fieldErrors };

  const auth = await requireGymStaff(data.slug);
  if (auth.role !== "OWNER" && auth.role !== "MANAGER") {
    return { errors: { _global: ["permission"] } };
  }
  const gymId = auth.business!.id;

  const existing = await prisma.promotion.findUnique({
    where: { id: data.promotionId },
  });
  if (!existing || existing.gymId !== gymId) {
    return { errors: { _global: ["permission"] } };
  }

  const targetId =
    data.scope === "SPECIFIC_MEMBERSHIP" || data.scope === "SPECIFIC_PACKAGE"
      ? (data.targetId ?? null)
      : null;

  const valueChanged = existing.discountValue !== data.discountValue;
  const { s: startsAt, e: endsAt } = periodBounds(data.startsAt, data.endsAt);

  await prisma.$transaction(async (tx) => {
    await tx.promotion.update({
      where: { id: data.promotionId },
      data: {
        name: data.name,
        scope: data.scope,
        targetId,
        discountType: data.discountType,
        discountValue: data.discountValue,
        startsAt,
        endsAt,
        active: data.active,
      },
    });
    if (valueChanged) {
      await tx.priceChangeLog.create({
        data: {
          gymId,
          entityType: "PROMOTION_VALUE",
          entityId: data.promotionId,
          oldValuePhp: existing.discountValue,
          newValuePhp: data.discountValue,
          changedById: auth.id,
        },
      });
    }
  });

  revalidateProducts(data.slug);
  return { ok: true, at: Date.now() };
}

export async function deletePromotion(
  slug: string,
  promotionId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const auth = await requireGymStaff(slug);
  if (auth.role !== "OWNER" && auth.role !== "MANAGER") {
    return { error: "permission" };
  }
  const gymId = auth.business!.id;

  const promo = await prisma.promotion.findUnique({
    where: { id: promotionId },
  });
  if (!promo || promo.gymId !== gymId) {
    return { error: "permission" };
  }

  await prisma.promotion.delete({ where: { id: promotionId } });

  revalidateProducts(slug);
  return { ok: true };
}
