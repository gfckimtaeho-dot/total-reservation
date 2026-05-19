// Vercel Cron — 매일 Manila 00:10 (UTC 16:10) 실행.
//
// 회원(role=CUSTOMER) 전용. "활성 = 오늘 기준 유효한 회원권 보유" 스냅샷을
// User.active 에 양방향 반영:
//   - 유효 회원권(endDate >= 오늘) 있으면        → active = true  (연장/재구매 복구)
//   - 유효 회원권 없으면(만료됐거나 애초에 없음) → active = false (만료 다음날 비활성)
//
// 트레이너/매니저는 회원권 개념이 없으므로 절대 건드리지 않는다(수동 전용).
// 이 active 는 "사장이 한눈에 보는 스냅샷"일 뿐, 출입 가부의 진실은
// /me 의 출입 QR 발급 시점에 그 1명을 실시간 계산한다(stale 무관).
//
// 보안: Vercel Cron 이 붙이는 `Authorization: Bearer ${CRON_SECRET}` 검증.
// dev/수동: `?dry=1` 로 실제 변경 없이 영향 건수만 반환.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { manilaTodayUtcMidnight } from "@/lib/calendar/manila";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const today = manilaTodayUtcMidnight();

  // 유효 회원권 보유 = 오늘(포함) 이후 endDate 인 membership 이 하나라도 있음
  const hasValidMembership = {
    role: "CUSTOMER" as const,
    memberships: { some: { endDate: { gte: today } } },
  };
  const noValidMembership = {
    role: "CUSTOMER" as const,
    memberships: { none: { endDate: { gte: today } } },
  };

  if (dry) {
    const [toActivate, toDeactivate] = await Promise.all([
      prisma.user.count({ where: { ...hasValidMembership, active: false } }),
      prisma.user.count({ where: { ...noValidMembership, active: true } }),
    ]);
    return NextResponse.json({
      ok: true,
      dry: true,
      todayYmd: today.toISOString().slice(0, 10),
      willActivate: toActivate,
      willDeactivate: toDeactivate,
    });
  }

  const [activated, deactivated] = await Promise.all([
    prisma.user.updateMany({
      where: { ...hasValidMembership, active: false },
      data: { active: true },
    }),
    prisma.user.updateMany({
      where: { ...noValidMembership, active: true },
      data: { active: false },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    todayYmd: today.toISOString().slice(0, 10),
    activated: activated.count,
    deactivated: deactivated.count,
  });
}
