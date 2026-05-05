"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { verifyPassword } from "@/lib/auth/password";
import { issueSession } from "@/lib/auth/session";

const schema = z.object({
  email: z.string().email("이메일 형식이 올바르지 않습니다"),
  password: z.string().min(1, "비밀번호를 입력해 주세요"),
  // Unchecked checkboxes deliver null, not undefined — accept both.
  rememberMe: z.string().nullish(),
});

export type AdminLoginState = {
  errors?: Record<string, string[] | undefined>;
  message?: string;
};

export async function adminLogin(
  _prev: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    rememberMe: formData.get("rememberMe"),
  });
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  }

  const expected = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (
    expected &&
    parsed.data.email.trim().toLowerCase() !== expected
  ) {
    return { message: "이 이메일은 관리자가 아닙니다." };
  }

  const admin = await prisma.user.findFirst({
    where: { email: parsed.data.email, gymId: null, role: "ADMIN" },
  });
  if (!admin || !admin.passwordHash) {
    return { message: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }
  const ok = await verifyPassword(parsed.data.password, admin.passwordHash);
  if (!ok) {
    return { message: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }

  await issueSession(admin.id, "ADMIN", parsed.data.rememberMe === "on");
  redirect("/admin/invites");
}
