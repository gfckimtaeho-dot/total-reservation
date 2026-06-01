// 출입 검증 디스패처 — 스캐너 endpoint(POST /api/access/verify)의 진입점.
//
// (slug, token) 을 받아 token 종류를 판별해 알맞은 경로로 보낸다:
//   - User.accessToken 매칭 -> 회원/직원 (로컬 DB)
//   - 아니면 -> 호텔 게스트 (cross-DB Stay live read)
//
// 토큰 형식 휴리스틱(cuid vs base64url) 대신 로컬 User 조회를 먼저 시도한다.
// 두 토큰 다 고엔트로피 unique 라 충돌하지 않고, 형식 추측보다 견고하다.

import { prisma } from "@/lib/db/client";
import { verifyGuestAccess } from "./guestVerify";
import { verifyMemberAccess } from "./memberVerify";
import type { AccessOutcome } from "./types";

export async function verifyAccess(
  slug: string,
  token: string,
): Promise<AccessOutcome> {
  const gym = await prisma.business.findUnique({
    where: { slug },
    select: { id: true, timeZone: true },
  });
  if (!gym) {
    return {
      result: "DENIED",
      kind: "MEMBER",
      name: null,
      hotelName: null,
      reason: "GYM_NOT_FOUND",
    };
  }

  // 회원/직원 토큰 우선 조회 (로컬, cross-DB 호출 절약).
  const user = await prisma.user.findUnique({
    where: { accessToken: token },
    select: {
      id: true,
      gymId: true,
      name: true,
      role: true,
      status: true,
      active: true,
    },
  });
  if (user) {
    return verifyMemberAccess(gym, user);
  }

  // 회원 토큰이 아니면 호텔 게스트(Stay.id)로 시도.
  return verifyGuestAccess(gym, token);
}
