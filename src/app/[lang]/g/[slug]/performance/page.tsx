import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireGymStaff } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { loadTrainerMonthPerf } from "@/lib/perf/trainerMonth";

// 트레이너 월별 실적 — 월급 산정 근거(완료 세션·지급액 그리드 + 월 네비).
// 환불은 트레이너 무관(사장 전액 처리) — 실적엔 환불 개념 없음.
export default async function PerformancePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; slug: string }>;
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const { lang, slug } = await params;
  const sp = await searchParams;
  const auth = await requireGymStaff(slug);
  const gymId = auth.business!.id;
  const t = await getTranslations("trainerPerf");

  const staff = await prisma.staff.findFirst({
    where: { userId: auth.id, gymId },
    select: { id: true, user: { select: { name: true } } },
  });

  const peso = (n: number) => `₱${n.toLocaleString()}`;

  if (!staff) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-black p-6 text-zinc-300">
        <p className="text-sm">{t("trainerOnly")}</p>
        <Link
          href={`/${lang}/g/${slug}/dashboard`}
          className="rounded-md border border-white/15 px-4 py-2 text-xs text-zinc-300 hover:bg-white/5"
        >
          ← {t("back")}
        </Link>
      </div>
    );
  }

  const now = new Date();
  const curY = now.getUTCFullYear();
  const curM = now.getUTCMonth() + 1;
  let y = Number(sp.y) || curY;
  let m = Number(sp.m) || curM;
  if (m < 1 || m > 12) m = curM;

  const perf = await loadTrainerMonthPerf(gymId, staff.id, y, m);

  // 이전/다음/현재 월 링크
  const shift = (yy: number, mm: number, d: number) => {
    const idx = yy * 12 + (mm - 1) + d;
    return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
  };
  const prev = shift(y, m, -1);
  const next = shift(y, m, 1);
  const hrefFor = (yy: number, mm: number) =>
    `/${lang}/g/${slug}/performance?y=${yy}&m=${mm}`;
  const isCurrent = y === curY && m === curM;
  const periodLabel =
    lang === "en" ? `${y}-${String(m).padStart(2, "0")}` : `${y}년 ${m}월`;

  const navBtn =
    "flex h-8 items-center rounded-md border border-white/15 px-2.5 text-xs text-zinc-300 transition hover:bg-white/10";

  return (
    <div className="min-h-[100dvh] bg-black p-4 text-zinc-100">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-lg text-white">{t("title")}</h1>
            <div className="mt-0.5 text-[11px] text-amber-300/70">
              {staff.user?.name} · {perf.fromYmd} ~ {perf.toYmd}
            </div>
          </div>
          <Link
            href={`/${lang}/g/${slug}/dashboard`}
            className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
          >
            ← {t("back")}
          </Link>
        </div>

        {/* 월 네비 */}
        <div className="mt-4 flex items-center justify-between gap-2">
          <Link href={hrefFor(prev.y, prev.m)} className={navBtn}>
            ‹ {t("prevMonth")}
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">
              {periodLabel}
            </span>
            {!isCurrent && (
              <Link
                href={hrefFor(curY, curM)}
                className="rounded-md border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-[11px] font-semibold text-amber-300 transition hover:bg-amber-400 hover:text-zinc-950"
              >
                {t("thisMonth")}
              </Link>
            )}
          </div>
          <Link href={hrefFor(next.y, next.m)} className={navBtn}>
            {t("nextMonth")} ›
          </Link>
        </div>

        {/* 요약 */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/10 bg-zinc-900 p-3">
            <div className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
              {t("sessions")}
            </div>
            <div className="mt-1 text-xl font-bold tabular-nums text-white">
              {perf.sessionCount}
            </div>
          </div>
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3">
            <div className="text-[10px] uppercase tracking-[0.15em] text-emerald-300/80">
              {t("gross")}
            </div>
            <div className="mt-1 text-xl font-bold tabular-nums text-emerald-300">
              {peso(perf.grossPhp)}
            </div>
          </div>
        </div>

        {/* 완료 세션 그리드 */}
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/15 bg-zinc-900/60">
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
                  {t("colDate")}
                </th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
                  {t("colCustomer")}
                </th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
                  {t("colService")}
                </th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
                  {t("colPayout")}
                </th>
              </tr>
            </thead>
            <tbody>
              {perf.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-10 text-center text-sm text-zinc-500"
                  >
                    {t("empty")}
                  </td>
                </tr>
              ) : (
                perf.rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-white/5 hover:bg-white/5"
                  >
                    <td className="px-3 py-2.5 text-center tabular-nums text-zinc-300">
                      {r.dateYmd}
                    </td>
                    <td className="px-3 py-2.5 text-left font-medium text-white">
                      {r.customerName}
                    </td>
                    <td className="px-3 py-2.5 text-left text-zinc-300">
                      {r.serviceName}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-amber-300">
                      {peso(r.payoutPhp)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
