import Link from "next/link";
import { prisma } from "@/lib/db/client";
import type { BusinessStatus } from "@/generated/prisma/client";

const dateFmt = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
});

function fmt(d: Date | null | undefined): string {
  if (!d) return "-";
  return dateFmt.format(d);
}

const STATUS_OPTIONS: { value: "ALL" | BusinessStatus; label: string }[] = [
  { value: "ALL", label: "전체" },
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

export default async function AdminBusinessesPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { lang } = await params;
  const sp = await searchParams;

  const statusFilter = STATUS_OPTIONS.find((o) => o.value === sp.status)?.value
    ?? "ALL";

  const where =
    statusFilter === "ALL"
      ? {}
      : { status: statusFilter as BusinessStatus };

  const [businesses, totalAll] = await Promise.all([
    prisma.business.findMany({
      where,
      include: {
        users: {
          where: { role: "OWNER" },
          select: {
            loginId: true,
            email: true,
            name: true,
            phone: true,
          },
          take: 1,
        },
        subscription: {
          select: { plan: true, endDate: true },
        },
        city: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.business.count(),
  ]);

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/70">
          Businesses
        </span>
        <h1 className="font-heading text-3xl tracking-tight text-ink sm:text-4xl">
          가맹점 관리
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-ink/70">
          가맹점 상태 조회 및 차단·재활성화. 총 {totalAll}개 매장.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => {
          const active = statusFilter === opt.value;
          const href =
            opt.value === "ALL"
              ? `/${lang}/admin/businesses`
              : `/${lang}/admin/businesses?status=${opt.value}`;
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
            {statusFilter === "ALL"
              ? "등록된 매장이 없습니다."
              : `${STATUS_LABEL[statusFilter as BusinessStatus]} 상태 매장이 없습니다.`}
          </div>
        ) : (
          <ul className="space-y-2">
            {businesses.map((b) => {
              const owner = b.users[0];
              return (
                <li key={b.id}>
                  <Link
                    href={`/${lang}/admin/businesses/${b.id}`}
                    className="block rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-ink"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-ink">
                            {b.name}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ${STATUS_CHIP[b.status]}`}
                          >
                            {STATUS_LABEL[b.status]}
                          </span>
                          <span className="text-xs text-zinc-500">
                            /{b.slug}
                          </span>
                          {b.city?.name && (
                            <span className="text-xs text-zinc-500">
                              · {b.city.name}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-600">
                          사장: {owner?.name ?? "(미등록)"}
                          {owner?.loginId ? ` · ${owner.loginId}` : ""}
                          {owner?.email ? ` · ${owner.email}` : ""}
                          {owner?.phone ? ` · ${owner.phone}` : ""}
                        </div>
                        <div className="text-xs text-zinc-500">
                          가입 {fmt(b.createdAt)} · 구독 {b.subscription?.plan ?? "-"}
                          {b.subscription?.endDate
                            ? ` 만료 ${fmt(b.subscription.endDate)}`
                            : ""}
                        </div>
                        {b.status === "BLOCKED" && b.blockedReason && (
                          <div className="mt-1 rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-800 ring-1 ring-rose-100">
                            사유: {b.blockedReason}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-zinc-400">상세 &gt;</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
