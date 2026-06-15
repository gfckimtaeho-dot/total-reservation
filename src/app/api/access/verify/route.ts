// 출입 검증 endpoint — 매장 스캐너(태블릿)가 QR 스캔 후 POST 로 호출.
//
// body: { slug, token }
//   slug  = 스캔하는 헬스장 (스캐너 페이지가 /g/[slug] 스코프).
//   token = QR 인코딩 값. 회원/직원 User.accessToken 또는 호텔 게스트 Stay.id.
//           verifyAccess 디스패처가 종류를 판별해 알맞은 경로로 보낸다.
//
// 보안: 무인 키 링크 단말은 body.key(매장 scannerKey)를 함께 보내 인증한다.
// key 가 일치할 때만 통과 — 재발급된 옛 링크/임의 호출 차단(403). 직원 세션
// 스캐너는 key 없이 기존 동작(token 추측 불가 고엔트로피). docs/access.md.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { normalizeSlug } from "@/lib/auth/normalize";
import { verifyAccess } from "@/lib/access/verify";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalidBody" }, { status: 400 });
  }

  const { slug: rawSlug, token: rawToken, key: rawKey } = (body ?? {}) as {
    slug?: unknown;
    token?: unknown;
    key?: unknown;
  };
  const slug = normalizeSlug(typeof rawSlug === "string" ? rawSlug : "");
  const token = typeof rawToken === "string" ? rawToken.trim() : "";
  const key = typeof rawKey === "string" ? rawKey.trim() : "";

  if (!slug || !token) {
    return NextResponse.json({ error: "missingParams" }, { status: 400 });
  }

  // 무인 키 링크 단말은 key 를 함께 보낸다. 매장 scannerKey 와 일치할 때만 통과.
  if (key) {
    const gym = await prisma.business.findUnique({
      where: { slug },
      select: { scannerKey: true },
    });
    if (!gym?.scannerKey || gym.scannerKey !== key) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const outcome = await verifyAccess(slug, token);
  return NextResponse.json(outcome);
}
