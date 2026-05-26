// 로그인 아이디 중복 검증 API. 활성화 페이지/사장 매장 등록 form 의 디바운스
// 입력 시 호출. (slug, loginId) 로 매장 + ID 룩업. 충돌이면 available: false.
//
// 보안: 매장 무관히 응답이 단순 boolean 만 — 다른 매장 정보 노출 X. 인증 안 함
// (활성화 토큰이 없는 사용자도 가입 form 에서 호출하기 때문).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import {
  normalizeLoginId,
  normalizeSlug,
  LOGIN_ID_PATTERN,
} from "@/lib/auth/normalize";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = normalizeSlug(url.searchParams.get("slug") ?? "");
  const loginId = normalizeLoginId(url.searchParams.get("loginId") ?? "");

  if (!slug) {
    return NextResponse.json({ available: false, reason: "noSlug" });
  }
  if (!LOGIN_ID_PATTERN.test(loginId)) {
    return NextResponse.json({ available: false, reason: "invalidFormat" });
  }

  const business = await prisma.business.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!business) {
    return NextResponse.json({ available: false, reason: "noBusiness" });
  }

  const existing = await prisma.user.findUnique({
    where: { loginId_gymId: { loginId, gymId: business.id } },
    select: { id: true },
  });

  return NextResponse.json({ available: !existing });
}
