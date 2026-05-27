"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { normalizePassword } from "@/lib/auth/normalize";

// ── 기본 정보 (이메일/전화/모국어) ─────────────────────
// 이름·아이디는 read-only — 운영 정합성/감사 추적 위해 본인 self-service 변경 금지.

const basicSchema = z.object({
  slug: z.string().min(1),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("이메일 형식이 올바르지 않습니다")
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  locale: z.enum(["ko", "en"]),
});

export type UpdateBasicState = {
  errors?: Record<string, string[] | undefined>;
  message?: string;
  success?: boolean;
};

export async function updateMyBasic(
  _prev: UpdateBasicState,
  formData: FormData,
): Promise<UpdateBasicState> {
  const parsed = basicSchema.safeParse({
    slug: formData.get("slug"),
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    locale: formData.get("locale"),
  });
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  }
  const d = parsed.data;

  const auth = await requireGymStaff(d.slug);

  await prisma.user.update({
    where: { id: auth.id },
    data: {
      email: d.email ? d.email : null,
      phone: d.phone ? d.phone : null,
      locale: d.locale,
    },
  });

  // 모국어 변경 시 NEXT_LOCALE 쿠키도 갱신 — 다음 navigation 부터 즉시 UI 언어 반영.
  const cookieStore = await cookies();
  cookieStore.set("NEXT_LOCALE", d.locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  revalidatePath(`/ko/g/${d.slug}/settings/account`);
  revalidatePath(`/en/g/${d.slug}/settings/account`);
  return { success: true };
}

// ── 비밀번호 변경 ─────────────────────────────────────────────

const passwordSchema = z
  .object({
    slug: z.string().min(1),
    currentPassword: z.string().transform(normalizePassword).pipe(z.string().min(1, "현재 비밀번호를 입력해 주세요")),
    newPassword: z.string().transform(normalizePassword).pipe(z.string().min(6, "새 비밀번호는 6자 이상이어야 합니다")),
    newPasswordConfirm: z.string().min(1),
  })
  .refine((d) => d.newPassword === d.newPasswordConfirm, {
    message: "errNewPwConfirm",
    path: ["newPasswordConfirm"],
  });

export type ChangePasswordState = {
  errors?: Record<string, string[] | undefined>;
  message?: string;
  success?: boolean;
};

export async function changeMyPassword(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const parsed = passwordSchema.safeParse({
    slug: formData.get("slug"),
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    newPasswordConfirm: formData.get("newPasswordConfirm"),
  });
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  }
  const d = parsed.data;

  const auth = await requireGymStaff(d.slug);

  const user = await prisma.user.findUnique({
    where: { id: auth.id },
    select: { passwordHash: true },
  });
  if (!user?.passwordHash) {
    return { message: "비밀번호가 설정되지 않은 계정입니다" };
  }

  const ok = await verifyPassword(d.currentPassword, user.passwordHash);
  if (!ok) {
    return { errors: { currentPassword: ["errCurrentPw"] } };
  }

  const passwordHash = await hashPassword(d.newPassword);
  await prisma.user.update({
    where: { id: auth.id },
    data: { passwordHash },
  });

  return { success: true };
}
