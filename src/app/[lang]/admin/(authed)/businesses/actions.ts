"use server";

import crypto from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { hotelDb } from "@/lib/hotel-db";
import { requireAdmin } from "@/lib/auth/dal";
import { sendPasswordResetEmail } from "@/lib/email/resend";

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
