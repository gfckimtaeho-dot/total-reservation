import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decryptSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

// 로그인 사용자의 active 상태를 짧은 주기로 클라가 확인. 사장이 비활성화한
// 순간 트레이너 화면에 남아있는 옛 QR 까지 끊어내려는 안전망.
// 비활성 발견 시 세션 쿠키 즉시 삭제 + 401 반환 → 클라가 login 으로 이동.
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const payload = await decryptSession(token);
  if (!payload) {
    return NextResponse.json({ active: false }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { active: true },
  });
  if (!user || !user.active) {
    cookieStore.delete(SESSION_COOKIE_NAME);
    return NextResponse.json({ active: false }, { status: 401 });
  }
  return NextResponse.json({ active: true });
}
