"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { verifyPassword } from "@/lib/auth/password";
import { issueSession } from "@/lib/auth/session";
import {
  normalizeEmail,
  normalizePassword,
  normalizeSlug,
} from "@/lib/auth/normalize";

// Normalization happens BEFORE zod via .transform — autofill from mobile
// keyboards/password managers can inject NBSP / zero-width / BOM chars that
// .trim() doesn't catch. See src/lib/auth/normalize.ts for details.
const schema = z.object({
  slug: z.string().transform(normalizeSlug).pipe(z.string().min(1)),
  email: z
    .string()
    .transform(normalizeEmail)
    .pipe(z.string().email("이메일 형식이 올바르지 않습니다")),
  password: z
    .string()
    .transform(normalizePassword)
    .pipe(z.string().min(1, "비밀번호를 입력해 주세요")),
  rememberMe: z.string().nullish(),
});

export type GymLoginState = {
  errors?: Record<string, string[] | undefined>;
  message?:
    | "wrong"
    | "noBusiness"
    | "noUser"
    | "notActivated"
    | "pending"
    | "withdrawn";
  // 임시 디버그: noUser 분기 진단용. 안정화되면 제거.
  debug?: {
    rawEmailBytes: number;
    rawEmailHex: string;
    normalizedEmail: string;
    rawSlugBytes: number;
    rawSlugHex: string;
    similarEmails: string[];
  };
};

export async function gymLogin(
  _prev: GymLoginState,
  formData: FormData,
): Promise<GymLoginState> {
  // raw 입력 캡처 (정규화 전) — invisible char 진단용
  const rawEmailInput = String(formData.get("email") ?? "");
  const rawSlugInput = String(formData.get("slug") ?? "");
  const rawEmailHex = Buffer.from(rawEmailInput, "utf8").toString("hex");
  const rawSlugHex = Buffer.from(rawSlugInput, "utf8").toString("hex");

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
    console.error("[gymLogin] business not found:", {
      slug,
      rawSlugInput,
      rawSlugHex,
      rawSlugBytes: rawSlugInput.length,
    });
    return {
      message: "noBusiness",
      debug: {
        rawEmailBytes: rawEmailInput.length,
        rawEmailHex,
        normalizedEmail: email,
        rawSlugBytes: rawSlugInput.length,
        rawSlugHex,
        similarEmails: [],
      },
    };
  }

  const user = await prisma.user.findUnique({
    where: { email_gymId: { email, gymId: business.id } },
  });
  if (!user) {
    // 같은 매장에 비슷한 email이 있는지 prefix 검색 — 입력값과 DB값의 차이를 보여줌
    const similar = await prisma.user.findMany({
      where: { gymId: business.id, email: { contains: email.split("@")[0]?.slice(0, 4) ?? "" } },
      select: { email: true },
      take: 5,
    });
    console.error("[gymLogin] user not found:", {
      slug,
      gymId: business.id,
      email,
      rawEmailInput,
      rawEmailHex,
      rawEmailBytes: rawEmailInput.length,
      similarEmails: similar.map((s) => s.email),
    });
    return {
      message: "noUser",
      debug: {
        rawEmailBytes: rawEmailInput.length,
        rawEmailHex,
        normalizedEmail: email,
        rawSlugBytes: rawSlugInput.length,
        rawSlugHex,
        similarEmails: similar.map((s) => s.email ?? ""),
      },
    };
  }
  if (!user.passwordHash) {
    console.error("[gymLogin] passwordHash missing:", {
      userId: user.id,
      email,
      status: user.status,
    });
    return { message: "notActivated" };
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

  // 등록 때 고른 모국어(User.locale)를 NEXT_LOCALE 쿠키로 → 아래 redirect 는
  // 로케일 없는 경로라 proxy.ts(next-intl)가 이 쿠키를 읽어 /{locale}/... 로
  // 프리픽스를 붙인다. 결과: 로그인 즉시 본인 언어 대시보드로 진입.
  const cookieStore = await cookies();
  cookieStore.set("NEXT_LOCALE", user.locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  const target =
    user.role === "CUSTOMER"
      ? `/g/${slug}/me`
      : `/g/${slug}/dashboard`;
  redirect(target);
}
