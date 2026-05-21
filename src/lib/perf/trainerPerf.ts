import { prisma } from "@/lib/db/client";

// 트레이너 실적 집계 — 월별(한 해 12개월)·년도별(10년) 뷰용.
// 완료(COMPLETED) 세션마다 그 세션이 소진한 권의 frozen 회당 지급액
// (Package.payoutPhp)을 합산. 기준일 = completedAt(없으면 startAt) UTC.
// 일별 상세(세션 1건당 1행)는 loadTrainerMonthPerf(trainerMonth.ts) 사용.

export type PerfBucket = { sessionCount: number; grossPhp: number };

type Session = { at: Date; payoutPhp: number };

async function loadCompletedSessions(
  gymId: string,
  staffId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<Session[]> {
  const rows = await prisma.reservation.findMany({
    where: {
      gymId,
      staffId,
      status: "COMPLETED",
      OR: [
        { completedAt: { gte: rangeStart, lt: rangeEnd } },
        { completedAt: null, startAt: { gte: rangeStart, lt: rangeEnd } },
      ],
    },
    select: {
      startAt: true,
      completedAt: true,
      package: { select: { payoutPhp: true } },
    },
  });
  return rows.map((r) => ({
    at: r.completedAt ?? r.startAt,
    payoutPhp: r.package?.payoutPhp ?? 0,
  }));
}

function sum(sessions: Session[]): PerfBucket {
  return {
    sessionCount: sessions.length,
    grossPhp: sessions.reduce((a, s) => a + s.payoutPhp, 0),
  };
}

export type TrainerYearPerf = {
  year: number;
  months: ({ month: number } & PerfBucket)[]; // 1~12
  total: PerfBucket;
};

// 한 해 월별 실적 (12개월).
export async function loadTrainerYearPerf(
  gymId: string,
  staffId: string,
  year: number,
): Promise<TrainerYearPerf> {
  const sessions = await loadCompletedSessions(
    gymId,
    staffId,
    new Date(Date.UTC(year, 0, 1)),
    new Date(Date.UTC(year + 1, 0, 1)),
  );
  const months = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    sessionCount: 0,
    grossPhp: 0,
  }));
  for (const s of sessions) {
    const b = months[s.at.getUTCMonth()];
    b.sessionCount++;
    b.grossPhp += s.payoutPhp;
  }
  return { year, months, total: sum(sessions) };
}

export type TrainerDecadePerf = {
  years: ({ year: number } & PerfBucket)[]; // 선택 년도 포함 과거 10년, 최신 위
  total: PerfBucket;
};

// 선택 년도 포함 과거 10년 실적 (매출은 과거 데이터라 과거 방향).
export async function loadTrainerDecadePerf(
  gymId: string,
  staffId: string,
  anchorYear: number,
): Promise<TrainerDecadePerf> {
  const startYear = anchorYear - 9;
  const sessions = await loadCompletedSessions(
    gymId,
    staffId,
    new Date(Date.UTC(startYear, 0, 1)),
    new Date(Date.UTC(anchorYear + 1, 0, 1)),
  );
  const byYear = new Map<number, PerfBucket>();
  for (let yy = startYear; yy <= anchorYear; yy++) {
    byYear.set(yy, { sessionCount: 0, grossPhp: 0 });
  }
  for (const s of sessions) {
    const b = byYear.get(s.at.getUTCFullYear());
    if (b) {
      b.sessionCount++;
      b.grossPhp += s.payoutPhp;
    }
  }
  return {
    years: [...byYear.entries()]
      .map(([year, b]) => ({ year, ...b }))
      .sort((a, b) => b.year - a.year),
    total: sum(sessions),
  };
}
