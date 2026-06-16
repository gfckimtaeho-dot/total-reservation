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
import { verifyMemberAccess, verifyQrTokenAccess } from "./memberVerify";
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

  // 영구 토큰이 아니면 고객 당일 출입권(QrToken /me 발급)으로 시도. QrToken.token
  // 은 로컬 base64url 고엔트로피라 호텔 Stay.id(cuid)와 값 공간이 겹치지 않는다 —
  // 게스트 토큰이 여기 매칭될 일 없어 게스트 경로는 영향받지 않는다.
  const qr = await prisma.qrToken.findUnique({
    where: { token },
    select: {
      id: true,
      gymId: true,
      expiresAt: true,
      user: {
        select: { id: true, name: true, status: true, active: true },
      },
    },
  });
  if (qr) {
    // 다른 매장 토큰을 이 매장 스캐너에 댄 경우 — 회원 경로와 동일하게 WRONG_GYM.
    if (qr.gymId !== gym.id) {
      return {
        result: "DENIED",
        kind: "MEMBER",
        name: qr.user.name,
        hotelName: null,
        reason: "WRONG_GYM",
      };
    }
    return verifyQrTokenAccess(gym, qr);
  }

  // 회원/고객 토큰이 아니면 호텔 게스트(Stay.id)로 시도.
  return verifyGuestAccess(gym, token);
}
