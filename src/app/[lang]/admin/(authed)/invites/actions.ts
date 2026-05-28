"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { hotelDb } from "@/lib/hotel-db";
import { requireAdmin } from "@/lib/auth/dal";
import { sendInviteEmail } from "@/lib/email/resend";

const SEVEN_DAYS_MS = 1000 * 60 * 60 * 24 * 7;

const createSchema = z.object({
  vertical: z.enum(["GYM", "HOTEL"], { message: "업종을 선택해 주세요" }),
  expectedBusinessName: z.string().min(1, "예상 매장명을 입력해 주세요"),
  expectedOwnerEmail: z.string().email("이메일 형식이 올바르지 않습니다"),
  expectedOwnerPhone: z.string().min(1, "사장 전화번호를 입력해 주세요"),
});

type Vertical = "GYM" | "HOTEL";

// HOTEL 발급은 admin/.env 의 HOTEL_PUBLIC_BASE_URL 을 사용. 미설정이면 invite 발급 차단.
async function resolveInviteBaseUrl(
  vertical: Vertical,
): Promise<string | null> {
  if (vertical === "HOTEL") {
    return process.env.HOTEL_PUBLIC_BASE_URL?.trim() || null;
  }
  return await baseUrl();
}

export type CreateInviteState = {
  errors?: Record<string, string[] | undefined>;
  created?: {
    id: string;
    vertical: Vertical;
    url: string;
    ownerEmail: string | null;
    businessName: string;
  };
};

export async function baseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function createInvite(
  _prev: CreateInviteState,
  formData: FormData,
): Promise<CreateInviteState> {
  await requireAdmin();
  const parsed = createSchema.safeParse({
    vertical: formData.get("vertical"),
    expectedBusinessName: formData.get("expectedBusinessName"),
    expectedOwnerEmail: formData.get("expectedOwnerEmail"),
    expectedOwnerPhone: formData.get("expectedOwnerPhone"),
  });
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  }

  const inviteBase = await resolveInviteBaseUrl(parsed.data.vertical);
  if (!inviteBase) {
    return {
      errors: {
        vertical: [
          "HOTEL_PUBLIC_BASE_URL 환경변수가 설정되지 않아 호텔 invite 를 발급할 수 없습니다.",
        ],
      },
    };
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SEVEN_DAYS_MS);

  // HOTEL invite 는 호텔 DB 의 InviteToken 에 write (호텔 register 페이지가 호텔 DB lookup).
  // GYM invite 는 헬스장 DB 의 InviteToken 에 vertical 포함해 write.
  let createdId: string;
  let createdBusinessName: string;
  let createdOwnerEmail: string | null;

  if (parsed.data.vertical === "HOTEL") {
    const created = await hotelDb.inviteToken.create({
      data: {
        token,
        expectedBusinessName: parsed.data.expectedBusinessName,
        expectedOwnerEmail: parsed.data.expectedOwnerEmail,
        expectedOwnerPhone: parsed.data.expectedOwnerPhone,
        expiresAt,
      },
    });
    createdId = created.id;
    createdBusinessName = created.expectedBusinessName ?? "";
    createdOwnerEmail = created.expectedOwnerEmail;
  } else {
    const created = await prisma.inviteToken.create({
      data: {
        token,
        vertical: parsed.data.vertical,
        expectedBusinessName: parsed.data.expectedBusinessName,
        expectedOwnerEmail: parsed.data.expectedOwnerEmail,
        expectedOwnerPhone: parsed.data.expectedOwnerPhone,
        expiresAt,
      },
    });
    createdId = created.id;
    createdBusinessName = created.expectedBusinessName ?? "";
    createdOwnerEmail = created.expectedOwnerEmail;
  }

  const url = `${inviteBase}/ko/register?token=${token}`;
  revalidatePath("/admin/invites");
  return {
    created: {
      id: createdId,
      vertical: parsed.data.vertical,
      url,
      ownerEmail: createdOwnerEmail,
      businessName: createdBusinessName,
    },
  };
}

function parseVertical(value: FormDataEntryValue | null): Vertical {
  return value === "HOTEL" ? "HOTEL" : "GYM";
}

export async function emailInvite(
  formData: FormData,
): Promise<{ ok?: boolean; message?: string }> {
  await requireAdmin();
  const tokenId = String(formData.get("tokenId") ?? "");
  const vertical = parseVertical(formData.get("vertical"));

  const invite =
    vertical === "HOTEL"
      ? await hotelDb.inviteToken.findUnique({ where: { id: tokenId } })
      : await prisma.inviteToken.findUnique({ where: { id: tokenId } });

  if (!invite) return { message: "Invite를 찾을 수 없습니다." };
  if (!invite.expectedOwnerEmail) {
    return {
      message:
        "이 invite에 사장 이메일이 없습니다. URL을 직접 복사해 메신저로 전달하세요.",
    };
  }
  if (invite.usedAt || invite.revokedAt) {
    return { message: "이미 사용·회수된 invite입니다." };
  }

  const inviteBase = await resolveInviteBaseUrl(vertical);
  if (!inviteBase) {
    return {
      message:
        "HOTEL_PUBLIC_BASE_URL 환경변수가 설정되지 않아 호텔 invite URL 을 생성할 수 없습니다.",
    };
  }
  const url = `${inviteBase}/ko/register?token=${invite.token}`;
  const result = await sendInviteEmail({
    to: invite.expectedOwnerEmail,
    inviteUrl: url,
    expectedBusinessName: invite.expectedBusinessName,
  });

  if ("fallback" in result && result.fallback) {
    return {
      message:
        "RESEND_API_KEY 미설정 — 콘솔 로그에 URL을 출력했습니다. URL을 직접 복사해 전달해 주세요.",
    };
  }
  if (!result.ok) {
    return {
      message: `발송 실패: ${"error" in result ? result.error : "unknown"}`,
    };
  }
  return { ok: true };
}

export async function revokeInvite(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const vertical = parseVertical(formData.get("vertical"));

  if (vertical === "HOTEL") {
    await hotelDb.inviteToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  } else {
    await prisma.inviteToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }
  revalidatePath("/admin/invites");
}

// docs/admin.md: expired (만료 + 미사용 + 미회수) 만 lazy 삭제. used/revoked 는 영구 audit.
// 두 DB (헬스장 + 호텔) 모두 정리.
export async function cleanupExpiredInvites(): Promise<number> {
  const where = {
    expiresAt: { lt: new Date() },
    usedAt: null,
    revokedAt: null,
  };
  const [gym, hotel] = await Promise.all([
    prisma.inviteToken.deleteMany({ where }),
    hotelDb.inviteToken.deleteMany({ where }),
  ]);
  return gym.count + hotel.count;
}
