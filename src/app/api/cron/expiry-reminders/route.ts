// Vercel Cron — 매일 Manila 23:59 (UTC 15:59) 실행.
// 정확히 7일 후 만료되는 회원에게 이메일 발송 + NotificationLog 기록.
//
// 보안: Vercel Cron이 자동으로 첨부하는 `Authorization: Bearer ${CRON_SECRET}` 헤더
//      검증. 외부에서 임의 호출 차단.
//
// dev/수동 호출: `?dry=1` 쿼리로 실제 발송 없이 대상자만 반환.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { sendExpiryReminderEmail } from "@/lib/email/resend";

// 매일 한 번 실행이지만, 누락 방지·중복 방지 위해 "7일 후 자정 ~ 8일 후 자정"
// 윈도우의 endDate를 가진 멤버십을 모두 조회.
function getWindow(): { from: Date; to: Date; targetYmd: string } {
  const now = new Date();
  // Manila timezone 기준 오늘 자정 — Vercel은 UTC라 자정 계산은 단순 UTC 사용.
  // (사용자 schema가 @db.Date로 저장하므로 시간대 영향 최소)
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() + 7);
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 1);
  const targetYmd = from.toISOString().slice(0, 10);
  return { from, to, targetYmd };
}

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

  const { from, to, targetYmd } = getWindow();

  // 같은 user가 여러 membership row를 가질 수 있으나, 같은 endDate면 1번만 발송.
  // distinct user 보장 위해 group by user.
  const memberships = await prisma.membership.findMany({
    where: { endDate: { gte: from, lt: to } },
    select: {
      userId: true,
      endDate: true,
      gymId: true,
      user: {
        select: { id: true, name: true, email: true, locale: true },
      },
      business: { select: { id: true, name: true, slug: true } },
    },
  });

  // user별 첫 row만 (중복 방지)
  const seen = new Set<string>();
  const unique = memberships.filter((m) => {
    if (seen.has(m.userId)) return false;
    seen.add(m.userId);
    return true;
  });

  if (dry) {
    return NextResponse.json({
      ok: true,
      dry: true,
      targetYmd,
      count: unique.length,
      targets: unique.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        gym: m.business.slug,
        endDate: m.endDate.toISOString().slice(0, 10),
      })),
    });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://yeyakgazua.vercel.app";

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const m of unique) {
    if (!m.user.email) {
      skipped++;
      continue;
    }
    const loginUrl = `${baseUrl}/${m.user.locale}/g/${m.business.slug}/login`;
    const endYmd = m.endDate.toISOString().slice(0, 10);

    const result = await sendExpiryReminderEmail({
      to: m.user.email,
      memberName: m.user.name,
      storeName: m.business.name,
      endDate: endYmd,
      loginUrl,
    });

    const isSuccess = result.ok;
    if (isSuccess) success++;
    else failed++;

    await prisma.notificationLog.create({
      data: {
        gymId: m.gymId,
        recipientUserId: m.userId,
        kind: "expiry_7d",
        channel: "EMAIL",
        result: isSuccess ? "SUCCESS" : "FAILED",
        fallback: !isSuccess && "fallback" in result && result.fallback === true,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    targetYmd,
    total: unique.length,
    success,
    failed,
    skipped,
  });
}
