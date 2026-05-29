// 출입 검증 endpoint — 매장 스캐너(태블릿)가 QR 스캔 후 POST 로 호출.
//
// body: { slug, token }
//   slug  = 스캔하는 헬스장 (스캐너 페이지가 /g/[slug] 스코프).
//   token = QR 인코딩 값. V1 = 호텔 게스트 Stay.id 만 처리.
//
// V1 보안: 미인증 (스캐너는 매장 신뢰 단말, 항상 online 가정 — docs/access.md).
// token(cuid) 은 추측 불가 고엔트로피. 응답은 해당 토큰 1건의 가부만 노출.
// V2 hardening: 매장 staff 세션/디바이스 토큰 요구 + rate limit.
//
// TODO(다음 세션): 회원/트레이너 User.accessToken(32자 base64url) 분기 추가.
// 현재는 token 을 무조건 Stay.id 로 간주해 게스트 경로만 검증한다.

import { NextResponse } from "next/server";
import { normalizeSlug } from "@/lib/auth/normalize";
import { verifyGuestAccess } from "@/lib/access/guestVerify";

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

  const outcome = await verifyGuestAccess(slug, token);
  return NextResponse.json(outcome);
}
