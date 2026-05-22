import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { getTheme } from "@/lib/theme";
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

const TONE = {
  normal: {
    page: "bg-amber-50/50",
    aside: "bg-band",
    border: "border-ink/10",
    eyebrow: "text-ink/70",
    name: "text-ink",
    sub: "text-ink/60",
    logout: "text-ink/80 hover:bg-white/40",
    h1: "text-ink",
    card: "border-ink/10 bg-white",
    num: "text-ink",
    rowBorder: "border-ink/5",
  },
  black: {
    page: "bg-zinc-950 text-zinc-200",
    aside: "bg-black",
    border: "border-white/5",
    eyebrow: "text-lime-300/80",
    name: "text-white",
    sub: "text-zinc-500",
    logout: "text-zinc-400 hover:bg-white/5",
    h1: "text-white",
    card: "border-white/5 bg-zinc-900",
    num: "text-white",
    rowBorder: "border-white/5",
  },
  white: {
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
  },
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
  const theme = await getTheme();
  const tk = TONE[theme];
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
      select: { id: true, user: { select: { name: true } } },
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
    total: number;
    owner: number;
    refund: number;
    net: number;
    delta: number | null;
    deltaLabel: string;
  };
  function kpi(
    label: string,
    deltaLabel: string,
    pred: (k: string) => boolean,
    prevPred: (k: string) => boolean,
  ): Kpi {
    const s = sumSales(pred);
    const refund = sumRefunds(pred);
    const prevTotal = sumSales(prevPred).total;
    return {
      label,
      total: s.total,
      owner: s.owner,
      refund,
      net: s.owner - refund,
      delta:
        prevTotal > 0
          ? Math.round(((s.total - prevTotal) / prevTotal) * 100)
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

  const periodSales = await prisma.sale.findMany({
    where: {
      gymId: business.id,
      createdAt: { gte: rangeFrom, lt: rangeTo },
    },
    select: {
      totalPaidPhp: true,
      ownerRevenuePhp: true,
      createdAt: true,
    },
  });
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
    .map((tr, i) => ({
      name: tr.user.name,
      sessions: perf[i].sessionCount,
      payPhp: perf[i].grossPhp,
    }))
    .sort((a, b) => b.payPhp - a.payPhp);
  const payTotal = trainerPay.reduce((s, x) => s + x.payPhp, 0);

  return (
    <div className={`flex min-h-screen ${tk.page}`}>
      <aside
        className={`hidden w-60 shrink-0 flex-col border-r ${tk.border} ${tk.aside} lg:flex`}
      >
        <div className={`border-b ${tk.border} px-6 py-6`}>
          <span
            className={`text-xs font-semibold uppercase tracking-[0.22em] ${tk.eyebrow}`}
          >
            {tn("studio")}
          </span>
          <div
            className={`mt-1 font-heading text-lg tracking-tight ${tk.name}`}
          >
            {business.name}
          </div>
          <div className={`mt-0.5 text-xs ${tk.sub}`}>/g/{slug}</div>
        </div>
        <SidebarNav tone={theme} />
        <div className={`border-t ${tk.border} px-3 py-4`}>
          <form action={logout.bind(null, `/${lang}/g/${slug}/login`)}>
            <button
              className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm ${tk.logout}`}
            >
              {tn("logout")}
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 px-5 py-6 sm:px-8">
        <h1
          className={`font-heading text-xl tracking-tight sm:text-2xl ${tk.h1}`}
        >
          {t("title")}
        </h1>

        {/* KPI 3장 — 총매출 + 사장몫 + 환불 + 순이익 */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {kpis.map((k) => (
            <div
              key={k.label}
              className={`rounded-2xl border ${tk.card} p-4`}
            >
              <div className="flex items-baseline justify-between">
                <span className={`text-xs ${tk.sub}`}>{k.label}</span>
                {k.delta === null ? (
                  <span className={`text-[11px] ${tk.sub}`}>
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
                className={`mt-1 font-heading text-2xl tracking-tight tabular-nums ${tk.num}`}
              >
                {money(k.total)}
              </div>
              <dl
                className={`mt-2 space-y-0.5 border-t ${tk.rowBorder} pt-2 text-xs`}
              >
                <KpiLine
                  label={t("sumOwner")}
                  value={money(k.owner)}
                  tk={tk}
                />
                <KpiLine
                  label={t("sumRefund")}
                  value={`- ${money(k.refund)}`}
                  tk={tk}
                />
                <KpiLine
                  label={t("sumNet")}
                  value={money(k.net)}
                  tk={tk}
                  strong
                />
              </dl>
            </div>
          ))}
        </div>

        {/* 매출 차트 — 순수익 / 트레이너 지급 토글 누적 막대 */}
        <RevenueChart
          tone={theme}
          lang={lang}
          slug={slug}
          view={view}
          anchorY={anchorY}
          anchorM={anchorM}
          periodLabel={periodLabel}
          series={series}
        />

        {/* 트레이너별 월 지급액 — 월급 지급용 */}
        <div className={`mt-3 rounded-2xl border ${tk.card} p-4`}>
          <div className="flex items-baseline justify-between">
            <span className={`text-xs ${tk.sub}`}>
              {t("trainerPayTitle", { y: anchorY, m: anchorM })}
            </span>
            <span className={`text-xs tabular-nums ${tk.sub}`}>
              {t("payTotal")} {money(payTotal)}
            </span>
          </div>
          {trainerPay.length === 0 ? (
            <div className={`mt-2 text-sm ${tk.sub}`}>{t("noData")}</div>
          ) : (
            <ul className="mt-2">
              {trainerPay.map((tp) => (
                <li
                  key={tp.name}
                  className={`flex items-center justify-between border-t ${tk.rowBorder} py-2.5 first:border-t-0`}
                >
                  <div>
                    <div className={`text-sm font-medium ${tk.num}`}>
                      {tp.name}
                    </div>
                    <div className={`text-[11px] ${tk.sub}`}>
                      {t("sessionCount", { n: tp.sessions })}
                    </div>
                  </div>
                  <div
                    className={`font-heading text-base tabular-nums ${tk.num}`}
                  >
                    {money(tp.payPhp)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

function KpiLine({
  label,
  value,
  tk,
  strong,
}: {
  label: string;
  value: string;
  tk: { sub: string; num: string };
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className={tk.sub}>{label}</dt>
      <dd
        className={
          "tabular-nums " +
          (strong ? `font-semibold ${tk.num}` : tk.sub)
        }
      >
        {value}
      </dd>
    </div>
  );
}
