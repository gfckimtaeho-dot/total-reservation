"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";
import { issueSession } from "@/lib/auth/session";

const schema = z
  .object({
    slug: z.string().min(1),
    token: z.string().min(1),
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
  const { slug, token, password } = parsed.data;

  const link = await prisma.magicLinkToken.findUnique({
    where: { token },
    include: { targetUser: true, business: true },
  });
  if (!link) return { message: "잘못된 링크입니다" };
  if (link.usedAt) return { message: "이미 사용된 링크입니다" };
  if (link.expiresAt < new Date()) return { message: "만료된 링크입니다" };
  if (link.purpose !== "SIGNUP_ACTIVATION")
    return { message: "잘못된 링크 종류입니다" };
  if (!link.business || link.business.slug !== slug) {
    return { message: "매장 정보 불일치" };
  }

  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: link.targetUserId },
      data: { passwordHash, status: "ACTIVE" },
    }),
    prisma.magicLinkToken.update({
      where: { id: link.id },
      data: { usedAt: new Date() },
    }),
  ]);

  await issueSession(link.targetUser.id, link.targetUser.role, false);
  redirect(`/ko/g/${slug}/me`);
}
