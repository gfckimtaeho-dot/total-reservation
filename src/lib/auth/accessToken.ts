import crypto from "node:crypto";
import { prisma } from "@/lib/db/client";

// 영구 출입 토큰 — 회원·트레이너의 게이트 통과용 QR이 인코딩하는 값.
// 사장이 "재발급" 시 이 값을 새로 갈아끼우면 기존 QR은 즉시 무효.
export function generateAccessToken(): string {
  // 32자 base64url. crypto.randomBytes(24)는 192bit 엔트로피.
  return crypto.randomBytes(24).toString("base64url");
}

// 기존 사용자가 컬럼 도입 전부터 존재했을 수 있으니, 첫 dashboard 진입 시
// 없으면 lazy-create. 동시 요청에서도 unique 제약으로 한쪽만 성공.
export async function ensureAccessToken(userId: string): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { accessToken: true, active: true },
  });
  // 비활성 계정엔 lazy-create 금지 — 사장이 비활성화하며 null 로 만든 토큰을
  // dashboard 진입 한 번에 부활시키지 않도록.
  if (!existing?.active) return "";
  if (existing.accessToken) return existing.accessToken;

  const token = generateAccessToken();
  await prisma.user.update({
    where: { id: userId },
    data: { accessToken: token },
  });
  return token;
}
