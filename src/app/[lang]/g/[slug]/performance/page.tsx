import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireGymStaff } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { loadTrainerMonthPerf } from "@/lib/perf/trainerMonth";
import {
  loadTrainerYearPerf,
  loadTrainerDecadePerf,
} from "@/lib/perf/trainerPerf";

type View = "daily" | "monthly" | "yearly";
type T = (key: string) => string;

// 트레이너 실적 — 상단 "이번 달" 요약 고정 + 일별/월별/년도별 탭.
//  일별: 선택 월의 완료 세션 1건당 1행 (누구·무슨 서비스)
//  월별: 선택 년도 12개월 집계
//  년도별: 선택 년도 포함 과거 10년 집계
export default async function PerformancePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; slug: string }>;
  searchParams: Promise<{ view?: string; y?: string; m?: string }>;
}) {
  const { lang, slug } = await params;
  const sp = await searchParams;
  const auth = await requireGymStaff(slug);
  const gymId = auth.business!.id;
  const t = (await getTranslations("trainerPerf")) as unknown as T;

  const staff = await prisma.staff.findFirst({
    where: { userId: auth.id, gymId },
    select: { id: true, user: { select: { name: true } } },
  });

  const peso = (n: number) => `₱${n.toLocaleString()}`;

  if (!staff) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-black p-6 text-zinc-300">
        <p className="text-base">{t("trainerOnly")}</p>
        <Link
          href={`/${lang}/g/${slug}/dashboard`}
          className="rounded-md border border-white/15 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-white/5"
        >
          ← {t("back")}
        </Link>
      </div>
    );
  }

  const now = new Date();
  const curY = now.getUTCFullYear();
  const curM = now.getUTCMonth() + 1;

  const view: View =
    sp.view === "monthly" || sp.view === "yearly" ? sp.view : "daily";
  let y = Number(sp.y) || curY;
  let m = Number(sp.m) || curM;
  if (m < 1 || m > 12) m = curM;

  // 상단 요약 — 항상 이번 달.
  const thisMonth = await loadTrainerMonthPerf(gymId, staff.id, curY, curM);

  const daily =
    view === "daily"
      ? await loadTrainerMonthPerf(gymId, staff.id, y, m)
      : null;
  const yearPerf =
    view === "monthly"
      ? await loadTrainerYearPerf(gymId, staff.id, y)
      : null;
  const decade =
    view === "yearly"
      ? await loadTrainerDecadePerf(gymId, staff.id, y)
      : null;

  const base = `/${lang}/g/${slug}/performance`;
  const shift = (yy: number, mm: number, d: number) => {
    const idx = yy * 12 + (mm - 1) + d;
    return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
  };
  const monthLabel = (yy: number, mm: number) =>
    lang === "en" ? `${yy}-${String(mm).padStart(2, "0")}` : `${yy}년 ${mm}월`;
  const yearLabel = (yy: number) => (lang === "en" ? `${yy}` : `${yy}년`);

  // 홈 버튼(dashboard 헤더 표준)과 통일된 사이즈. px-4 py-2.5 text-sm.
  const navBtn =
    "flex items-center rounded-md border border-white/15 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/10";
  const jumpBtn =
    "rounded-md border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-sm font-semibold text-amber-300 transition hover:bg-amber-400 hover:text-zinc-950";

  const tabs: { key: View; label: string }[] = [
    { key: "daily", label: t("tabDaily") },
    { key: "monthly", label: t("tabMonthly") },
    { key: "yearly", label: t("tabYearly") },
  ];

  return (
    <div className="min-h-[100dvh] bg-black p-4 text-zinc-100">
      <div className="mx-auto max-w-3xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-white">
              {t("title")}
            </h1>
            <div className="mt-1.5 text-3xl font-bold text-amber-300">
              {staff.user?.name}
            </div>
          </div>
          <Link
            href={`/${lang}/g/${slug}/dashboard`}
            className="shrink-0 rounded-md border border-white/15 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/5"
          >
            ← {t("back")}
          </Link>
        </div>

        {/* 이번 달 요약 — 고정 */}
        <div className="mt-5">
          <div className="text-xl font-bold tracking-tight text-amber-300/90">
            {t("summaryThisMonth")} · {monthLabel(curY, curM)}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-zinc-900 p-5">
              <div className="text-base font-medium uppercase tracking-[0.12em] text-zinc-400">
                {t("sessions")}
              </div>
              <div className="mt-2 text-4xl font-bold tabular-nums text-white">
                {thisMonth.sessionCount}
              </div>
            </div>
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-5">
              <div className="text-base font-medium uppercase tracking-[0.12em] text-emerald-300/90">
                {t("gross")}
              </div>
              <div className="mt-2 text-4xl font-bold tabular-nums text-emerald-300">
                {peso(thisMonth.grossPhp)}
              </div>
            </div>
          </div>
        </div>

        {/* 일별 / 월별 / 년도별 탭 */}
        <div className="mt-6 flex gap-2">
          {tabs.map((tab) => {
            const active = tab.key === view;
            return (
              <Link
                key={tab.key}
                href={`${base}?view=${tab.key}`}
                className={`flex-1 rounded-md border px-4 py-2.5 text-center text-base font-semibold transition ${
                  active
                    ? "border-amber-400/60 bg-amber-400/15 text-amber-300"
                    : "border-white/15 text-zinc-400 hover:bg-white/5"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        {/* 일별 — 선택 월의 완료 세션 목록 */}
        {view === "daily" && daily && (
          <>
            <div className="mt-5 flex items-center justify-between gap-3">
              {(() => {
                const p = shift(y, m, -1);
                const n = shift(y, m, 1);
                return (
                  <>
                    <Link
                      href={`${base}?view=daily&y=${p.y}&m=${p.m}`}
                      className={navBtn}
                    >
                      ‹ {t("prevMonth")}
                    </Link>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold text-white">
                        {monthLabel(y, m)}
                      </span>
                      {!(y === curY && m === curM) && (
                        <Link href={`${base}?view=daily`} className={jumpBtn}>
                          {t("thisMonth")}
                        </Link>
                      )}
                    </div>
                    <Link
                      href={`${base}?view=daily&y=${n.y}&m=${n.m}`}
                      className={navBtn}
                    >
                      {t("nextMonth")} ›
                    </Link>
                  </>
                );
              })()}
            </div>
            <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-lg">
                <thead>
                  <tr className="border-b border-white/15 bg-zinc-900/60">
                    <Th>{t("colDate")}</Th>
                    <Th>{t("colCustomer")}</Th>
                    <Th>{t("colService")}</Th>
                    <Th>{t("colPayout")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {daily.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-14 text-center text-lg text-zinc-500"
                      >
                        {t("empty")}
                      </td>
                    </tr>
                  ) : (
                    <>
                      {daily.rows.map((r) => (
                        <tr
                          key={r.id}
                          className="border-b border-white/5 hover:bg-white/5"
                        >
                          <td className="px-4 py-4 text-center tabular-nums text-zinc-300">
                            {r.dateYmd}
                          </td>
                          <td className="px-4 py-4 text-left font-medium text-white">
                            {r.customerName}
                          </td>
                          <td className="px-4 py-4 text-left text-zinc-300">
                            {r.serviceName}
                          </td>
                          <td className="px-4 py-4 text-right tabular-nums text-amber-300">
                            {peso(r.payoutPhp)}
                          </td>
                        </tr>
                      ))}
                      {/* 합계 행 — 페이지 스크롤 어느 위치에서도 항상 보이게
                          각 td 에 sticky bottom-0. tr 자체 sticky 는 브라우저
                          지원이 들쭉날쭉이라 td 단위로 적용 + 각 td 에 배경색
                          명시(투명이면 스크롤 시 본문이 비쳐 보임). */}
                      <tr className="text-xl font-bold">
                        <td
                          colSpan={2}
                          className="sticky bottom-0 z-10 border-t-2 border-white/30 bg-zinc-900 px-4 py-5 text-left text-white"
                        >
                          {t("total")}
                        </td>
                        <td className="sticky bottom-0 z-10 border-t-2 border-white/30 bg-zinc-900 px-4 py-5 text-right tabular-nums text-white">
                          {daily.sessionCount}
                        </td>
                        <td className="sticky bottom-0 z-10 border-t-2 border-white/30 bg-zinc-900 px-4 py-5 text-right tabular-nums text-emerald-300">
                          {peso(daily.grossPhp)}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* 월별 — 선택 년도 12개월 집계 */}
        {view === "monthly" && yearPerf && (
          <>
            <PeriodNav
              prevHref={`${base}?view=monthly&y=${y - 1}`}
              nextHref={`${base}?view=monthly&y=${y + 1}`}
              label={yearLabel(y)}
              jumpHref={y === curY ? null : `${base}?view=monthly`}
              jumpLabel={t("thisYear")}
              prevLabel={t("prevYear")}
              nextLabel={t("nextYear")}
              navBtn={navBtn}
              jumpBtn={jumpBtn}
            />
            <AggTable
              firstColLabel={t("colMonth")}
              rows={yearPerf.months.map((mo) => ({
                key: mo.month,
                label: lang === "en" ? String(mo.month) : `${mo.month}월`,
                sessionCount: mo.sessionCount,
                grossPhp: mo.grossPhp,
              }))}
              total={yearPerf.total}
              t={t}
              peso={peso}
            />
          </>
        )}

        {/* 년도별 — 선택 년도 포함 과거 10년 집계 */}
        {view === "yearly" && decade && (
          <>
            <PeriodNav
              prevHref={`${base}?view=yearly&y=${y - 1}`}
              nextHref={`${base}?view=yearly&y=${y + 1}`}
              label={yearLabel(y)}
              jumpHref={y === curY ? null : `${base}?view=yearly`}
              jumpLabel={t("thisYear")}
              prevLabel={t("prevYear")}
              nextLabel={t("nextYear")}
              navBtn={navBtn}
              jumpBtn={jumpBtn}
            />
            <AggTable
              firstColLabel={t("colYear")}
              rows={decade.years.map((yr) => ({
                key: yr.year,
                label: yearLabel(yr.year),
                sessionCount: yr.sessionCount,
                grossPhp: yr.grossPhp,
              }))}
              total={decade.total}
              t={t}
              peso={peso}
            />
          </>
        )}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-4 text-center text-sm font-semibold uppercase tracking-[0.15em] text-zinc-400">
      {children}
    </th>
  );
}

function PeriodNav({
  prevHref,
  nextHref,
  label,
  jumpHref,
  jumpLabel,
  prevLabel,
  nextLabel,
  navBtn,
  jumpBtn,
}: {
  prevHref: string;
  nextHref: string;
  label: string;
  jumpHref: string | null;
  jumpLabel: string;
  prevLabel: string;
  nextLabel: string;
  navBtn: string;
  jumpBtn: string;
}) {
  return (
    <div className="mt-5 flex items-center justify-between gap-3">
      <Link href={prevHref} className={navBtn}>
        ‹ {prevLabel}
      </Link>
      <div className="flex items-center gap-2">
        <span className="text-base font-semibold text-white">{label}</span>
        {jumpHref && (
          <Link href={jumpHref} className={jumpBtn}>
            {jumpLabel}
          </Link>
        )}
      </div>
      <Link href={nextHref} className={navBtn}>
        {nextLabel} ›
      </Link>
    </div>
  );
}

// 월별·년도별 공용 집계 표 — 1열(월/년도) · 세션 수 · 지급액 + 합계 행.
function AggTable({
  firstColLabel,
  rows,
  total,
  t,
  peso,
}: {
  firstColLabel: string;
  rows: {
    key: number;
    label: string;
    sessionCount: number;
    grossPhp: number;
  }[];
  total: { sessionCount: number; grossPhp: number };
  t: T;
  peso: (n: number) => string;
}) {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-lg">
        <thead>
          <tr className="border-b border-white/15 bg-zinc-900/60">
            <Th>{firstColLabel}</Th>
            <Th>{t("sessions")}</Th>
            <Th>{t("colPayout")}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const empty = r.sessionCount === 0;
            return (
              <tr
                key={r.key}
                className="border-b border-white/5 hover:bg-white/5"
              >
                <td
                  className={`px-4 py-4 text-center font-medium tabular-nums ${
                    empty ? "text-zinc-600" : "text-white"
                  }`}
                >
                  {r.label}
                </td>
                <td
                  className={`px-4 py-4 text-right tabular-nums ${
                    empty ? "text-zinc-600" : "text-zinc-300"
                  }`}
                >
                  {r.sessionCount}
                </td>
                <td
                  className={`px-4 py-4 text-right tabular-nums ${
                    empty ? "text-zinc-600" : "text-amber-300"
                  }`}
                >
                  {peso(r.grossPhp)}
                </td>
              </tr>
            );
          })}
          <tr className="text-xl font-bold">
            <td className="sticky bottom-0 z-10 border-t-2 border-white/30 bg-zinc-900 px-4 py-5 text-left text-white">
              {t("total")}
            </td>
            <td className="sticky bottom-0 z-10 border-t-2 border-white/30 bg-zinc-900 px-4 py-5 text-right tabular-nums text-white">
              {total.sessionCount}
            </td>
            <td className="sticky bottom-0 z-10 border-t-2 border-white/30 bg-zinc-900 px-4 py-5 text-right tabular-nums text-emerald-300">
              {peso(total.grossPhp)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
