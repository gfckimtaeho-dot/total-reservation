"use server";

import crypto from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { hotelDb } from "@/lib/hotel-db";
import { requireAdmin } from "@/lib/auth/dal";
import {
  sendPasswordResetEmail,
  sendCoffeeManagerInviteEmail,
} from "@/lib/email/resend";

type Vertical = "GYM" | "HOTEL";

const verticalEnum = z.enum(["GYM", "HOTEL"]);

const blockSchema = z.object({
  vertical: verticalEnum,
  id: z.string().min(1),
  reason: z.string().min(1, "차단 사유를 입력해 주세요").max(500),
});

export type BlockState = {
  errors?: Record<string, string[] | undefined>;
  message?: string;
  ok?: boolean;
};

function parseVertical(value: FormDataEntryValue | null): Vertical {
  return value === "HOTEL" ? "HOTEL" : "GYM";
}

export async function blockBusiness(
  _prev: BlockState,
  formData: FormData,
): Promise<BlockState> {
  await requireAdmin();
  const parsed = blockSchema.safeParse({
    vertical: parseVertical(formData.get("vertical")),
    id: formData.get("id"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  }
  const { vertical, id, reason } = parsed.data;

  if (vertical === "HOTEL") {
    const existing = await hotelDb.business.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) return { message: "매장을 찾을 수 없습니다." };
    if (existing.status === "BLOCKED") {
      return { message: "이미 차단된 매장입니다." };
    }
    await hotelDb.business.update({
      where: { id },
      data: {
        status: "BLOCKED",
        blockedReason: reason,
      },
    });
  } else {
    const existing = await prisma.business.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) return { message: "매장을 찾을 수 없습니다." };
    if (existing.status === "BLOCKED") {
      return { message: "이미 차단된 매장입니다." };
    }
    await prisma.business.update({
      where: { id },
      data: {
        status: "BLOCKED",
        blockedReason: reason,
      },
    });
  }

  revalidatePath("/admin/businesses");
  revalidatePath(`/admin/businesses/${id}`);
  return { ok: true };
}

export async function unblockBusiness(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const vertical = parseVertical(formData.get("vertical"));

  if (vertical === "HOTEL") {
    const existing = await hotelDb.business.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) return;
    if (existing.status !== "BLOCKED") return;
    await hotelDb.business.update({
      where: { id },
      data: { status: "ACTIVE" },
    });
  } else {
    const existing = await prisma.business.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) return;
    if (existing.status !== "BLOCKED") return;
    // 재활성화는 ACTIVE 로. 구독 만료/유예 자동 분기는 별도 task (#4 구독 관리).
    // 사유 메모는 영구 audit 차원에서 그대로 둔다 (재활성화 후에도 추적 가능).
    await prisma.business.update({
      where: { id },
      data: { status: "ACTIVE" },
    });
  }

  revalidatePath("/admin/businesses");
  revalidatePath(`/admin/businesses/${id}`);
  redirect(`/admin/businesses/${id}`);
}

// 사장 비밀번호 재설정 메일 발송 (admin 헬프데스크).
// magicLinkToken(purpose=PASSWORD_RESET) 1회용 토큰 발급 + 사장 이메일로 reset URL.
// 사장 본인 self-service 흐름과 같은 인프라 재사용. 10 분 쿨다운.
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_COOLDOWN_MS = 10 * 60 * 1000;

export type PasswordResetSendResult =
  | { ok: true; emailedTo: string }
  | { ok: false; message: string };

function cooldownMsg(elapsedMs: number): string {
  const remain = Math.ceil((RESET_COOLDOWN_MS - elapsedMs) / 1000);
  const m = Math.floor(remain / 60);
  const s = remain % 60;
  return `최근 발송 후 10분이 지나지 않았습니다. (${m}분 ${s}초 남음)`;
}

export async function sendOwnerPasswordReset(
  formData: FormData,
): Promise<PasswordResetSendResult> {
  await requireAdmin();
  const vertical = parseVertical(formData.get("vertical"));
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "매장 id 가 비어있습니다." };

  if (vertical === "HOTEL") return await sendHotelOwnerReset(id);
  return await sendGymOwnerReset(id);
}

async function sendGymOwnerReset(
  businessId: string,
): Promise<PasswordResetSendResult> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, slug: true },
  });
  if (!business) return { ok: false, message: "매장을 찾을 수 없습니다." };

  const owner = await prisma.user.findFirst({
    where: { gymId: businessId, role: "OWNER", active: true },
    select: { id: true, name: true, email: true, locale: true },
  });
  if (!owner) return { ok: false, message: "활성 사장 계정이 없습니다." };
  if (!owner.email)
    return { ok: false, message: "사장 이메일이 등록돼 있지 않습니다." };

  const recent = await prisma.magicLinkToken.findFirst({
    where: { targetUserId: owner.id, purpose: "PASSWORD_RESET" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (recent) {
    const elapsed = Date.now() - recent.createdAt.getTime();
    if (elapsed < RESET_COOLDOWN_MS) {
      return { ok: false, message: cooldownMsg(elapsed) };
    }
  }

  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.magicLinkToken.updateMany({
      where: {
        targetUserId: owner.id,
        purpose: "PASSWORD_RESET",
        usedAt: null,
      },
      data: { usedAt: new Date() },
    }),
    prisma.magicLinkToken.create({
      data: {
        token,
        targetUserId: owner.id,
        gymId: businessId,
        purpose: "PASSWORD_RESET",
        expiresAt: new Date(Date.now() + SEVEN_DAYS_MS),
      },
    }),
  ]);

  const lang = owner.locale === "ko" ? "ko" : "en";
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const url = `${proto}://${host}/${lang}/g/${business.slug}/activate?token=${token}`;

  const r = await sendPasswordResetEmail({
    to: owner.email,
    recipientName: owner.name,
    storeName: business.name,
    resetUrl: url,
  });
  if (!r.ok) {
    return {
      ok: false,
      message: "이메일 발송 실패. 잠시 후 다시 시도해 주세요.",
    };
  }
  return { ok: true, emailedTo: owner.email };
}

// 사장 연락처(전화/이메일) 수정 (admin 가맹점 상세).
// 이름/loginId 는 운영 정합성상 read-only — 여기서도 건드리지 않는다.
// GYM 은 stamping 확장 클라이언트로 updatedById 자동 기록, HOTEL 은 cross-DB
// 직접 write (호텔 User 테이블에 헬스장 admin id 없음 → updatedById 미기록).
const contactSchema = z.object({
  vertical: verticalEnum,
  id: z.string().min(1),
  ownerId: z.string().min(1),
  email: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z
      .string()
      .max(200)
      .email("올바른 이메일 형식이 아닙니다")
      .or(z.literal("")),
  ),
  phone: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string().max(40),
  ),
});

export type OwnerContactState = {
  errors?: Record<string, string[] | undefined>;
  message?: string;
  ok?: boolean;
};

export async function updateOwnerContact(
  _prev: OwnerContactState,
  formData: FormData,
): Promise<OwnerContactState> {
  await requireAdmin();
  const parsed = contactSchema.safeParse({
    vertical: parseVertical(formData.get("vertical")),
    id: formData.get("id"),
    ownerId: formData.get("ownerId"),
    email: formData.get("email"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  }
  const { vertical, id, ownerId, email, phone } = parsed.data;
  const emailVal = email.length > 0 ? email : null;
  const phoneVal = phone.length > 0 ? phone : null;

  if (vertical === "HOTEL") {
    const existing = await hotelDb.user.findFirst({
      where: { id: ownerId, hotelId: id, role: "OWNER" },
      select: { id: true },
    });
    if (!existing) return { message: "사장 계정을 찾을 수 없습니다." };
    await hotelDb.user.update({
      where: { id: ownerId },
      data: { email: emailVal, phone: phoneVal },
    });
  } else {
    const existing = await prisma.user.findFirst({
      where: { id: ownerId, gymId: id, role: "OWNER" },
      select: { id: true },
    });
    if (!existing) return { message: "사장 계정을 찾을 수 없습니다." };
    await prisma.user.update({
      where: { id: ownerId },
      data: { email: emailVal, phone: phoneVal },
    });
  }

  revalidatePath(`/admin/businesses/${id}`);
  return { ok: true };
}

async function sendHotelOwnerReset(
  businessId: string,
): Promise<PasswordResetSendResult> {
  const hotelBase = process.env.HOTEL_PUBLIC_BASE_URL?.trim();
  if (!hotelBase) {
    return {
      ok: false,
      message:
        "HOTEL_PUBLIC_BASE_URL 환경변수가 설정되지 않아 호텔 reset URL 을 만들 수 없습니다.",
    };
  }

  const business = await hotelDb.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, slug: true },
  });
  if (!business) return { ok: false, message: "매장을 찾을 수 없습니다." };

  const owner = await hotelDb.user.findFirst({
    where: { hotelId: businessId, role: "OWNER", active: true },
    select: { id: true, name: true, email: true, locale: true },
  });
  if (!owner) return { ok: false, message: "활성 사장 계정이 없습니다." };
  if (!owner.email)
    return { ok: false, message: "사장 이메일이 등록돼 있지 않습니다." };

  const recent = await hotelDb.magicLinkToken.findFirst({
    where: { targetUserId: owner.id, purpose: "PASSWORD_RESET" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (recent) {
    const elapsed = Date.now() - recent.createdAt.getTime();
    if (elapsed < RESET_COOLDOWN_MS) {
      return { ok: false, message: cooldownMsg(elapsed) };
    }
  }

  const token = crypto.randomBytes(32).toString("base64url");
  await hotelDb.$transaction([
    hotelDb.magicLinkToken.updateMany({
      where: {
        targetUserId: owner.id,
        purpose: "PASSWORD_RESET",
        usedAt: null,
      },
      data: { usedAt: new Date() },
    }),
    hotelDb.magicLinkToken.create({
      data: {
        token,
        targetUserId: owner.id,
        hotelId: businessId,
        purpose: "PASSWORD_RESET",
        expiresAt: new Date(Date.now() + SEVEN_DAYS_MS),
      },
    }),
  ]);

  const lang = owner.locale === "ko" ? "ko" : "en";
  const url = `${hotelBase}/${lang}/h/${business.slug}/reset-credentials?token=${token}`;

  const r = await sendPasswordResetEmail({
    to: owner.email,
    recipientName: owner.name,
    storeName: business.name,
    resetUrl: url,
  });
  if (!r.ok) {
    return {
      ok: false,
      message: "이메일 발송 실패. 잠시 후 다시 시도해 주세요.",
    };
  }
  return { ok: true, emailedTo: owner.email };
}

// ─── 커피매니저(카페 사장) 발급 (HOTEL 가맹점 상세) ──────────
// 헬스장 admin 이 호텔 DB(cross-DB)에 User+Staff+MagicLinkToken 을 직접 write 하고
// 카페 사장 이메일로 호텔 reset-credentials 설정 링크를 보낸다. 호텔 코드 추가 0 —
// 호텔 reset 페이지가 STAFF_INVITE 토큰 + role=COFFEE_MANAGER 를 이미 처리한다.
// 호텔당 카페 1개 가정: COFFEE_MANAGER 가 이미 있으면 그 유저 대상으로 재발급(토큰만
// 새로). docs/access.md 의 게스트 출입과 같은 hotelDb 클라이언트 사용.
const coffeeSchema = z.object({
  id: z.string().min(1),
  name: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string().min(1, "카페 사장 이름을 입력해 주세요").max(100),
  ),
  email: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z
      .string()
      .min(1, "이메일을 입력해 주세요")
      .max(200)
      .email("올바른 이메일 형식이 아닙니다"),
  ),
  phone: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string().max(40),
  ),
  // 커피숍 이름 한글/영문 — 둘 다 선택. 호텔 Business.cafeNameKo/En 에 저장.
  cafeNameKo: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string().max(100),
  ),
  cafeNameEn: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string().max(100),
  ),
});

export type CoffeeManagerState = {
  errors?: Record<string, string[] | undefined>;
  message?: string;
  ok?: boolean;
  reissued?: boolean; // 기존 유저 재발급 여부
  mailed?: boolean; // 메일 실제 발송 성공 여부 (false 면 아래 url 복사 전달)
  emailedTo?: string;
  url?: string; // 메일 실패 시 admin 이 복사해 전달할 설정 링크
};

export async function issueCoffeeManager(
  _prev: CoffeeManagerState,
  formData: FormData,
): Promise<CoffeeManagerState> {
  await requireAdmin();
  const parsed = coffeeSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    cafeNameKo: formData.get("cafeNameKo"),
    cafeNameEn: formData.get("cafeNameEn"),
  });
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  }
  const { id: hotelId, name, email } = parsed.data;
  const phone = parsed.data.phone.length > 0 ? parsed.data.phone : null;
  const cafeNameKo =
    parsed.data.cafeNameKo.length > 0 ? parsed.data.cafeNameKo : null;
  const cafeNameEn =
    parsed.data.cafeNameEn.length > 0 ? parsed.data.cafeNameEn : null;

  const hotelBase = process.env.HOTEL_PUBLIC_BASE_URL?.trim();
  if (!hotelBase) {
    return {
      message:
        "HOTEL_PUBLIC_BASE_URL 환경변수가 설정되지 않아 설정 링크를 만들 수 없습니다.",
    };
  }

  const business = await hotelDb.business.findUnique({
    where: { id: hotelId },
    select: { id: true, name: true, slug: true },
  });
  if (!business) return { message: "호텔을 찾을 수 없습니다." };

  // 커피숍 이름(한글/영문) 호텔 Business 에 저장 — 발급/재발급 무관 입력값 반영.
  await hotelDb.business.update({
    where: { id: hotelId },
    data: { cafeNameKo, cafeNameEn },
  });

  // 1) 같은 호텔에 COFFEE_MANAGER 이미 있으면 재발급(유저 중복 생성 금지).
  const existing = await hotelDb.user.findFirst({
    where: { hotelId, role: "COFFEE_MANAGER" },
    select: { id: true },
  });

  let targetUserId: string;
  let reissued: boolean;
  if (existing) {
    // 재발급 — 입력값으로 이름/이메일/전화 갱신 후 그 이메일로 발송(결정 B).
    await hotelDb.user.update({
      where: { id: existing.id },
      data: { name, email, phone },
    });
    targetUserId = existing.id;
    reissued = true;

    // 재발급 10분 쿨다운 — 직전 STAFF_INVITE 발송과 너무 가까우면 차단.
    const recent = await hotelDb.magicLinkToken.findFirst({
      where: { targetUserId, purpose: "STAFF_INVITE" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (recent) {
      const elapsed = Date.now() - recent.createdAt.getTime();
      if (elapsed < RESET_COOLDOWN_MS) {
        return { message: cooldownMsg(elapsed) };
      }
    }
  } else {
    // 2) 신규 User + 3) Staff 생성. loginId/passwordHash 는 카페 사장이 reset 에서
    // 직접 설정하므로 null(default) 유지. status=ACTIVE, active=true (호텔 가드 전제).
    const user = await hotelDb.user.create({
      data: {
        hotelId,
        name,
        email,
        phone,
        role: "COFFEE_MANAGER",
        status: "ACTIVE",
        active: true,
      },
      select: { id: true },
    });
    await hotelDb.staff.create({
      data: { hotelId, userId: user.id, role: "COFFEE_MANAGER" },
    });
    targetUserId = user.id;
    reissued = false;
  }

  // 4) MagicLinkToken(STAFF_INVITE, 7일). 직전 미사용 토큰은 무효화.
  const token = crypto.randomBytes(32).toString("base64url");
  await hotelDb.$transaction([
    hotelDb.magicLinkToken.updateMany({
      where: { targetUserId, purpose: "STAFF_INVITE", usedAt: null },
      data: { usedAt: new Date() },
    }),
    hotelDb.magicLinkToken.create({
      data: {
        token,
        targetUserId,
        hotelId,
        purpose: "STAFF_INVITE",
        expiresAt: new Date(Date.now() + SEVEN_DAYS_MS),
      },
    }),
  ]);

  // 5) reset 링크 (lang=ko 기본). 6) 카페 사장 이메일로 발송.
  const url = `${hotelBase}/ko/h/${business.slug}/reset-credentials?token=${token}`;
  const r = await sendCoffeeManagerInviteEmail({
    to: email,
    recipientName: name,
    hotelName: business.name,
    setupUrl: url,
  });

  revalidatePath(`/admin/businesses/${hotelId}`);
  // 메일 실패해도 row 는 이미 만들어졌으니 url 을 돌려줘 admin 이 복사 전달 가능.
  return {
    ok: true,
    reissued,
    mailed: r.ok,
    emailedTo: email,
    url,
  };
}
