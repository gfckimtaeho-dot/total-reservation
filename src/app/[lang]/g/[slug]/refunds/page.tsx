import { getTranslations } from "next-intl/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { OwnerShell } from "../OwnerShell";
import { RefundsTable } from "./RefundsTable";

const PAGE_SIZE = 20;

type SP = string | string[] | undefined;
function one(v: SP): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

const TK = {
  sub: "text-zinc-500",
} as const;

export default async function RefundsPage({
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
  const t = await getTranslations("refunds");

  // ── 필터 파싱 ──
  const statusParam = one(sp.status); // pending | completed | all
  const status =
    statusParam === "completed"
      ? "COMPLETED"
      : statusParam === "all"
        ? null
        : "PENDING";
  const fromStr = one(sp.from);
  const toStr = one(sp.to);
  const customer = one(sp.customer).trim();
  const trainer = one(sp.trainer).trim();
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const fromDate = dateRe.test(fromStr)
    ? new Date(`${fromStr}T00:00:00Z`)
    : null;
  const toEnd = dateRe.test(toStr)
    ? new Date(new Date(`${toStr}T00:00:00Z`).getTime() + 86400000)
    : null;

  const where: Prisma.RefundRequestWhereInput = {
    gymId: business.id,
    ...(status ? { status } : {}),
    ...(fromDate || toEnd
      ? {
          requestedAt: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toEnd ? { lt: toEnd } : {}),
          },
        }
      : {}),
    ...(customer
      ? {
          user: {
            is: { name: { contains: customer, mode: "insensitive" } },
          },
        }
      : {}),
    ...(trainer
      ? { trainerName: { contains: trainer, mode: "insensitive" } }
      : {}),
  };

  const [rows, total, pendingAgg] = await Promise.all([
    prisma.refundRequest.findMany({
      where,
      orderBy: { requestedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        kind: true,
        serviceName: true,
        trainerName: true,
        refundPhp: true,
        totalUnits: true,
        completedUnits: true,
        todayUnits: true,
        refundUnits: true,
        payoutMethod: true,
        bankName: true,
        bankAccount: true,
        accountHolder: true,
        reason: true,
        status: true,
        requestedAt: true,
        completedAt: true,
        user: { select: { name: true, phone: true } },
      },
    }),
    prisma.refundRequest.count({ where }),
    prisma.refundRequest.aggregate({
      where: { gymId: business.id, status: "PENDING" },
      _sum: { refundPhp: true },
      _count: true,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Date → ISO 직렬화(클라이언트 전달용).
  const data = rows.map((r) => ({
    ...r,
    requestedAt: r.requestedAt.toISOString(),
    completedAt: r.completedAt ? r.completedAt.toISOString() : null,
  }));

  return (
    <OwnerShell
      lang={lang}
      slug={slug}
      businessName={business.name}
      subtitle={t("title")}
    >
      <main className="px-5 py-6 sm:px-8">
        <p className={`text-xs ${TK.sub}`}>{t("subtitle")}</p>

        <RefundsTable
          tone="indigo"
          lang={lang}
          slug={slug}
          rows={data}
          page={page}
          totalPages={totalPages}
          status={
            statusParam === "completed" || statusParam === "all"
              ? statusParam
              : "pending"
          }
          from={fromStr}
          to={toStr}
          customer={customer}
          trainer={trainer}
          pendingCount={pendingAgg._count}
          pendingSum={pendingAgg._sum.refundPhp ?? 0}
        />
      </main>
    </OwnerShell>
  );
}
