"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";
import { issueSession } from "@/lib/auth/session";
import { normalizeLoginId, LOGIN_ID_PATTERN } from "@/lib/auth/normalize";

const schema = z
  .object({
    slug: z.string().min(1),
    token: z.string().min(1),
    loginId: z
      .string()
      .transform(normalizeLoginId)
      .pipe(
        z
          .string()
          .regex(
            LOGIN_ID_PATTERN,
            "아이디는 영문/숫자/언더스코어/하이픈 3-30자입니다",
          ),
      ),
    password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다"),
    passwordConfirm: z.string().min(1),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: "비밀번호가 일치하지 않습니다",
    path: ["passwordConfirm"],
  });

export type ActivateState = {
  errors?: Record<string, string[] | undefined>;
  message?: string;
};

export async function activateAccount(
  _prev: ActivateState,
  formData: FormData,
): Promise<ActivateState> {
  const parsed = schema.safeParse({
    slug: formData.get("slug"),
    token: formData.get("token"),
    loginId: formData.get("loginId"),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
  });
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  }
  const { slug, token, loginId, password } = parsed.data;

  const link = await prisma.magicLinkToken.findUnique({
    where: { token },
    include: { targetUser: true, business: true },
  });
  if (!link) return { message: "잘못된 링크입니다" };
  if (link.usedAt) return { message: "이미 사용된 링크입니다" };
  if (link.expiresAt < new Date()) return { message: "만료된 링크입니다" };
  if (
    link.purpose !== "SIGNUP_ACTIVATION" &&
    link.purpose !== "STAFF_INVITE" &&
    link.purpose !== "PASSWORD_RESET"
  )
    return { message: "잘못된 링크 종류입니다" };
  if (!link.business || link.business.slug !== slug) {
    return { message: "매장 정보 불일치" };
  }

  // loginId 매장 내 중복 재검증 (디바운스 클라 검증과 실제 submit 사이 race).
  const dup = await prisma.user.findUnique({
    where: { loginId_gymId: { loginId, gymId: link.business.id } },
    select: { id: true },
  });
  if (dup && dup.id !== link.targetUserId) {
    return { errors: { loginId: ["이미 사용 중인 아이디입니다"] } };
  }

  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: link.targetUserId },
      data: { loginId, passwordHash, status: "ACTIVE" },
    }),
    prisma.magicLinkToken.update({
      where: { id: link.id },
      data: { usedAt: new Date() },
    }),
  ]);

  await issueSession(link.targetUser.id, link.targetUser.role, false);
  // 역할별 진입점 분기: 사장/매니저/트레이너는 dashboard, 회원은 회원증
  const role = link.targetUser.role;
  const target =
    role === "OWNER" || role === "MANAGER" || role === "TRAINER"
      ? `/ko/g/${slug}/dashboard`
      : `/ko/g/${slug}/me`;
  redirect(target);
}
