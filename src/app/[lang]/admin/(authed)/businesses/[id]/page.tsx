import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import type { BusinessStatus } from "@/generated/prisma/client";
import { BlockForm } from "./BlockForm";

const dateFmt = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
});

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

export default async function AdminBusinessDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;

  const business = await prisma.business.findUnique({
    where: { id },
    include: {
      users: {
        where: { role: "OWNER" },
        select: {
          id: true,
          loginId: true,
          email: true,
          name: true,
          phone: true,
        },
        take: 1,
      },
      subscription: true,
      city: { select: { name: true } },
      barangay: { select: { name: true } },
    },
  });

  if (!business) notFound();

  const owner = business.users[0];

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/${lang}/admin/businesses`}
          className="text-xs text-zinc-600 transition hover:text-ink"
        >
          &lt; 가맹점 목록
        </Link>
      </div>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl tracking-tight text-ink sm:text-4xl">
            {business.name}
          </h1>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ring-1 ${STATUS_CHIP[business.status]}`}
          >
            {STATUS_LABEL[business.status]}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-600">
          <Link
            href={`/${lang}/g/${business.slug}`}
            className="font-mono text-zinc-700 underline-offset-2 hover:underline"
          >
            /{business.slug}
          </Link>
          <span>· {business.category}</span>
          <span>· {business.timeZone}</span>
          <span>
            · {business.city?.name} {business.barangay?.name}
          </span>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <InfoCard label="사장">
          <Row k="이름" v={owner?.name ?? "-"} />
          <Row k="loginId" v={owner?.loginId ?? "-"} mono />
          <Row k="email" v={owner?.email ?? "-"} mono />
          <Row k="전화" v={owner?.phone ?? "-"} mono />
        </InfoCard>

        <InfoCard label="구독">
          <Row k="plan" v={business.subscription?.plan ?? "-"} />
          <Row
            k="시작"
            v={
              business.subscription?.startDate
                ? fmt(business.subscription.startDate)
                : "-"
            }
          />
          <Row
            k="만료"
            v={
              business.subscription?.endDate
                ? fmt(business.subscription.endDate)
                : "-"
            }
          />
        </InfoCard>

        <InfoCard label="매장">
          <Row k="phone" v={business.phone ?? "-"} mono />
          <Row k="contactEmail" v={business.contactEmail ?? "-"} mono />
          <Row k="입금" v={business.hasDeposit ? "사용" : "미사용"} />
          <Row k="가입" v={fmt(business.createdAt)} />
          <Row k="최근 수정" v={fmt(business.updatedAt)} />
        </InfoCard>

        <div className="sm:row-span-2">
          <BlockForm
            businessId={business.id}
            status={business.status}
            blockedReason={business.blockedReason}
          />
        </div>
      </section>
    </div>
  );
}

function InfoCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink/60">
        {label}
      </div>
      <dl className="space-y-1.5">{children}</dl>
    </div>
  );
}

function Row({
  k,
  v,
  mono,
}: {
  k: string;
  v: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="text-xs text-zinc-500">{k}</dt>
      <dd
        className={`min-w-0 truncate text-right text-zinc-900 ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {v}
      </dd>
    </div>
  );
}
