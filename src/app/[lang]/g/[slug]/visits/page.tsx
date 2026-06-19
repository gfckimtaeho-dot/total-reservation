import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { OwnerShell } from "../OwnerShell";
import { VisitsChart } from "./VisitsChart";

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
function gymToday(tz: string): string {
  return gymYmd(new Date(), tz);
}
function gymYesterday(tz: string): string {
  return gymYmd(new Date(Date.now() - MS_DAY), tz);
}

const TK = {
  sub: "text-zinc-500",
  card: "border-zinc-200 bg-white",
  num: "text-zinc-900",
  rowBorder: "border-zinc-100",
} as const;

type Cat = "free" | "pt" | "cls";
type Counts = { free: number; pt: number; cls: number };

// 한 회원의 하루 방문(visit-day)을 분류한다. AccessLog 에는 방문 종류가 없으므로
// 같은 날 그 회원의 예약(Reservation) 유무로 역추론한다:
//   - 그날 PT(1:1, scheduledClassId=null) 예약 있음 -> "pt"
//   - 그날 단체(scheduledClassId 있음) 예약만 있음 -> "cls"
//   - 예약 없음 -> "free"(자유운동)
// 같은 날 PT+단체 둘 다면 PT 우선. 같은 날 여러 번 스캔해도 1 방문으로 집계.
function classifyVisitDays(
  logs: { userId: string; occurredAt: Date }[],
  reservations: { customerUserId: string; startAt: Date; scheduledClassId: string | null }[],
  tz: string,
): { ymd: string; cat: Cat }[] {
  // (userId|ymd) -> 그날 예약 종류 플래그
  const resIdx = new Map<string, { pt: boolean; cls: boolean }>();
  for (const r of reservations) {
    const key = `${r.customerUserId}|${gymYmd(r.startAt, tz)}`;
    const cur = resIdx.get(key) ?? { pt: false, cls: false };
    if (r.scheduledClassId) cur.cls = true;
    else cur.pt = true;
    resIdx.set(key, cur);
  }
  const seen = new Set<string>();
  const out: { ymd: string; cat: Cat }[] = [];
  for (const l of logs) {
    const ymd = gymYmd(l.occurredAt, tz);
    const key = `${l.userId}|${ymd}`;
    if (seen.has(key)) continue; // 같은 회원 같은 날 = 1 방문
    seen.add(key);
    const r = resIdx.get(key);
    const cat: Cat = r?.pt ? "pt" : r?.cls ? "cls" : "free";
    out.push({ ymd, cat });
  }
  return out;
}

function countWhere(
  days: { ymd: string; cat: Cat }[],
  pred: (ymd: string) => boolean,
): Counts {
  const c: Counts = { free: 0, pt: 0, cls: 0 };
  for (const d of days) {
    if (pred(d.ymd)) c[d.cat] += 1;
  }
  return c;
}

export default async function VisitsPage({
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
  const t = await getTranslations("visits");

  const todayYmd = gymToday(tz);
  const ty = Number(todayYmd.slice(0, 4));
  const tm = Number(todayYmd.slice(5, 7));

  const viewRaw = one(sp.view);
  const view: "day" | "month" | "year" =
    viewRaw === "month" || viewRaw === "year" ? viewRaw : "day";
  const anchorY = Number(one(sp.y)) || ty;
  const anchorM = Math.min(12, Math.max(1, Number(one(sp.m)) || tm));

  const mm = (m: number) => String(m).padStart(2, "0");

  // ── KPI: 작년 1/1 ~ 지금 (전월/전년 대비 산출용 넉넉한 범위) ──
  const kpiFrom = new Date(Date.UTC(ty - 1, 0, 1) - MS_DAY);
  const [kpiLogs, kpiRes] = await Promise.all([
    prisma.accessLog.findMany({
      where: {
        gymId: business.id,
        result: "ALLOWED",
        user: { role: "CUSTOMER" },
        occurredAt: { gte: kpiFrom },
      },
      select: { userId: true, occurredAt: true },
    }),
    prisma.reservation.findMany({
      where: {
        gymId: business.id,
        status: { notIn: ["CANCELLED", "REJECTED"] },
        startAt: { gte: kpiFrom },
      },
      select: { customerUserId: true, startAt: true, scheduledClassId: true },
    }),
  ]);
  const kpiDays = classifyVisitDays(kpiLogs, kpiRes, tz);

  const yYmd = gymYesterday(tz);
  const lm = tm === 1 ? { y: ty - 1, m: 12 } : { y: ty, m: tm - 1 };
  const prefThisMonth = `${ty}-${mm(tm)}`;
  const prefLastMonth = `${lm.y}-${mm(lm.m)}`;

  type Kpi = {
    label: string;
    counts: Counts; // 자유운동 / PT / 단체
    delta: number | null; // 자유운동 기준 전 기간 대비 %
    deltaLabel: string;
  };
  function kpi(
    label: string,
    deltaLabel: string,
    pred: (k: string) => boolean,
    prevPred: (k: string) => boolean,
  ): Kpi {
    const counts = countWhere(kpiDays, pred);
    const prevFree = countWhere(kpiDays, prevPred).free;
    return {
      label,
      counts,
      // 자유운동 방문이 이 화면의 헤드라인 — 그 증감만 % 표시. 한쪽이 0이면 생략.
      delta:
        prevFree > 0 && counts.free > 0
          ? Math.round(((counts.free - prevFree) / prevFree) * 100)
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

  // ── 차트 기간 (revenue 와 동일 로직) ──
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
    bucketLabels = Array.from({ length: 10 }, (_, i) => String(anchorY - 9 + i));
    periodLabel = t("periodDecade", { from: anchorY - 9, to: anchorY });
  }

  const [periodLogs, periodRes] = await Promise.all([
    prisma.accessLog.findMany({
      where: {
        gymId: business.id,
        result: "ALLOWED",
        user: { role: "CUSTOMER" },
        occurredAt: { gte: rangeFrom, lt: rangeTo },
      },
      select: { userId: true, occurredAt: true },
    }),
    prisma.reservation.findMany({
      where: {
        gymId: business.id,
        status: { notIn: ["CANCELLED", "REJECTED"] },
        startAt: { gte: rangeFrom, lt: rangeTo },
      },
      select: { customerUserId: true, startAt: true, scheduledClassId: true },
    }),
  ]);
  const periodDays = classifyVisitDays(periodLogs, periodRes, tz);

  const byBucket = new Map<string, Counts>();
  for (const d of periodDays) {
    if (!inPeriod(d.ymd)) continue;
    const bk = bucketKey(d.ymd);
    const cur = byBucket.get(bk) ?? { free: 0, pt: 0, cls: 0 };
    cur[d.cat] += 1;
    byBucket.set(bk, cur);
  }
  const series = bucketLabels.map((bk, i) => {
    const c = byBucket.get(bk) ?? { free: 0, pt: 0, cls: 0 };
    return {
      label: view === "year" ? bk : String(i + 1),
      free: c.free,
      pt: c.pt,
      cls: c.cls,
    };
  });

  return (
    <OwnerShell
      lang={lang}
      slug={slug}
      businessName={business.name}
      subtitle={t("title")}
    >
      <main className="px-5 py-6 sm:px-8">
        <p className={`text-xs ${TK.sub}`}>{t("subtitle")}</p>

        {/* KPI 3장 — 자유운동 방문 건수(큰 숫자) + PT/단체 보조 라인. */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {kpis.map((k) => (
            <div key={k.label} className={`rounded-2xl border ${TK.card} p-4`}>
              <div className="flex items-baseline justify-between">
                <span className={`text-xs ${TK.sub}`}>{k.label}</span>
                {k.delta === null ? (
                  <span className={`text-[11px] ${TK.sub}`}>{k.deltaLabel} —</span>
                ) : (
                  <span
                    className={
                      "text-[11px] " +
                      (k.delta >= 0 ? "text-emerald-500" : "text-rose-500")
                    }
                  >
                    {k.deltaLabel} {k.delta >= 0 ? "+" : ""}
                    {k.delta}%
                  </span>
                )}
              </div>
              <div
                className={`mt-1 text-2xl font-semibold tracking-tight tabular-nums ${TK.num}`}
              >
                {t("freeCount", { n: k.counts.free })}
              </div>
              <dl
                className={`mt-2 space-y-0.5 border-t ${TK.rowBorder} pt-2 text-xs`}
              >
                <KpiLine label={t("legendPt")} value={k.counts.pt} />
                <KpiLine label={t("legendCls")} value={k.counts.cls} />
              </dl>
            </div>
          ))}
        </div>

        {/* 방문 차트 — 자유운동/PT/단체 누적 막대 */}
        <VisitsChart
          lang={lang}
          slug={slug}
          view={view}
          anchorY={anchorY}
          anchorM={anchorM}
          periodLabel={periodLabel}
          series={series}
        />
      </main>
    </OwnerShell>
  );
}

function KpiLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className={TK.sub}>{label}</dt>
      <dd className={`tabular-nums ${TK.sub}`}>{value.toLocaleString()}</dd>
    </div>
  );
}
