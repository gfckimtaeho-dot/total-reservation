"use server";

import crypto from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import {
  sendCustomerActivationEmail,
  sendPasswordResetEmail,
  sendMemberLoginUrlEmail,
} from "@/lib/email/resend";

const ROLE_KEY = {
  OWNER: "roleOwner",
  MANAGER: "roleManager",
  TRAINER: "roleTrainer",
  CUSTOMER: "roleCustomer",
  ADMIN: "roleManager",
} as const;

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
  // 등록 시 선택한 모국어 → User.locale. 기본 영어(폼 기본 선택값과 일치).
  locale: z.enum(["ko", "en"]).default("en"),
});

// 수정은 등록보다 느슨하게: 기존 임포트 고객은 phone 이 없을 수 있다
// (User.phone 은 스키마상 nullable). 등록 시엔 프런트가 받으므로 strict 유지,
// 수정에서만 phone 을 optional 로 완화 — 안 그러면 phone 없는 회원은
// 언어만 바꾸려 해도 저장이 막힌다(이번 박서연 케이스).
const updateSchema = createSchema.extend({
  memberId: z.string().min(1),
  phone: z.string().optional().or(z.literal("")),
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
    locale: formData.get("locale") ?? "en",
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
    locale,
  } = parsed.data;

  const auth = await requireGymStaff(slug);
  const gymId = auth.business!.id;

  const te = await getTranslations("errors");

  const existing = await prisma.user.findFirst({
    where: { gymId, phone },
    select: { id: true, role: true, name: true },
  });
  if (existing) {
    return {
      errors: {
        phone: [
          te("phoneTakenBy", {
            role: te(ROLE_KEY[existing.role]),
            name: existing.name,
          }),
        ],
      },
    };
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
      locale,
    },
    select: { id: true },
  });

  revalidatePath(`/ko/g/${slug}/members`);
  revalidatePath(`/en/g/${slug}/members`);
  return { success: { id: created.id } };
}

export async function updateMember(
  _prev: CreateMemberState,
  formData: FormData,
): Promise<CreateMemberState> {
  const parsed = updateSchema.safeParse({
    memberId: formData.get("memberId"),
    slug: formData.get("slug"),
    name: formData.get("name"),
    gender: formData.get("gender"),
    phone: formData.get("phone"),
    email: formData.get("email") ?? "",
    dob: formData.get("dob") ?? "",
    note: formData.get("note") ?? "",
    emergencyContactPhone: formData.get("emergencyContactPhone") ?? "",
    locale: formData.get("locale") ?? "en",
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
    memberId,
    slug,
    name,
    gender,
    phone,
    email,
    dob,
    note,
    emergencyContactPhone,
    locale,
  } = parsed.data;

  const auth = await requireGymStaff(slug);
  const gymId = auth.business!.id;

  const te = await getTranslations("errors");

  // 수정 대상이 이 매장의 고객인지 확인 (다른 매장/역할 보호)
  const target = await prisma.user.findFirst({
    where: { id: memberId, gymId, role: "CUSTOMER" },
    select: { id: true },
  });
  if (!target) {
    return { errors: { name: ["회원을 찾을 수 없습니다"] } };
  }

  // 본인 제외 중복 검사 (phone 이 있을 때만 — 수정은 phone optional)
  if (phone) {
    const phoneClash = await prisma.user.findFirst({
      where: { gymId, phone, NOT: { id: memberId } },
      select: { id: true, role: true, name: true },
    });
    if (phoneClash) {
      return {
        errors: {
          phone: [
            te("phoneTakenBy", {
              role: te(ROLE_KEY[phoneClash.role]),
              name: phoneClash.name,
            }),
          ],
        },
      };
    }
  }

  await prisma.user.update({
    where: { id: memberId },
    data: {
      name,
      gender,
      phone: phone ? phone : null,
      email: email ? email : null,
      dob: dob ? new Date(dob) : null,
      note: note ? note : null,
      emergencyContactPhone: emergencyContactPhone
        ? emergencyContactPhone
        : null,
      locale,
    },
  });

  revalidatePath(`/ko/g/${slug}/members`);
  revalidatePath(`/en/g/${slug}/members`);
  return { success: { id: memberId } };
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
  // 활성화 URL prefix 는 발급 대상의 모국어로. 회원이 영어로 등록됐다면
  // 활성화 페이지부터 영어 UI 로 보여야 자연스러움.
  const target = await prisma.user.findUnique({
    where: { id: memberId },
    select: { locale: true },
  });
  const lang = target?.locale === "ko" ? "ko" : "en";
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}/${lang}/g/${slug}/activate?token=${token}`;
}

export type SendActivationResult =
  | { ok: true; url: string; emailedTo?: string }
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

// 활성 회원에게 로그인 화면 링크 메일 — 토큰 없이 그냥 로그인 페이지 URL + 아이디
// 안내. 회원 행의 "로그인 URL 메일" 버튼이 호출. 활성 + 이메일 보유 회원만.
export async function sendLoginUrlEmail(
  formData: FormData,
): Promise<SendActivationResult> {
  const slug = String(formData.get("slug") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const auth = await requireGymStaff(slug);
  const gymId = auth.business!.id;

  const member = await prisma.user.findFirst({
    where: { id: memberId, gymId, role: "CUSTOMER" },
    select: {
      name: true,
      email: true,
      locale: true,
      loginId: true,
      status: true,
      business: { select: { name: true } },
    },
  });
  if (!member) return { ok: false, message: "회원을 찾을 수 없습니다" };
  if (member.status !== "ACTIVE" || !member.loginId) {
    return {
      ok: false,
      message: "활성화된 회원에게만 로그인 링크를 보낼 수 있습니다",
    };
  }
  if (!member.email) {
    return {
      ok: false,
      message: "이메일이 없는 회원입니다.",
    };
  }

  const lang = member.locale === "ko" ? "ko" : "en";
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const url = `${proto}://${host}/${lang}/g/${slug}/login`;

  const result = await sendMemberLoginUrlEmail({
    to: member.email,
    recipientName: member.name,
    storeName: member.business?.name ?? "",
    loginId: member.loginId,
    loginUrl: url,
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
  return { ok: true, url, emailedTo: member.email };
}

// 트레이너 intake 화면에서 이메일 없는 PENDING 회원 전용 — 트레이너가 본인
// 폰으로 회원에게 SMS/카톡 전달하려는 흐름. PENDING + email=null 조건 만족
// 시에만 URL 반환, 그 외 (ACTIVE, 이메일 있음) 면 null 로 화면 숨김.
export async function getIntakePendingActivationUrl(
  formData: FormData,
): Promise<string | null> {
  const slug = String(formData.get("slug") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const auth = await requireGymStaff(slug);
  const gymId = auth.business!.id;

  const member = await prisma.user.findFirst({
    where: {
      id: memberId,
      gymId,
      role: "CUSTOMER",
      status: "PENDING",
      email: null,
    },
    select: { id: true },
  });
  if (!member) return null;

  return await buildActivationUrl(slug, member.id, gymId);
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

// 비번 재설정 URL 발급 — ACTIVE 회원이 비번 잊은 케이스. 사장이 admin 화면에서
// 발급 후 회원에게 카톡/문자 등으로 URL 전달. 이메일 있으면 자동 발송은 별도
// 흐름(/forgot 미구현). 멱등성 위해 같은 회원 재발급 시 이전 PASSWORD_RESET
// 토큰들 일괄 무효화 후 새 토큰 발급.
export async function copyPasswordResetUrl(
  formData: FormData,
): Promise<SendActivationResult> {
  const slug = String(formData.get("slug") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const auth = await requireGymStaff(slug);
  const gymId = auth.business!.id;

  const member = await prisma.user.findFirst({
    where: { id: memberId, gymId, role: "CUSTOMER" },
    select: {
      id: true,
      name: true,
      email: true,
      locale: true,
      status: true,
      business: { select: { name: true } },
    },
  });
  if (!member) return { ok: false, message: "회원을 찾을 수 없습니다" };
  // PENDING 회원은 비번 자체가 없음 — 비번 재설정 의미 X. 활성화 URL 사용.
  if (member.status !== "ACTIVE") {
    return {
      ok: false,
      message: "활성화된 회원에게만 비번 재설정 URL 발급 가능합니다",
    };
  }

  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.magicLinkToken.updateMany({
      where: {
        targetUserId: member.id,
        purpose: "PASSWORD_RESET",
        usedAt: null,
      },
      data: { usedAt: new Date() },
    }),
    prisma.magicLinkToken.create({
      data: {
        token,
        targetUserId: member.id,
        gymId,
        purpose: "PASSWORD_RESET",
        expiresAt: new Date(Date.now() + SEVEN_DAYS_MS),
      },
    }),
  ]);
  // 재설정 페이지도 발급 대상의 모국어 prefix — 회원이 영문 화면을 보게.
  const lang = member.locale === "ko" ? "ko" : "en";
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const url = `${proto}://${host}/${lang}/g/${slug}/activate?token=${token}`;

  // 이메일 있으면 자동 발송. 실패해도 URL fallback.
  let emailedTo: string | undefined;
  if (member.email) {
    const r = await sendPasswordResetEmail({
      to: member.email,
      recipientName: member.name,
      storeName: member.business?.name ?? "",
      resetUrl: url,
    });
    if (r.ok) emailedTo = member.email;
  }

  return { ok: true, url, emailedTo };
}

// 하드 삭제 폐기 — 매출/예약 이력 보존 위해 활성/비활성 토글로 대체.
export async function setMemberActive(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  const auth = await requireGymStaff(slug);
  const gymId = auth.business!.id;

  await prisma.user.updateMany({
    where: { id: memberId, gymId, role: "CUSTOMER" },
    data: { active },
  });
  // 비활성 시 발급돼 있던 임시 출입 토큰 즉시 무효화(QR 삭제).
  // 재활성은 별도 처리 불필요 — 다음 출입 QR 요청 시 새로 발급된다.
  if (!active) {
    await prisma.qrToken.deleteMany({ where: { userId: memberId, gymId } });
  }
  revalidatePath(`/ko/g/${slug}/members`);
  revalidatePath(`/en/g/${slug}/members`);
  revalidatePath(`/ko/g/${slug}/members/${memberId}`);
  revalidatePath(`/en/g/${slug}/members/${memberId}`);
}
