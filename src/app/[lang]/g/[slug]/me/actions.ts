"use server";

import QRCode from "qrcode";
import { prisma } from "@/lib/db/client";
import { requireGymCustomer } from "@/lib/auth/dal";
import { generateAccessToken } from "@/lib/auth/accessToken";
import {
  manilaTodayUtcMidnight,
  manilaTodayRange,
} from "@/lib/calendar/manila";

export type AccessQrResult =
  | { ok: true; qr: string; expiresYmd: string }
  | { ok: false; reason: "noAccess" };

// 출입 자격은 "그 1명"에 대해 탭하는 순간 실시간 계산한다(cron 스냅샷 신뢰 X):
//   - 오늘 기준 유효한 회원권(endDate >= 오늘) 보유  → 발급
//   - 또는 오늘 예약(PT/단체수업)이 있음            → 그날 임시 발급
//   - 둘 다 아니면 거절(프런트 문의)
// 발급 토큰은 Manila 오늘 끝까지만 유효(QrToken). 같은 날 재탭은 재사용.
export async function requestAccessQr(
  slug: string,
): Promise<AccessQrResult> {
  const user = await requireGymCustomer(slug);
  const gymId = user.business!.id;
  const userId = user.id;

  const today = manilaTodayUtcMidnight();
  const { end: endOfDay } = manilaTodayRange();

  const validMembership = await prisma.membership.findFirst({
    where: { userId, gymId, endDate: { gte: today } },
    select: { id: true },
  });

  let eligible = Boolean(validMembership);
  if (!eligible) {
    const { start, end } = manilaTodayRange();
    const reservationToday = await prisma.reservation.findFirst({
      where: {
        customerUserId: userId,
        gymId,
        startAt: { gte: start, lt: end },
        status: { notIn: ["CANCELLED", "REJECTED"] },
      },
      select: { id: true },
    });
    eligible = Boolean(reservationToday);
  }

  if (!eligible) return { ok: false, reason: "noAccess" };

  // 오늘 아직 유효한 토큰이 있으면 재사용(탭마다 row 폭증 방지).
  const now = new Date();
  const existing = await prisma.qrToken.findFirst({
    where: {
      userId,
      gymId,
      usedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { issuedAt: "desc" },
    select: { token: true, expiresAt: true },
  });

  let token: string;
  let expiresAt: Date;
  if (existing) {
    token = existing.token;
    expiresAt = existing.expiresAt;
  } else {
    token = generateAccessToken();
    expiresAt = endOfDay;
    await prisma.qrToken.create({
      data: {
        gymId,
        userId,
        token,
        nonce: generateAccessToken(),
        expiresAt,
      },
    });
  }

  const qr = await QRCode.toDataURL(token, {
    width: 320,
    margin: 1,
    color: { dark: "#0a0a0a", light: "#ffffff" },
  });

  return {
    ok: true,
    qr,
    expiresYmd: expiresAt.toISOString().slice(0, 10),
  };
}
