"use server";

import crypto from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { sendCustomerActivationEmail } from "@/lib/email/resend";

const SEVEN_DAYS_MS = 1000 * 60 * 60 * 24 * 7;

const createSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1, "이름을 입력해 주세요"),
  gender: z.enum(["MALE", "FEMALE"]).default("MALE"),
  phone: z.string().min(1, "핸드폰 번호를 입력해 주세요"),
  email: z
    .string()
    .email("이메일 형식이 올바르지 않습니다")
    .optional()
    .or(z.literal("")),
  dob: z.string().optional().or(z.literal("")),
  note: z.string().optional().or(z.literal("")),
  emergencyContactPhone: z.string().optional().or(z.literal("")),
});

export type CreateMemberState = {
  errors?: Record<string, string[] | undefined>;
  success?: { id: string };
};

export async function createMember(
  _prev: CreateMemberState,
  formData: FormData,
): Promise<CreateMemberState> {
  const parsed = createSchema.safeParse({
    slug: formData.get("slug"),
    name: formData.get("name"),
    gender: formData.get("gender"),
    phone: formData.get("phone"),
    email: formData.get("email") ?? "",
    dob: formData.get("dob") ?? "",
    note: formData.get("note") ?? "",
    emergencyContactPhone: formData.get("emergencyContactPhone") ?? "",
  });
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  }
  const {
    slug,
    name,
    gender,
    phone,
    email,
    dob,
    note,
    emergencyContactPhone,
  } = parsed.data;

  const auth = await requireGymStaff(slug);
  const gymId = auth.business!.id;

  const existing = await prisma.user.findFirst({
    where: { gymId, phone },
    select: { id: true },
  });
  if (existing) {
    return { errors: { phone: ["이미 등록된 핸드폰 번호입니다"] } };
  }

  if (email) {
    const existingEmail = await prisma.user.findFirst({
      where: { gymId, email },
      select: { id: true },
    });
    if (existingEmail) {
      return { errors: { email: ["이미 등록된 이메일입니다"] } };
    }
  }

  const created = await prisma.user.create({
    data: {
      gymId,
      name,
      gender,
      phone,
      email: email ? email : null,
      dob: dob ? new Date(dob) : null,
      note: note ? note : null,
      emergencyContactPhone: emergencyContactPhone
        ? emergencyContactPhone
        : null,
      role: "CUSTOMER",
      status: "PENDING",
    },
    select: { id: true },
  });

  revalidatePath(`/ko/g/${slug}/members`);
  revalidatePath(`/en/g/${slug}/members`);
  return { success: { id: created.id } };
}

async function buildActivationUrl(
  slug: string,
  memberId: string,
  gymId: string,
): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.magicLinkToken.create({
    data: {
      token,
      targetUserId: memberId,
      gymId,
      purpose: "SIGNUP_ACTIVATION",
      expiresAt: new Date(Date.now() + SEVEN_DAYS_MS),
    },
  });
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}/ko/g/${slug}/activate?token=${token}`;
}

export type SendActivationResult =
  | { ok: true; url: string }
  | { ok: false; message: string };

export async function sendActivationEmail(
  formData: FormData,
): Promise<SendActivationResult> {
  const slug = String(formData.get("slug") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const auth = await requireGymStaff(slug);
  const gymId = auth.business!.id;

  const member = await prisma.user.findFirst({
    where: { id: memberId, gymId, role: "CUSTOMER" },
    include: { business: { select: { name: true } } },
  });
  if (!member) return { ok: false, message: "회원을 찾을 수 없습니다" };
  if (!member.email)
    return {
      ok: false,
      message: "이메일이 없는 회원입니다. URL 복사로 카톡·SMS 전달하세요.",
    };

  const url = await buildActivationUrl(slug, member.id, gymId);
  const result = await sendCustomerActivationEmail({
    to: member.email,
    memberName: member.name,
    storeName: member.business?.name ?? "",
    activateUrl: url,
  });

  if ("fallback" in result && result.fallback) {
    return {
      ok: false,
      message:
        "Gmail 자격증명 미설정 — Vercel env에 GMAIL_USER/GMAIL_APP_PASSWORD 추가하세요",
    };
  }
  if (!result.ok) {
    return {
      ok: false,
      message: `발송 실패: ${"error" in result ? result.error : "unknown"}`,
    };
  }
  revalidatePath(`/ko/g/${slug}/members`);
  return { ok: true, url };
}

export async function copyActivationUrl(
  formData: FormData,
): Promise<SendActivationResult> {
  const slug = String(formData.get("slug") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const auth = await requireGymStaff(slug);
  const gymId = auth.business!.id;

  const member = await prisma.user.findFirst({
    where: { id: memberId, gymId, role: "CUSTOMER" },
    select: { id: true },
  });
  if (!member) return { ok: false, message: "회원을 찾을 수 없습니다" };

  const url = await buildActivationUrl(slug, member.id, gymId);
  return { ok: true, url };
}

export async function deleteMember(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const auth = await requireGymStaff(slug);
  const gymId = auth.business!.id;

  await prisma.user.deleteMany({
    where: { id: memberId, gymId, role: "CUSTOMER" },
  });
  revalidatePath(`/ko/g/${slug}/members`);
  revalidatePath(`/en/g/${slug}/members`);
}
