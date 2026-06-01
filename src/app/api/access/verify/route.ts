// 출입 검증 endpoint — 매장 스캐너(태블릿)가 QR 스캔 후 POST 로 호출.
//
// body: { slug, token }
//   slug  = 스캔하는 헬스장 (스캐너 페이지가 /g/[slug] 스코프).
//   token = QR 인코딩 값. 회원/직원 User.accessToken 또는 호텔 게스트 Stay.id.
//           verifyAccess 디스패처가 종류를 판별해 알맞은 경로로 보낸다.
//
// V1 보안: 미인증 (스캐너는 매장 신뢰 단말, 항상 online 가정 — docs/access.md).
// token 은 추측 불가 고엔트로피. 응답은 해당 토큰 1건의 가부만 노출.
// V2 hardening: 매장 staff 세션/디바이스 토큰 요구 + rate limit.

import { NextResponse } from "next/server";
import { normalizeSlug } from "@/lib/auth/normalize";
import { verifyAccess } from "@/lib/access/verify";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalidBody" }, { status: 400 });
  }

  const { slug: rawSlug, token: rawToken } = (body ?? {}) as {
    slug?: unknown;
    token?: unknown;
  };
  const slug = normalizeSlug(typeof rawSlug === "string" ? rawSlug : "");
  const token = typeof rawToken === "string" ? rawToken.trim() : "";

  if (!slug || !token) {
    return NextResponse.json({ error: "missingParams" }, { status: 400 });
  }

  const outcome = await verifyAccess(slug, token);
  return NextResponse.json(outcome);
}
