"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";
import { issueSession } from "@/lib/auth/session";
import { sendWelcomeEmail } from "@/lib/email/resend";

const RESERVED_SLUGS = new Set([
  "admin",
  "g",
  "api",
  "register",
  "login",
  "forgot",
  "activate",
  "dashboard",
  "me",
  "static",
  "_next",
  "_vercel",
]);

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const schema = z
  .object({
    token: z.string().min(1),
    storeName: z.string().min(1, "매장명을 입력해 주세요"),
    slug: z
      .string()
      .min(2, "2자 이상 입력해 주세요")
      .max(40, "너무 깁니다")
      .regex(SLUG_RE, "영문/숫자/하이픈만 사용 (양 끝 하이픈 X)")
      .refine((s) => !RESERVED_SLUGS.has(s), "예약된 슬러그입니다"),
    storePhone: z.string().min(1, "매장 전화번호를 입력해 주세요"),
    category: z.enum(["GYM", "MASSAGE"], {
      message: "업종을 선택해 주세요",
    }),
    cityId: z.string().min(1, "시를 선택해 주세요"),
    barangayId: z.string().min(1, "동을 선택해 주세요"),
    ownerName: z.string().min(1, "이름을 입력해 주세요"),
    ownerEmail: z.string().email("이메일 형식이 올바르지 않습니다"),
    ownerPhone: z.string().min(1, "전화번호를 입력해 주세요"),
    ownerPassword: z.string().min(6, "6자 이상 입력해 주세요"),
    ownerPasswordConfirm: z.string(),
  })
  .refine((d) => d.ownerPassword === d.ownerPasswordConfirm, {
    path: ["ownerPasswordConfirm"],
    message: "비밀번호가 일치하지 않습니다",
  });

export type RegisterState = {
  errors?: Record<string, string[] | undefined>;
  message?: string;
};

export type SlugCheck =
  | { available: true }
  | { available: false; reason: "format" | "reserved" | "taken" };

export async function checkSlug(slug: string): Promise<SlugCheck> {
  const trimmed = (slug ?? "").trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 40) {
    return { available: false, reason: "format" };
  }
  if (!SLUG_RE.test(trimmed)) {
    return { available: false, reason: "format" };
  }
  if (RESERVED_SLUGS.has(trimmed)) {
    return { available: false, reason: "reserved" };
  }
  const taken = await prisma.business.findUnique({ where: { slug: trimmed } });
  return taken ? { available: false, reason: "taken" } : { available: true };
}

const TRIAL_MS = 1000 * 60 * 60 * 24 * 90; // 3 months free trial

export async function registerBusiness(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  }
  const d = parsed.data;

  const invite = await prisma.inviteToken.findUnique({
    where: { token: d.token },
  });
  if (!invite) return { message: "초대 링크를 찾을 수 없습니다." };
  if (invite.usedAt)
    return { message: "이미 사용된 초대 링크입니다. 관리자에게 다시 요청해 주세요." };
  if (invite.revokedAt) return { message: "회수된 초대 링크입니다." };
  if (invite.expiresAt < new Date()) {
    return {
      message: "초대 링크가 만료되었습니다. 관리자에게 재발급을 요청해 주세요.",
    };
  }

  const slugTaken = await prisma.business.findUnique({
    where: { slug: d.slug },
  });
  if (slugTaken) {
    return { errors: { slug: ["이미 사용 중인 슬러그입니다"] } };
  }

  const city = await prisma.city.findUnique({ where: { id: d.cityId } });
  const barangay = await prisma.barangay.findUnique({
    where: { id: d.barangayId },
  });
  if (!city || !barangay || barangay.cityId !== city.id) {
    return { message: "시·동 정보가 올바르지 않습니다." };
  }

  const passwordHash = await hashPassword(d.ownerPassword);
  const trialStart = new Date();
  const trialEnd = new Date(trialStart.getTime() + TRIAL_MS);

  let ownerUserId = "";
  let businessSlug = "";

  try {
    const result = await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          slug: d.slug,
          name: d.storeName,
          category: d.category,
          phone: d.storePhone,
          cityId: city.id,
          barangayId: barangay.id,
          status: "TRIAL",
        },
      });

      const owner = await tx.user.create({
        data: {
          gymId: business.id,
          email: d.ownerEmail,
          passwordHash,
          name: d.ownerName,
          phone: d.ownerPhone,
          role: "OWNER",
          status: "ACTIVE",
        },
      });

      await tx.staff.create({
        data: {
          gymId: business.id,
          userId: owner.id,
          role: "OWNER",
        },
      });

      await tx.subscription.create({
        data: {
          gymId: business.id,
          plan: "TRIAL",
          startDate: trialStart,
          endDate: trialEnd,
        },
      });

      await tx.businessNotificationSetting.create({
        data: {
          gymId: business.id,
          channel: "PUSH",
        },
      });

      await tx.inviteToken.update({
        where: { id: invite.id },
        data: {
          usedAt: new Date(),
          createdBusinessId: business.id,
        },
      });

      return { ownerId: owner.id, slug: business.slug };
    });
    ownerUserId = result.ownerId;
    businessSlug = result.slug;
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { errors: { slug: ["이미 사용 중인 슬러그입니다"] } };
    }
    console.error("[register] transaction error:", err);
    return { message: "매장 등록 중 오류가 발생했습니다." };
  }

  // Welcome email — best-effort. Registration is already committed; if SMTP
  // fails the owner can still log in, the email is just a convenience for
  // recovering the studio URL later. So we swallow errors.
  try {
    const h = await headers();
    const host = h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? "http";
    const base = `${proto}://${host}`;
    await sendWelcomeEmail({
      to: d.ownerEmail,
      storeName: d.storeName,
      ownerName: d.ownerName,
      publicUrl: `${base}/ko/g/${businessSlug}`,
      loginUrl: `${base}/ko/g/${businessSlug}/login`,
      dashboardUrl: `${base}/ko/g/${businessSlug}/dashboard`,
    });
  } catch (err) {
    console.error("[register] welcome email failed:", err);
  }

  await issueSession(ownerUserId, "OWNER");
  redirect(`/g/${businessSlug}/dashboard`);
}
