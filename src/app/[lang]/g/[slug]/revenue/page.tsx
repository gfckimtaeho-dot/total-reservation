import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { logout } from "@/lib/auth/actions";
import { loadTrainerMonthPerf } from "@/lib/perf/trainerMonth";
import { SidebarNav } from "../dashboard/SidebarNav";
import { RevenueChart } from "./RevenueChart";

const MS_DAY = 86400000;

type SP = string | string[] | undefined;
function one(v: SP): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

// UTC 인스턴트 -> 매장 타임존 달력일 "YYYY-MM-DD".
function gymYmd(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
// "지금"을 읽는 impure 호출은 모듈 스코프에 둔다(서버 컴포넌트 purity 회피).
function gymToday(tz: string): string {
  return gymYmd(new Date(), tz);
}
function gymYesterday(tz: string): string {
  return gymYmd(new Date(Date.now() - MS_DAY), tz);
}

const TK = {
  page: "bg-violet-50/40",
  aside: "bg-violet-50",
  border: "border-violet-100",
  eyebrow: "text-ink/60",
  name: "text-ink",
  sub: "text-ink/50",
  logout: "text-zinc-700 hover:bg-zinc-50",
  h1: "text-ink",
  card: "border-violet-100 bg-white",
  num: "text-ink",
  rowBorder: "border-violet-50",
  segSession: "bg-violet-600",
  segBase: "bg-amber-500",
  segTrack: "bg-zinc-100",
} as const;

type Money = { total: number; owner: number };

export default async function RevenuePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; slug: string }>;
  searchParams: Promise<Record<string, SP>>;
}) {
  const { lang, slug } = await params;
  const sp = await searchParams;
  const auth = await requireGymStaff(slug);
  const business = auth.business!;
  const tz = business.timeZone;
  const t = await getTranslations("revenue");
  const tn = await getTranslations("nav");

  const money = (n: number) => `₱${n.toLocaleString()}`;

  const todayYmd = gymToday(tz);
  const ty = Number(todayYmd.slice(0, 4));
  const tm = Number(todayYmd.slice(5, 7));

  const viewRaw = one(sp.view);
  const view: "day" | "month" | "year" =
    viewRaw === "month" || viewRaw === "year" ? viewRaw : "day";
  const anchorY = Number(one(sp.y)) || ty;
  const anchorM = Math.min(12, Math.max(1, Number(one(sp.m)) || tm));

  // ── KPI: 작년 1/1 ~ 지금 매출 + 환불 ──
  const kpiFrom = new Date(Date.UTC(ty - 1, 0, 1) - MS_DAY);
  const [kpiSales, kpiRefunds, trainers] = await Promise.all([
    prisma.sale.findMany({
      where: { gymId: business.id, createdAt: { gte: kpiFrom } },
      select: { totalPaidPhp: true, ownerRevenuePhp: true, createdAt: true },
    }),
    prisma.refundRequest.findMany({
      where: { gymId: business.id, requestedAt: { gte: kpiFrom } },
      select: { refundPhp: true, requestedAt: true },
    }),
    prisma.staff.findMany({
      where: { gymId: business.id, role: { in: ["TRAINER", "MANAGER"] } },
      select: {
        id: true,
        monthlyBaseSalaryPhp: true,
        user: { select: { name: true } },
      },
      orderBy: { user: { name: "asc" } },
    }),
  ]);

  const mm = (m: number) => String(m).padStart(2, "0");
  const sumSales = (pred: (ymd: string) => boolean): Money => {
    let total = 0;
    let owner = 0;
    for (const s of kpiSales) {
      if (pred(gymYmd(s.createdAt, tz))) {
        total += s.totalPaidPhp;
        owner += s.ownerRevenuePhp;
      }
    }
    return { total, owner };
  };
  const sumRefunds = (pred: (ymd: string) => boolean): number => {
    let r = 0;
    for (const x of kpiRefunds) {
      if (pred(gymYmd(x.requestedAt, tz))) r += x.refundPhp;
    }
    return r;
  };

  const yYmd = gymYesterday(tz);
  const lm = tm === 1 ? { y: ty - 1, m: 12 } : { y: ty, m: tm - 1 };
  const prefThisMonth = `${ty}-${mm(tm)}`;
  const prefLastMonth = `${lm.y}-${mm(lm.m)}`;

  type Kpi = {
    label: string;
    total: number; // 매출(환불 차감 net)
    owner: number; // 사장 몫(환불 차감 net) — payout만 빠진 게 아니라 환불도 빠짐
    refund: number; // 정보 라인용 — 그 기간 환불 총액
    delta: number | null;
    deltaLabel: string;
  };
  // 매출 산식 — sales 합에서 환불 차감(사장 부담). payout은 매출의 일부였으니
  // total에서 빼고, owner에서도 빼면 트레이너 지급은 그대로(=total-owner) 보존.
  // 환불 시점은 requestedAt — 정책상 신청 시점에 권 동결+미래예약 취소가
  // 즉시 일어나 매출 손실 확정([[decision_refund_policy]]).
  function kpi(
    label: string,
    deltaLabel: string,
    pred: (k: string) => boolean,
    prevPred: (k: string) => boolean,
  ): Kpi {
    const s = sumSales(pred);
    const refund = sumRefunds(pred);
    const prev = sumSales(prevPred);
    const prevRefund = sumRefunds(prevPred);
    const total = s.total - refund;
    const owner = s.owner - refund;
    const prevTotal = prev.total - prevRefund;
    return {
      label,
      total,
      owner,
      refund,
      // 한쪽이 0이면 % 차이가 의미 없음 — "어제 대비 -100%" 같은 경계값을
      // 안 보이도록 둘 다 양수일 때만 계산.
      delta:
        prevTotal > 0 && total > 0
          ? Math.round(((total - prevTotal) / prevTotal) * 100)
          : null,
      deltaLabel,
    };
  }
  const kpis: Kpi[] = [
    kpi(
      t("kpiToday"),
      t("vsYesterday"),
      (k) => k === todayYmd,
      (k) => k === yYmd,
    ),
    kpi(
      t("kpiMonth"),
      t("vsLastMonth"),
      (k) => k.startsWith(prefThisMonth),
      (k) => k.startsWith(prefLastMonth),
    ),
    kpi(
      t("kpiYear"),
      t("vsLastYear"),
      (k) => k.startsWith(`${ty}-`),
      (k) => k.startsWith(`${ty - 1}-`),
    ),
  ];

  // ── 차트 기간 ──
  let rangeFrom: Date;
  let rangeTo: Date;
  let inPeriod: (ymd: string) => boolean;
  let bucketKey: (ymd: string) => string;
  let bucketLabels: string[];
  let periodLabel: string;

  if (view === "day") {
    rangeFrom = new Date(Date.UTC(anchorY, anchorM - 1, 1) - MS_DAY);
    rangeTo = new Date(Date.UTC(anchorY, anchorM, 1) + MS_DAY);
    const pfx = `${anchorY}-${mm(anchorM)}`;
    inPeriod = (k) => k.startsWith(pfx);
    bucketKey = (k) => k.slice(8, 10);
    const days = new Date(Date.UTC(anchorY, anchorM, 0)).getUTCDate();
    bucketLabels = Array.from({ length: days }, (_, i) => mm(i + 1));
    periodLabel = t("periodMonth", { y: anchorY, m: anchorM });
  } else if (view === "month") {
    rangeFrom = new Date(Date.UTC(anchorY, 0, 1) - MS_DAY);
    rangeTo = new Date(Date.UTC(anchorY + 1, 0, 1) + MS_DAY);
    inPeriod = (k) => k.startsWith(`${anchorY}-`);
    bucketKey = (k) => k.slice(5, 7);
    bucketLabels = Array.from({ length: 12 }, (_, i) => mm(i + 1));
    periodLabel = t("periodYear", { y: anchorY });
  } else {
    rangeFrom = new Date(Date.UTC(anchorY - 9, 0, 1) - MS_DAY);
    rangeTo = new Date(Date.UTC(anchorY + 1, 0, 1) + MS_DAY);
    inPeriod = (k) => {
      const yr = Number(k.slice(0, 4));
      return yr >= anchorY - 9 && yr <= anchorY;
    };
    bucketKey = (k) => k.slice(0, 4);
    bucketLabels = Array.from({ length: 10 }, (_, i) =>
      String(anchorY - 9 + i),
    );
    periodLabel = t("periodDecade", { from: anchorY - 9, to: anchorY });
  }

  // 차트도 KPI와 같은 산식으로 — sales + 환불을 한 bucket에 합쳐 환불 차감.
  // 둘이 분리되면 막대 합과 KPI total이 갈라져서 사용자 혼란.
  const [periodSales, periodRefunds] = await Promise.all([
    prisma.sale.findMany({
      where: {
        gymId: business.id,
        createdAt: { gte: rangeFrom, lt: rangeTo },
      },
      select: {
        totalPaidPhp: true,
        ownerRevenuePhp: true,
        createdAt: true,
      },
    }),
    prisma.refundRequest.findMany({
      where: {
        gymId: business.id,
        requestedAt: { gte: rangeFrom, lt: rangeTo },
      },
      select: { refundPhp: true, requestedAt: true },
    }),
  ]);
  const byBucket = new Map<string, Money>();
  for (const s of periodSales) {
    const k = gymYmd(s.createdAt, tz);
    if (!inPeriod(k)) continue;
    const bk = bucketKey(k);
    const cur = byBucket.get(bk) ?? { total: 0, owner: 0 };
    cur.total += s.totalPaidPhp;
    cur.owner += s.ownerRevenuePhp;
    byBucket.set(bk, cur);
  }
  // 환불 차감 — total과 owner에서 동일 금액 빼서 payout(=total-owner) 불변 유지.
  for (const r of periodRefunds) {
    const k = gymYmd(r.requestedAt, tz);
    if (!inPeriod(k)) continue;
    const bk = bucketKey(k);
    const cur = byBucket.get(bk) ?? { total: 0, owner: 0 };
    cur.total -= r.refundPhp;
    cur.owner -= r.refundPhp;
    byBucket.set(bk, cur);
  }
  const series = bucketLabels.map((bk, i) => ({
    label: view === "year" ? bk : String(i + 1),
    total: byBucket.get(bk)?.total ?? 0,
    owner: byBucket.get(bk)?.owner ?? 0,
  }));

  // ── 트레이너별 월 지급액 (월급 지급용) — 앵커 달 기준, 완료 세션 합 ──
  const perf = await Promise.all(
    trainers.map((tr) =>
      loadTrainerMonthPerf(business.id, tr.id, anchorY, anchorM),
    ),
  );
  const trainerPay = trainers
    .map((tr, i) => {
      const sessionPhp = perf[i].grossPhp;
      const basePhp = tr.monthlyBaseSalaryPhp;
      return {
        name: tr.user.name,
        sessions: perf[i].sessionCount,
        sessionPhp,
        basePhp,
        totalPhp: sessionPhp + basePhp,
      };
    })
    .sort((a, b) => b.totalPhp - a.totalPhp);
  const payTotal = trainerPay.reduce((s, x) => s + x.totalPhp, 0);
  const sessionTotal = trainerPay.reduce((s, x) => s + x.sessionPhp, 0);
  const baseTotal = trainerPay.reduce((s, x) => s + x.basePhp, 0);
  // 누적바 정규화 기준 — 모든 행 동일 max로 비교 가능하게.
  const maxPay = Math.max(1, ...trainerPay.map((x) => x.totalPhp));

  return (
    <div className={`flex min-h-screen ${TK.page}`}>
      <aside
        className={`hidden w-60 shrink-0 flex-col border-r ${TK.border} ${TK.aside} lg:flex`}
      >
        <div className={`border-b ${TK.border} px-6 py-6`}>
          <span
            className={`text-xs font-semibold uppercase tracking-[0.22em] ${TK.eyebrow}`}
          >
            {tn("studio")}
          </span>
          <div
            className={`mt-1 font-heading text-lg tracking-tight ${TK.name}`}
          >
            {business.name}
          </div>
          <div className={`mt-0.5 text-xs ${TK.sub}`}>/g/{slug}</div>
        </div>
        <SidebarNav />
        <div className={`border-t ${TK.border} px-3 py-4`}>
          <form action={logout.bind(null, `/${lang}/g/${slug}/login`)}>
            <button
              className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm ${TK.logout}`}
            >
              {tn("logout")}
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 px-5 py-6 sm:px-8">
        <h1
          className={`font-heading text-xl tracking-tight sm:text-2xl ${TK.h1}`}
        >
          {t("title")}
        </h1>

        {/* KPI 3장 — 매출(환불 차감 net) + 사장몫(net) + 환불 정보.
            산식: 매출 = sales - 환불, 사장 몫 = ownerRevenue - 환불. 둘 다
            환불을 한 번만 빼서 트레이너 지급(=매출-사장몫)은 변동 없음. */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {kpis.map((k) => (
            <div
              key={k.label}
              className={`rounded-2xl border ${TK.card} p-4`}
            >
              <div className="flex items-baseline justify-between">
                <span className={`text-xs ${TK.sub}`}>{k.label}</span>
                {k.delta === null ? (
                  <span className={`text-[11px] ${TK.sub}`}>
                    {k.deltaLabel} —
                  </span>
                ) : (
                  <span
                    className={
                      "text-[11px] " +
                      (k.delta >= 0
                        ? "text-emerald-500"
                        : "text-rose-500")
                    }
                  >
                    {k.deltaLabel} {k.delta >= 0 ? "+" : ""}
                    {k.delta}%
                  </span>
                )}
              </div>
              <div
                className={`mt-1 font-heading text-2xl tracking-tight tabular-nums ${TK.num}`}
              >
                {money(k.total)}
              </div>
              <dl
                className={`mt-2 space-y-0.5 border-t ${TK.rowBorder} pt-2 text-xs`}
              >
                <KpiLine
                  label={t("sumOwner")}
                  value={money(k.owner)}
                  strong
                />
                <KpiLine
                  label={t("sumRefund")}
                  value={`- ${money(k.refund)}`}
                />
              </dl>
            </div>
          ))}
        </div>

        {/* 매출 차트 — 순수익 / 트레이너 지급 토글 누적 막대 */}
        <RevenueChart
          tone="white"
          lang={lang}
          slug={slug}
          view={view}
          anchorY={anchorY}
          anchorM={anchorM}
          periodLabel={periodLabel}
          series={series}
        />

        {/* 트레이너별 월 지급액 — 수업 payout + 기본급 누적 + 총 지급 */}
        <div className={`mt-3 rounded-2xl border ${TK.card} p-4`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className={`text-xs ${TK.sub}`}>
              {t("trainerPayTitle", { y: anchorY, m: anchorM })}
            </span>
            <div className={`flex items-center gap-3 text-xs ${TK.sub}`}>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-sm ${TK.segBase}`}
                />
                {t("legendBasePay")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-sm ${TK.segSession}`}
                />
                {t("legendSessionPay")}
              </span>
            </div>
          </div>
          {trainerPay.length === 0 ? (
            <div className={`mt-2 text-sm ${TK.sub}`}>{t("noData")}</div>
          ) : (
            <>
              {/* 헤더 — 데이터 정렬에 맞춤(트레이너=좌, 숫자컬럼=우). 데이터보다 크고 진하게. */}
              <div
                className={`mt-3 hidden border-b ${TK.rowBorder} pb-2 text-sm font-bold ${TK.num} sm:grid sm:grid-cols-[minmax(8rem,1.2fr)_minmax(0,2fr)_minmax(0,3.5fr)] sm:items-end sm:gap-4`}
              >
                <div className="text-left">{t("colTrainer")}</div>
                <div></div>
                <div className="grid grid-cols-3 gap-2 text-right">
                  <div>{t("colBasePay")}</div>
                  <div>{t("colSessionPay")}</div>
                  <div>{t("colTotalPay")}</div>
                </div>
              </div>
              <ul>
                {trainerPay.map((tp) => {
                  const sessionPct = (tp.sessionPhp / maxPay) * 100;
                  const basePct = (tp.basePhp / maxPay) * 100;
                  return (
                    <li
                      key={tp.name}
                      className={`grid grid-cols-1 gap-2 border-t ${TK.rowBorder} py-3 first:border-t-0 sm:grid-cols-[minmax(8rem,1.2fr)_minmax(0,2fr)_minmax(0,3.5fr)] sm:items-center sm:gap-4`}
                    >
                      <div>
                        <div className={`text-sm font-medium ${TK.num}`}>
                          {tp.name}
                        </div>
                        <div className={`text-[11px] ${TK.sub}`}>
                          {t("sessionCount", { n: tp.sessions })}
                        </div>
                      </div>
                      <div>
                        <div
                          className={`flex h-3 w-full overflow-hidden rounded-full ${TK.segTrack}`}
                          aria-label={`${money(tp.basePhp)} + ${money(tp.sessionPhp)}`}
                        >
                          {basePct > 0 && (
                            <div
                              className={TK.segBase}
                              style={{ width: `${basePct}%` }}
                            />
                          )}
                          {sessionPct > 0 && (
                            <div
                              className={TK.segSession}
                              style={{ width: `${sessionPct}%` }}
                            />
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-right tabular-nums">
                        <div className={`text-sm ${TK.sub}`}>
                          {money(tp.basePhp)}
                        </div>
                        <div className={`text-sm ${TK.sub}`}>
                          {money(tp.sessionPhp)}
                        </div>
                        <div
                          className={`font-heading text-base ${TK.num}`}
                        >
                          {money(tp.totalPhp)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {/* 합계 행 — 수업/기본급/총 */}
              <div
                className={`mt-2 grid grid-cols-1 gap-2 border-t ${TK.rowBorder} pt-3 sm:grid-cols-[minmax(8rem,1.2fr)_minmax(0,2fr)_minmax(0,3.5fr)] sm:items-center sm:gap-4`}
              >
                <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${TK.sub}`}>
                  {t("payTotal")}
                </div>
                <div />
                <div className="grid grid-cols-3 gap-2 text-right tabular-nums">
                  <div className={`text-sm ${TK.sub}`}>{money(baseTotal)}</div>
                  <div className={`text-sm ${TK.sub}`}>{money(sessionTotal)}</div>
                  <div className={`font-heading text-base font-semibold ${TK.num}`}>
                    {money(payTotal)}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function KpiLine({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className={TK.sub}>{label}</dt>
      <dd
        className={
          "tabular-nums " +
          (strong ? `font-semibold ${TK.num}` : TK.sub)
        }
      >
        {value}
      </dd>
    </div>
  );
}
