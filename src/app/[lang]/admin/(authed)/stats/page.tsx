import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { hotelDb } from "@/lib/hotel-db";
import type { BusinessStatus } from "@/generated/prisma/client";
import { applyExpiryTransitions } from "@/lib/subscription/lifecycle";
import { VerticalLabel } from "../invites/PendingInviteRow";

const STATUS_LABEL: Record<BusinessStatus, string> = {
  TRIAL: "체험중",
  ACTIVE: "정상",
  GRACE: "유예",
  EXPIRED: "만료",
  BLOCKED: "차단",
};

const STATUS_CHIP: Record<BusinessStatus, string> = {
  TRIAL: "bg-sky-50 text-sky-700 ring-sky-200",
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  GRACE: "bg-amber-50 text-amber-700 ring-amber-200",
  EXPIRED: "bg-zinc-100 text-zinc-600 ring-zinc-300",
  BLOCKED: "bg-rose-50 text-rose-700 ring-rose-200",
};

const ALL_STATUSES: BusinessStatus[] = [
  "TRIAL",
  "ACTIVE",
  "GRACE",
  "EXPIRED",
  "BLOCKED",
];

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

type Vertical = "GYM" | "HOTEL";

type GymGridRow = {
  id: string;
  vertical: Vertical;
  name: string;
  slug: string;
  status: BusinessStatus;
  ownerName: string | null;
  activeMembers: number | null;
  newCustomersThisMonth: number | null;
  totalRevenue: number;
  monthRevenue: number;
  createdAt: Date;
};

function parseYear(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return fallback;
  if (n < 1970 || n > 9999) return fallback;
  return n;
}

function monthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export default async function AdminStatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ yearFrom?: string; yearTo?: string }>;
}) {
  const { lang } = await params;
  const sp = await searchParams;

  await applyExpiryTransitions();

  const currentYear = new Date().getFullYear();
  let yearFrom = parseYear(sp.yearFrom, currentYear);
  let yearTo = parseYear(sp.yearTo, currentYear);
  if (yearFrom > yearTo) [yearFrom, yearTo] = [yearTo, yearFrom];

  const rangeStart = new Date(yearFrom, 0, 1);
  const rangeEnd = new Date(yearTo + 1, 0, 1);

  const years: number[] = [];
  for (let y = yearFrom; y <= yearTo; y++) years.push(y);

  const mStart = monthStart();

  // 헬스장 + 호텔 두 DB 의 6 query 씩 병렬. 호텔 schema 는 회원/신규 회원 개념이 없으니
  // 호텔 row 의 그 두 컬럼은 null 로 가공. 매출/매장수/상태분포는 KRW 통일 합산.
  const [
    gymRangePayments,
    gymStatusGroups,
    gymBusinesses,
    gymPaymentByGym,
    gymMonthPaymentByGym,
    gymNewCustomerByGym,
    hotelRangePayments,
    hotelStatusGroups,
    hotelBusinesses,
    hotelPaymentByHotel,
    hotelMonthPaymentByHotel,
  ] = await Promise.all([
    prisma.payment.findMany({
      where: { paidAt: { gte: rangeStart, lt: rangeEnd } },
      select: { amountPhp: true, paidAt: true },
    }),
    prisma.business.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.business.findMany({
      include: {
        _count: {
          select: {
            users: { where: { role: "CUSTOMER", status: "ACTIVE" } },
          },
        },
        users: {
          where: { role: "OWNER" },
          select: { name: true },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.payment.groupBy({ by: ["gymId"], _sum: { amountPhp: true } }),
    prisma.payment.groupBy({
      by: ["gymId"],
      where: { paidAt: { gte: mStart } },
      _sum: { amountPhp: true },
    }),
    prisma.user.groupBy({
      by: ["gymId"],
      where: {
        role: "CUSTOMER",
        createdAt: { gte: mStart },
        gymId: { not: null },
      },
      _count: { _all: true },
    }),
    hotelDb.payment.findMany({
      where: { paidAt: { gte: rangeStart, lt: rangeEnd } },
      select: { amountPhp: true, paidAt: true },
    }),
    hotelDb.business.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    hotelDb.business.findMany({
      include: {
        users: {
          where: { role: "OWNER" },
          select: { name: true },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    hotelDb.payment.groupBy({ by: ["hotelId"], _sum: { amountPhp: true } }),
    hotelDb.payment.groupBy({
      by: ["hotelId"],
      where: { paidAt: { gte: mStart } },
      _sum: { amountPhp: true },
    }),
  ]);

  // year -> month -> sum (헬스장 + 호텔 합산)
  const grid: Record<number, Record<number, number>> = {};
  const yearTotals: Record<number, number> = {};
  for (const y of years) {
    grid[y] = {};
    yearTotals[y] = 0;
    for (const m of MONTHS) grid[y][m] = 0;
  }
  for (const p of [...gymRangePayments, ...hotelRangePayments]) {
    const y = p.paidAt.getFullYear();
    const m = p.paidAt.getMonth() + 1;
    if (grid[y]) {
      grid[y][m] = (grid[y][m] ?? 0) + p.amountPhp;
      yearTotals[y] = (yearTotals[y] ?? 0) + p.amountPhp;
    }
  }
  const grandTotal = years.reduce((s, y) => s + (yearTotals[y] ?? 0), 0);

  // status 분포 = 두 DB 합산
  const statusCount: Record<BusinessStatus, number> = {
    TRIAL: 0,
    ACTIVE: 0,
    GRACE: 0,
    EXPIRED: 0,
    BLOCKED: 0,
  };
  for (const g of [...gymStatusGroups, ...hotelStatusGroups]) {
    statusCount[g.status as BusinessStatus] += g._count._all;
  }

  // 가맹점별 매출/신규 회원 map (헬스장)
  const gymPaymentMap = new Map<string, number>();
  for (const r of gymPaymentByGym) {
    gymPaymentMap.set(r.gymId, r._sum.amountPhp ?? 0);
  }
  const gymMonthPaymentMap = new Map<string, number>();
  for (const r of gymMonthPaymentByGym) {
    gymMonthPaymentMap.set(r.gymId, r._sum.amountPhp ?? 0);
  }
  const gymNewCustomerMap = new Map<string, number>();
  for (const r of gymNewCustomerByGym) {
    if (r.gymId) gymNewCustomerMap.set(r.gymId, r._count._all);
  }

  // 호텔 매장별 매출 map (회원 개념 X)
  const hotelPaymentMap = new Map<string, number>();
  for (const r of hotelPaymentByHotel) {
    hotelPaymentMap.set(r.hotelId, r._sum.amountPhp ?? 0);
  }
  const hotelMonthPaymentMap = new Map<string, number>();
  for (const r of hotelMonthPaymentByHotel) {
    hotelMonthPaymentMap.set(r.hotelId, r._sum.amountPhp ?? 0);
  }

  // 두 vertical row 합쳐 createdAt desc 정렬
  const gymGridRows: GymGridRow[] = gymBusinesses.map((b) => ({
    id: b.id,
    vertical: "GYM",
    name: b.name,
    slug: b.slug,
    status: b.status as BusinessStatus,
    ownerName: b.users[0]?.name ?? null,
    activeMembers: b._count.users,
    newCustomersThisMonth: gymNewCustomerMap.get(b.id) ?? 0,
    totalRevenue: gymPaymentMap.get(b.id) ?? 0,
    monthRevenue: gymMonthPaymentMap.get(b.id) ?? 0,
    createdAt: b.createdAt,
  }));

  const hotelGridRows: GymGridRow[] = hotelBusinesses.map((b) => ({
    id: b.id,
    vertical: "HOTEL",
    name: b.name,
    slug: b.slug,
    status: b.status as BusinessStatus,
    ownerName: b.users[0]?.name ?? null,
    activeMembers: null,
    newCustomersThisMonth: null,
    totalRevenue: hotelPaymentMap.get(b.id) ?? 0,
    monthRevenue: hotelMonthPaymentMap.get(b.id) ?? 0,
    createdAt: b.createdAt,
  }));

  const businesses: GymGridRow[] = [...gymGridRows, ...hotelGridRows].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  const totalBusinesses = businesses.length;

  // 가맹점 그리드 컬럼 (CSS grid)
  const gymGridCols =
    "grid-cols-[minmax(160px,2fr)_minmax(120px,1.3fr)_minmax(80px,0.8fr)_minmax(80px,0.8fr)_minmax(140px,1.4fr)]";

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/70">
          Stats
        </span>
        <h1 className="font-heading text-3xl tracking-tight text-ink sm:text-4xl">
          플랫폼 통계
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-ink/70">
          헬스장 + 호텔 매출 합산 (KRW, 환불 음수 결제 포함 net). 총 {totalBusinesses}개 매장.
        </p>
      </header>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-heading text-xl tracking-tight text-ink">
            매출 (월별 · 년도별)
          </h2>
        </div>

        <form
          method="GET"
          className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-zinc-700">시작 년도</span>
            <input
              type="number"
              name="yearFrom"
              min={1970}
              max={9999}
              step={1}
              defaultValue={yearFrom}
              className="h-9 w-28 rounded-md border border-zinc-300 bg-white px-3 text-right text-sm text-zinc-900 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-zinc-700">종료 년도</span>
            <input
              type="number"
              name="yearTo"
              min={1970}
              max={9999}
              step={1}
              defaultValue={yearTo}
              className="h-9 w-28 rounded-md border border-zinc-300 bg-white px-3 text-right text-sm text-zinc-900 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
            />
          </label>
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-md bg-ink px-4 text-xs font-medium text-white transition hover:bg-ink/90"
          >
            적용
          </button>
          <span className="text-[11px] text-zinc-500">
            기본값 = 현재 년도 ({currentYear}). Enter 로도 조회.
          </span>
        </form>

        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed border-separate border-spacing-0 rounded-xl border border-zinc-200 bg-white text-sm">
            <thead>
              <tr className="bg-zinc-50 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
                <th className="w-20 border-b border-zinc-200 px-3 py-2 text-center">
                  월
                </th>
                {years.map((y) => (
                  <th
                    key={y}
                    className="border-b border-l border-zinc-200 px-3 py-2 text-center"
                  >
                    {y}년
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MONTHS.map((m) => (
                <tr key={m}>
                  <td className="border-b border-zinc-100 bg-zinc-50/50 px-3 py-2 text-center text-zinc-700">
                    {m}월
                  </td>
                  {years.map((y) => {
                    const v = grid[y]?.[m] ?? 0;
                    return (
                      <td
                        key={y}
                        className="border-b border-l border-zinc-100 px-3 py-2 text-right tabular-nums text-zinc-900"
                      >
                        {v > 0 ? `${v.toLocaleString()}₩` : "-"}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="bg-amber-50/60 font-semibold">
                <td className="border-t border-amber-200 px-3 py-2 text-center text-amber-900">
                  년 합계
                </td>
                {years.map((y) => (
                  <td
                    key={y}
                    className="border-l border-t border-amber-200 px-3 py-2 text-right tabular-nums text-amber-900"
                  >
                    {yearTotals[y]?.toLocaleString() ?? 0}₩
                  </td>
                ))}
              </tr>
              {years.length > 1 && (
                <tr className="bg-amber-100/60 font-semibold">
                  <td
                    className="border-t border-amber-300 px-3 py-2 text-center text-amber-900"
                    colSpan={1}
                  >
                    전체 합계
                  </td>
                  <td
                    className="border-l border-t border-amber-300 px-3 py-2 text-right tabular-nums text-amber-900"
                    colSpan={years.length}
                  >
                    {grandTotal.toLocaleString()}₩
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-heading mb-4 text-xl tracking-tight text-ink">
          상태별 분포 (헬스장 + 호텔 합산)
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {ALL_STATUSES.map((s) => (
            <div
              key={s}
              className="rounded-2xl border border-zinc-200 bg-white p-4"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ${STATUS_CHIP[s]}`}
                >
                  {STATUS_LABEL[s]}
                </span>
              </div>
              <div className="mt-3 text-3xl font-semibold tracking-tight text-ink">
                {statusCount[s].toLocaleString()}
              </div>
              <div className="text-[11px] text-zinc-500">매장</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-heading mb-4 text-xl tracking-tight text-ink">
          가맹점별
        </h2>
        {businesses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-500">
            등록된 매장이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[820px] divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
              <div
                className={`grid ${gymGridCols} gap-3 bg-zinc-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-600`}
              >
                <div className="text-center">매장이름</div>
                <div className="text-center">사장님이름</div>
                <div className="text-center">활성 회원</div>
                <div className="text-center">이번 달 신규</div>
                <div className="text-center">누적 매출</div>
              </div>
              {businesses.map((b) => {
                const cells = (
                  <>
                    <div className="min-w-0 truncate text-left text-zinc-900">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{b.name}</span>
                        <VerticalLabel vertical={b.vertical} />
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide ring-1 ${STATUS_CHIP[b.status]}`}
                        >
                          {STATUS_LABEL[b.status]}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500">/{b.slug}</div>
                    </div>

                    <div className="min-w-0 truncate text-left text-zinc-800">
                      {b.ownerName ?? "-"}
                    </div>

                    <div className="text-right tabular-nums text-zinc-900">
                      {b.activeMembers === null
                        ? "-"
                        : b.activeMembers.toLocaleString()}
                    </div>

                    <div className="text-right tabular-nums text-zinc-900">
                      {b.newCustomersThisMonth === null
                        ? "-"
                        : b.newCustomersThisMonth.toLocaleString()}
                    </div>

                    <div className="text-right tabular-nums text-zinc-900">
                      <div>{b.totalRevenue.toLocaleString()}₩</div>
                      <div className="text-[11px] text-zinc-500">
                        이번 달 {b.monthRevenue.toLocaleString()}₩
                      </div>
                    </div>
                  </>
                );

                return (
                  <Link
                    key={`${b.vertical}-${b.id}`}
                    href={`/${lang}/admin/businesses/${b.id}`}
                    className={`grid ${gymGridCols} gap-3 bg-white px-4 py-3 text-sm transition hover:bg-zinc-50`}
                  >
                    {cells}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
