"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { verifyPassword } from "@/lib/auth/password";
import { issueSession } from "@/lib/auth/session";

const schema = z.object({
  slug: z.string().min(1),
  // 대소문자·앞뒤 공백 정규화 — DB의 etcrrrtt@gmail.com과 사용자가 친 ETCRRRTT@gmail.com 매치
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("이메일 형식이 올바르지 않습니다"),
  password: z.string().min(1, "비밀번호를 입력해 주세요"),
  rememberMe: z.string().nullish(),
});

export type GymLoginState = {
  errors?: Record<string, string[] | undefined>;
  message?: "wrong" | "notMember" | "pending" | "withdrawn";
};

export async function gymLogin(
  _prev: GymLoginState,
  formData: FormData,
): Promise<GymLoginState> {
  const parsed = schema.safeParse({
    slug: formData.get("slug"),
    email: formData.get("email"),
    password: formData.get("password"),
    rememberMe: formData.get("rememberMe"),
  });
  if (!parsed.success) {
    console.error("[gymLogin] schema invalid:", parsed.error.flatten());
    return {
      errors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  }
  const { slug, email, password, rememberMe } = parsed.data;

  const business = await prisma.business.findUnique({ where: { slug } });
  if (!business) {
    console.error("[gymLogin] business not found:", { slug });
    return { message: "notMember" };
  }

  const user = await prisma.user.findUnique({
    where: { email_gymId: { email, gymId: business.id } },
  });
  if (!user) {
    console.error("[gymLogin] user not found:", {
      slug,
      gymId: business.id,
      email,
    });
    return { message: "notMember" };
  }
  if (!user.passwordHash) {
    console.error("[gymLogin] passwordHash missing:", {
      userId: user.id,
      email,
      status: user.status,
    });
    return { message: "notMember" };
  }
  if (user.status === "PENDING") return { message: "pending" };
  if (user.status === "WITHDRAWN" || user.status === "ANONYMIZED") {
    return { message: "withdrawn" };
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    console.error("[gymLogin] password mismatch:", {
      userId: user.id,
      email,
    });
    return { message: "wrong" };
  }

  await issueSession(user.id, user.role, rememberMe === "on");
  const target =
    user.role === "CUSTOMER"
      ? `/g/${slug}/me`
      : `/g/${slug}/dashboard`;
  redirect(target);
}
