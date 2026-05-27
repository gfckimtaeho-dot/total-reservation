"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
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

  // 등록 시 고른 모국어(User.locale)를 NEXT_LOCALE 쿠키로 → 아래 redirect 는
  // 로케일 없는 경로라 proxy.ts(next-intl)가 이 쿠키를 읽어 /{locale}/... 로
  // 프리픽스를 붙인다. 결과: 활성화 직후 본인 언어 대시보드로 진입.
  const cookieStore = await cookies();
  cookieStore.set("NEXT_LOCALE", link.targetUser.locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  // 역할별 진입점 분기: 사장/매니저/트레이너는 dashboard, 회원은 회원증.
  // lang prefix 는 위 쿠키 기반으로 next-intl 이 자동 보강.
  const role = link.targetUser.role;
  const target =
    role === "OWNER" || role === "MANAGER" || role === "TRAINER"
      ? `/g/${slug}/dashboard`
      : `/g/${slug}/me`;
  redirect(target);
}
