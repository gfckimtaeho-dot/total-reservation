import { getTranslations } from "next-intl/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { getTheme } from "@/lib/theme";
import { logout } from "@/lib/auth/actions";
import { SidebarNav } from "../dashboard/SidebarNav";
import { RefundsTable } from "./RefundsTable";

const PAGE_SIZE = 20;

type SP = string | string[] | undefined;
function one(v: SP): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

// 테마별 셸 스타일 — 사이드바/배경. SidebarNav 의 tone 과 짝.
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
  },
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
  const theme = await getTheme();
  const tk = TONE[theme];
  const t = await getTranslations("refunds");
  const tn = await getTranslations("nav");

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
        <p className={`mt-1 text-xs ${tk.sub}`}>{t("subtitle")}</p>

        <RefundsTable
          tone={theme}
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
    </div>
  );
}
