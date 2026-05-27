import Link from "next/link";
import { prisma } from "@/lib/db/client";
import type { BusinessStatus } from "@/generated/prisma/client";
import { applyExpiryTransitions } from "@/lib/subscription/lifecycle";

const dateFmt = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" });
function fmt(d: Date | null | undefined): string {
  if (!d) return "-";
  return dateFmt.format(d);
}

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

const GRID_COLS =
  "grid-cols-[minmax(160px,2fr)_minmax(120px,1.3fr)_minmax(80px,0.8fr)_minmax(80px,0.8fr)_minmax(140px,1.4fr)]";

function monthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export default async function AdminStatsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  await applyExpiryTransitions();

  const mStart = monthStart();

  const [
    totalBusinesses,
    statusGroups,
    totalRevenueAgg,
    monthRevenueAgg,
    businesses,
    paymentByGym,
    monthPaymentByGym,
    newCustomerByGym,
  ] = await Promise.all([
    prisma.business.count(),
    prisma.business.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.payment.aggregate({ _sum: { amountPhp: true } }),
    prisma.payment.aggregate({
      where: { paidAt: { gte: mStart } },
      _sum: { amountPhp: true },
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
    prisma.payment.groupBy({
      by: ["gymId"],
      _sum: { amountPhp: true },
    }),
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
  ]);

  const statusCount: Record<BusinessStatus, number> = {
    TRIAL: 0,
    ACTIVE: 0,
    GRACE: 0,
    EXPIRED: 0,
    BLOCKED: 0,
  };
  for (const g of statusGroups) {
    statusCount[g.status] = g._count._all;
  }
  const operatingCount =
    statusCount.TRIAL + statusCount.ACTIVE + statusCount.GRACE;

  const totalRevenue = totalRevenueAgg._sum.amountPhp ?? 0;
  const monthRevenue = monthRevenueAgg._sum.amountPhp ?? 0;

  const paymentMap = new Map<string, number>();
  for (const r of paymentByGym) {
    paymentMap.set(r.gymId, r._sum.amountPhp ?? 0);
  }
  const monthPaymentMap = new Map<string, number>();
  for (const r of monthPaymentByGym) {
    monthPaymentMap.set(r.gymId, r._sum.amountPhp ?? 0);
  }
  const newCustomerMap = new Map<string, number>();
  for (const r of newCustomerByGym) {
    if (r.gymId) newCustomerMap.set(r.gymId, r._count._all);
  }

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
          가맹점 수와 구독 매출 (KRW). 매출은 환불(음수 결제) 포함한 net.
          이번 달 기준 = {fmt(mStart)} 부터.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="총 매장" value={totalBusinesses.toLocaleString()} />
        <KpiCard
          label="운영중"
          value={operatingCount.toLocaleString()}
          hint={`총 ${totalBusinesses} 중`}
        />
        <KpiCard
          label="이번 달 매출"
          value={`${monthRevenue.toLocaleString()}₩`}
        />
        <KpiCard
          label="누적 매출"
          value={`${totalRevenue.toLocaleString()}₩`}
        />
      </section>

      <section>
        <h2 className="font-heading mb-4 text-xl tracking-tight text-ink">
          상태별 분포
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
                className={`grid ${GRID_COLS} gap-3 bg-zinc-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-600`}
              >
                <div className="text-center">매장이름</div>
                <div className="text-center">사장님이름</div>
                <div className="text-center">활성 회원</div>
                <div className="text-center">이번 달 신규</div>
                <div className="text-center">누적 매출</div>
              </div>
              {businesses.map((b) => {
                const owner = b.users[0];
                const totalSum = paymentMap.get(b.id) ?? 0;
                const monthSum = monthPaymentMap.get(b.id) ?? 0;
                const newCustomers = newCustomerMap.get(b.id) ?? 0;
                return (
                  <Link
                    key={b.id}
                    href={`/${lang}/admin/businesses/${b.id}`}
                    className="grid grid-cols-[minmax(160px,2fr)_minmax(120px,1.3fr)_minmax(80px,0.8fr)_minmax(80px,0.8fr)_minmax(140px,1.4fr)] gap-3 bg-white px-4 py-3 text-sm transition hover:bg-zinc-50"
                  >
                    <div className="min-w-0 truncate text-left text-zinc-900">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{b.name}</span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide ring-1 ${STATUS_CHIP[b.status]}`}
                        >
                          {STATUS_LABEL[b.status]}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        /{b.slug}
                      </div>
                    </div>

                    <div className="min-w-0 truncate text-left text-zinc-800">
                      {owner?.name ?? "-"}
                    </div>

                    <div className="text-right tabular-nums text-zinc-900">
                      {b._count.users.toLocaleString()}
                    </div>

                    <div className="text-right tabular-nums text-zinc-900">
                      {newCustomers.toLocaleString()}
                    </div>

                    <div className="text-right tabular-nums text-zinc-900">
                      <div>{totalSum.toLocaleString()}₩</div>
                      <div className="text-[11px] text-zinc-500">
                        이번 달 {monthSum.toLocaleString()}₩
                      </div>
                    </div>
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

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/60">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        {value}
      </div>
      {hint && <div className="mt-1 text-[11px] text-zinc-500">{hint}</div>}
    </div>
  );
}
