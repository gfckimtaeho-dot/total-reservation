"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { verifyPassword } from "@/lib/auth/password";
import { issueSession } from "@/lib/auth/session";

const schema = z.object({
  email: z.string().email("이메일 형식이 올바르지 않습니다"),
  password: z.string().min(1, "비밀번호를 입력해 주세요"),
  rememberMe: z.string().nullish(),
});

export type LoginState = {
  errors?: Record<string, string[] | undefined>;
  message?: "wrong" | "pending" | "withdrawn";
};

export async function unifiedLogin(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
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
  const { email, password, rememberMe } = parsed.data;

  // Pull every gym-scoped user with this email and try the password against each.
  // Two studios can share an email (multi-tenant by design) but it's rare for a
  // single person to use the SAME password across studios.
  const candidates = await prisma.user.findMany({
    where: { email, gymId: { not: null } },
    include: { business: true },
    orderBy: { createdAt: "desc" },
  });

  const verified = [];
  for (const u of candidates) {
    if (!u.passwordHash || !u.business) continue;
    if (await verifyPassword(password, u.passwordHash)) {
      verified.push(u);
    }
  }

  if (verified.length === 0) return { message: "wrong" };

  // Pick the most recently created user (already sorted desc) — the rare case
  // of multi-studio same-email-same-password resolves to the latest signup.
  // The other studios remain reachable via direct URLs from welcome emails.
  const u = verified[0];

  if (u.status === "PENDING") return { message: "pending" };
  if (u.status === "WITHDRAWN" || u.status === "ANONYMIZED") {
    return { message: "withdrawn" };
  }

  await issueSession(u.id, u.role, rememberMe === "on");
  const target =
    u.role === "CUSTOMER"
      ? `/g/${u.business!.slug}/me`
      : `/g/${u.business!.slug}/dashboard`;
  redirect(target);
}
