import Link from "next/link";
import { prisma } from "@/lib/db/client";
import type { BusinessStatus, Prisma } from "@/generated/prisma/client";
import { applyExpiryTransitions } from "@/lib/subscription/lifecycle";

const dateFmt = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" });
function fmt(d: Date | null | undefined): string {
  if (!d) return "-";
  return dateFmt.format(d);
}

const DAY_MS = 1000 * 60 * 60 * 24;
const EXPIRING_DAYS = 30;

function daysUntil(d: Date | null | undefined): number | null {
  if (!d) return null;
  return Math.ceil((d.getTime() - Date.now()) / DAY_MS);
}

type FilterValue =
  | "ALL"
  | "EXPIRING_1M"
  | BusinessStatus;

const FILTER_OPTIONS: { value: FilterValue; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "EXPIRING_1M", label: "한달 안 만료" },
  { value: "TRIAL", label: "체험중" },
  { value: "ACTIVE", label: "정상" },
  { value: "GRACE", label: "유예" },
  { value: "EXPIRED", label: "만료" },
  { value: "BLOCKED", label: "차단" },
];

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

const GRID_COLS = "grid-cols-[minmax(160px,2fr)_minmax(220px,2.5fr)_minmax(120px,1.2fr)_minmax(140px,1.3fr)_minmax(100px,1fr)]";

export default async function AdminSubscriptionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { lang } = await params;
  const sp = await searchParams;

  const { toGrace, toExpired } = await applyExpiryTransitions();

  const filter = FILTER_OPTIONS.find((o) => o.value === sp.status)?.value
    ?? "ALL";

  const now = new Date();
  const monthAhead = new Date(Date.now() + EXPIRING_DAYS * DAY_MS);

  const where: Prisma.BusinessWhereInput = (() => {
    if (filter === "ALL") return {};
    if (filter === "EXPIRING_1M") {
      return {
        subscription: { endDate: { gte: now, lte: monthAhead } },
      };
    }
    return { status: filter };
  })();

  const businesses = await prisma.business.findMany({
    where,
    include: {
      subscription: true,
      users: {
        where: { role: "OWNER" },
        select: { name: true },
        take: 1,
      },
    },
    orderBy: [
      { subscription: { endDate: "asc" } },
      { createdAt: "desc" },
    ],
  });

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/70">
          Subscriptions
        </span>
        <h1 className="font-heading text-3xl tracking-tight text-ink sm:text-4xl">
          구독 관리
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-ink/70">
          가맹점 구독 만료 임박 순 정렬. 결제 입금 확인은 매장 행 클릭 후 등록.
          만료일 다음날부터 7일 유예, 7일 후 자동 EXPIRED.
        </p>
        {(toGrace > 0 || toExpired > 0) && (
          <div className="mt-2 inline-flex flex-wrap items-center gap-2 rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-900 ring-1 ring-amber-200">
            이번 진입에서 자동 transition:
            {toGrace > 0 && <span>유예 {toGrace}개</span>}
            {toExpired > 0 && <span>만료 {toExpired}개</span>}
          </div>
        )}
      </header>

      <nav className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((opt) => {
          const active = filter === opt.value;
          const href =
            opt.value === "ALL"
              ? `/${lang}/admin/subscriptions`
              : `/${lang}/admin/subscriptions?status=${opt.value}`;
          return (
            <Link
              key={opt.value}
              href={href}
              className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "bg-ink text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              {opt.label}
            </Link>
          );
        })}
      </nav>

      <section>
        {businesses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-500">
            해당 조건에 맞는 매장이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[820px] divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
              <div
                className={`grid ${GRID_COLS} gap-3 bg-zinc-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-600`}
              >
                <div className="text-center">매장이름</div>
                <div className="text-center">구독 기간</div>
                <div className="text-center">사장님이름</div>
                <div className="text-center">매장전화번호</div>
                <div className="text-center">상태</div>
              </div>
              {businesses.map((b) => {
                const days = daysUntil(b.subscription?.endDate);
                const isExpiringSoon =
                  days !== null && days >= 0 && days <= EXPIRING_DAYS;
                const owner = b.users[0];
                return (
                  <Link
                    key={b.id}
                    href={`/${lang}/admin/subscriptions/${b.id}`}
                    className={`grid ${GRID_COLS} gap-3 px-4 py-3 text-sm transition hover:bg-zinc-50 ${
                      isExpiringSoon ? "bg-amber-50/70" : "bg-white"
                    }`}
                  >
                    <div className="min-w-0 truncate text-left text-zinc-900">
                      <div className="font-medium">{b.name}</div>
                      <div className="text-[11px] text-zinc-500">
                        /{b.slug}
                      </div>
                    </div>

                    <div className="min-w-0 text-left text-zinc-700">
                      {b.subscription ? (
                        <>
                          <div>
                            {fmt(b.subscription.startDate)} ~ {fmt(b.subscription.endDate)}
                          </div>
                          <div className="text-[11px] text-zinc-500">
                            {days === null
                              ? "-"
                              : days < 0
                                ? `${Math.abs(days)}일 지남`
                                : `${days}일 남음`}
                          </div>
                        </>
                      ) : (
                        <span className="text-zinc-400">구독 정보 없음</span>
                      )}
                    </div>

                    <div className="min-w-0 truncate text-left text-zinc-800">
                      {owner?.name ?? "-"}
                    </div>

                    <div className="min-w-0 truncate text-left font-mono text-xs text-zinc-700">
                      {b.phone ?? "-"}
                    </div>

                    <div className="flex items-center justify-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ${STATUS_CHIP[b.status]}`}
                      >
                        {STATUS_LABEL[b.status]}
                      </span>
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
