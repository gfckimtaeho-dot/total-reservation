import { prisma } from "@/lib/db/client";

// 트레이너 월별 실적 — 월급 산정 근거. 완료(COMPLETED)된 세션마다 그 세션이
// 소진한 권의 frozen 회당 지급액(Package.payoutPhp)을 합산.
// 회원권 기반/권 없는 세션은 payout 0.
//
// 환불은 트레이너와 무관(확정 정책 2026-05-19): 환불된 세션은 트레이너가
// 한 일이 없어 0원, 환불 전액은 사장이 처리. → 트레이너 실적엔 환불 개념
// 자체가 없음(완료 세션 payout 합 = 그 달 실적).
//
// 조회 월은 인자(year, month)로 받음 — 전달/현재달/‹›  네비 지원.
// 기준 = completedAt(없으면 startAt) UTC 연·월 (앱 전반 UTC-naive 표시와 통일).

export type PerfRow = {
  id: string;
  dateYmd: string; // YYYY-MM-DD (완료일, 없으면 예약일)
  customerName: string;
  serviceName: string;
  payoutPhp: number; // 그 세션 트레이너 지급액(frozen)
};

export type TrainerMonthPerf = {
  year: number;
  month: number; // 1-12
  fromYmd: string; // 조회 시작(그 달 1일)
  toYmd: string; // 조회 끝(그 달 말일)
  rows: PerfRow[];
  sessionCount: number;
  grossPhp: number; // 완료 세션 지급액 합 = 그 달 실적
};

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export async function loadTrainerMonthPerf(
  gymId: string,
  staffId: string,
  year: number,
  month: number, // 1-12
): Promise<TrainerMonthPerf> {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  // 완료 세션 = completedAt 이 그 달. 레거시/시드 완료건은 completedAt 이
  // null 일 수 있어 그 경우 startAt(세션일) 기준 포함 — 월급 산정은 "그 달에
  // 수업이 일어났나"가 기준이라 정합.
  const reservations = await prisma.reservation.findMany({
    where: {
      gymId,
      staffId,
      status: "COMPLETED",
      OR: [
        { completedAt: { gte: monthStart, lt: monthEnd } },
        {
          completedAt: null,
          startAt: { gte: monthStart, lt: monthEnd },
        },
      ],
    },
    select: {
      id: true,
      startAt: true,
      completedAt: true,
      customer: { select: { name: true } },
      service: { select: { name: true } },
      package: { select: { payoutPhp: true } },
    },
    orderBy: { startAt: "asc" },
  });

  const rows: PerfRow[] = reservations.map((r) => ({
    id: r.id,
    dateYmd: ymd(r.completedAt ?? r.startAt),
    customerName: r.customer?.name ?? "",
    serviceName: r.service?.name ?? "",
    payoutPhp: r.package?.payoutPhp ?? 0,
  }));

  const grossPhp = rows.reduce((s, x) => s + x.payoutPhp, 0);

  return {
    year,
    month,
    fromYmd: `${year}-${String(month).padStart(2, "0")}-01`,
    toYmd: `${year}-${String(month).padStart(2, "0")}-${String(
      lastDay,
    ).padStart(2, "0")}`,
    rows,
    sessionCount: rows.length,
    grossPhp,
  };
}
