import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { requireGymCustomer } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { gymTodayUtcMidnight, gymTodayRange } from "@/lib/calendar/gymTime";
import { OPEN_STATUSES } from "@/lib/packages/availability";
import { PackageTrainerCard } from "./PackageTrainerCard";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type T = (key: string, vars?: Record<string, string | number>) => string;

export default async function HoldingsPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const user = await requireGymCustomer(slug);
  const business = user.business!;
  const t = (await getTranslations("me")) as unknown as T;

  const todayMid = gymTodayUtcMidnight(business.timeZone);

  const [memberships, packages] = await Promise.all([
    prisma.membership.findMany({
      where: {
        gymId: business.id,
        userId: user.id,
        endDate: { gte: todayMid },
      },
      include: { plan: { select: { name: true } } },
      orderBy: { endDate: "asc" },
    }),
    prisma.package.findMany({
      where: {
        gymId: business.id,
        userId: user.id,
        remainingCount: { gt: 0 },
      },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            capacity: true,
            deductCount: true,
          },
        },
        assignedStaff: {
          select: {
            id: true,
            photoUrl: true,
            specialties: true,
            career: true,
            bio: true,
            user: { select: { name: true, phone: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const personal = packages.filter((p) => p.service.capacity === 1);
  const group = packages.filter((p) => p.service.capacity > 1);
  const empty = memberships.length === 0 && packages.length === 0;

  // 패키지별 미완료(예약중) 예약 수 — 예약 가능 횟수 계산용.
  // 예약중(회) = open 예약 수 x 회당 차감, 예약 가능 = 잔여 - 예약중.
  const openByPkg = new Map<string, number>();
  if (packages.length > 0) {
    const openGroups = await prisma.reservation.groupBy({
      by: ["packageId"],
      where: {
        packageId: { in: packages.map((p) => p.id) },
        status: { in: [...OPEN_STATUSES] },
      },
      _count: { _all: true },
    });
    for (const g of openGroups) {
      if (g.packageId) openByPkg.set(g.packageId, g._count._all);
    }
  }

  // 패키지별 "재예약 필요" 건수 — 트레이너 변경 후 자동 변경 못 한 미래
  // 예약(staffId != assignedStaffId). 카드의 재예약 배지 노출에 사용.
  const { end: todayEnd } = gymTodayRange(business.timeZone);
  const pendingRebookByPkg = new Map<string, number>();
  if (personal.length > 0) {
    const futureResv = await prisma.reservation.findMany({
      where: {
        gymId: business.id,
        packageId: { in: personal.map((p) => p.id) },
        scheduledClassId: null,
        status: { notIn: ["CANCELLED", "REJECTED", "COMPLETED", "NO_SHOW"] },
        startAt: { gte: todayEnd },
      },
      select: { packageId: true, staffId: true },
    });
    for (const r of futureResv) {
      if (!r.packageId) continue;
      const pkg = personal.find((p) => p.id === r.packageId);
      if (pkg?.assignedStaffId && r.staffId !== pkg.assignedStaffId) {
        pendingRebookByPkg.set(
          r.packageId,
          (pendingRebookByPkg.get(r.packageId) ?? 0) + 1,
        );
      }
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute -top-32 left-1/4 h-[28rem] w-[28rem] rounded-full bg-rose-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 top-1/3 h-[24rem] w-[24rem] rounded-full bg-orange-400/15 blur-3xl" />

      <header className="relative border-b border-white/5">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-5">
          <Link
            href={`/${lang}/g/${slug}/me`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10"
            aria-label={t("holdingsBack")}
          >
            <ChevronLeft size={18} />
          </Link>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-200/90">
              {business.name}
            </div>
            <div className="mt-0.5 font-heading text-lg tracking-tight text-white">
              {t("holdingsTitle")}
            </div>
          </div>
        </div>
      </header>

      <main className="relative">
        <div className="mx-auto max-w-3xl space-y-5 px-6 py-6">
          {empty && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
              <div className="font-heading text-sm tracking-tight text-zinc-200">
                {t("noActiveTitle")}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                {t("noActiveBody")}
              </p>
            </div>
          )}

          {memberships.length > 0 && (
            <Section title={t("holdingsSectionMembership")}>
              <ul className="space-y-2">
                {memberships.map((m) => {
                  const daysLeft = Math.max(
                    0,
                    Math.round(
                      (m.endDate.getTime() - todayMid.getTime()) / MS_PER_DAY,
                    ),
                  );
                  const soon = daysLeft <= 7;
                  const expiresLabel = formatDate(m.endDate, lang);
                  return (
                    <li
                      key={m.id}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-white">
                            {m.plan?.name ?? t("membershipsTitle")}
                          </div>
                          <div
                            className={
                              "mt-0.5 text-xs " +
                              (soon ? "text-amber-200" : "text-zinc-400")
                            }
                          >
                            {t("membershipExpiresOn", { date: expiresLabel })}
                          </div>
                        </div>
                        {m.refundedAt ? (
                          <RefundedBadge t={t} />
                        ) : (
                          <div
                            className={
                              "shrink-0 font-heading text-sm tabular-nums " +
                              (soon ? "text-amber-200" : "text-zinc-200")
                            }
                          >
                            {t("membershipDaysLeft", { n: daysLeft })}
                          </div>
                        )}
                      </div>
                      {!m.refundedAt && (
                        <RefundLink
                          lang={lang}
                          slug={slug}
                          kind="MEMBERSHIP"
                          id={m.id}
                          t={t}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          {personal.length > 0 && (
            <Section title={t("holdingsSectionPersonal")}>
              <ul className="space-y-2">
                {personal.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white">
                          {p.service.name}
                        </div>
                        {p.refundedAt ? (
                          <RefundedBadge t={t} />
                        ) : (
                          <PackageCounts
                            totalCount={p.totalCount}
                            remainingCount={p.remainingCount}
                            deductCount={p.service.deductCount}
                            openCount={openByPkg.get(p.id) ?? 0}
                            t={t}
                          />
                        )}
                      </div>
                      {!p.refundedAt && p.assignedStaffId && (
                        <a
                          href={`/${lang}/g/${slug}/me/reservations/new?pkg=${p.id}`}
                          className="shrink-0 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_4px_14px_-6px_rgba(251,146,60,0.6)] hover:brightness-110"
                        >
                          {t("actionBook")}
                        </a>
                      )}
                    </div>
                    {!p.refundedAt && (
                      <PackageTrainerCard
                        slug={slug}
                        lang={lang}
                        packageId={p.id}
                        pendingRebookCount={
                          pendingRebookByPkg.get(p.id) ?? 0
                        }
                        assignedStaff={
                          p.assignedStaff
                            ? {
                                name: p.assignedStaff.user.name,
                                phone: p.assignedStaff.user.phone,
                                photoUrl: p.assignedStaff.photoUrl,
                                specialty:
                                  p.assignedStaff.specialties[0] ?? null,
                                career: p.assignedStaff.career,
                                bio: p.assignedStaff.bio,
                              }
                            : null
                        }
                      />
                    )}
                    {!p.refundedAt && (
                      <RefundLink
                        lang={lang}
                        slug={slug}
                        kind="PACKAGE"
                        id={p.id}
                        t={t}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {group.length > 0 && (
            <Section title={t("holdingsSectionGroup")}>
              <ul className="space-y-2">
                {group.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white">
                          {p.service.name}
                        </div>
                        {p.refundedAt ? (
                          <RefundedBadge t={t} />
                        ) : (
                          <PackageCounts
                            totalCount={p.totalCount}
                            remainingCount={p.remainingCount}
                            deductCount={p.service.deductCount}
                            openCount={openByPkg.get(p.id) ?? 0}
                            t={t}
                          />
                        )}
                      </div>
                    </div>
                    {!p.refundedAt && (
                      <RefundLink
                        lang={lang}
                        slug={slug}
                        kind="PACKAGE"
                        id={p.id}
                        t={t}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </main>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

// 횟수권 상태 — "예약 가능"을 크게, 총/완료/예약중은 작게 보조로.
//   완료    = 총 - 잔여 (수업 끝나며 차감된 만큼)
//   예약중  = 미완료 예약 수 x 회당 차감 (잡아뒀고 아직 안 끝난 몫)
//   예약가능 = 잔여 - 예약중 (지금 더 잡을 수 있는 몫)
function PackageCounts({
  totalCount,
  remainingCount,
  deductCount,
  openCount,
  t,
}: {
  totalCount: number;
  remainingCount: number;
  deductCount: number;
  openCount: number;
  t: T;
}) {
  const completed = totalCount - remainingCount;
  const booked = openCount * deductCount;
  const available = Math.max(0, remainingCount - booked);
  return (
    <div className="mt-1">
      <div
        className={
          "font-heading text-base tracking-tight " +
          (available > 0 ? "text-emerald-300" : "text-zinc-500")
        }
      >
        {t("packageAvailableBig", { n: available })}
      </div>
      <div className="mt-0.5 text-[11px] tabular-nums text-zinc-500">
        {t("packageStatLine", {
          total: totalCount,
          done: completed,
          booked,
        })}
      </div>
    </div>
  );
}

// 환불 신청 링크 — 동결 안 된 권에만. 환불 신청 페이지로.
function RefundLink({
  lang,
  slug,
  kind,
  id,
  t,
}: {
  lang: string;
  slug: string;
  kind: "PACKAGE" | "MEMBERSHIP";
  id: string;
  t: T;
}) {
  return (
    <div className="mt-3 border-t border-white/5 pt-2">
      <a
        href={`/${lang}/g/${slug}/me/holdings/refund?kind=${kind}&id=${id}`}
        className="text-[11px] text-zinc-400 underline-offset-2 hover:text-rose-200 hover:underline"
      >
        {t("holdingsRefundRequest")}
      </a>
    </div>
  );
}

// 환불 신청된 권 — "환불 처리 중" 배지. 예약/변경 불가.
function RefundedBadge({ t }: { t: T }) {
  return (
    <div className="mt-1.5 inline-flex items-center rounded-full border border-amber-300/30 bg-amber-300/10 px-2.5 py-1 text-[11px] font-medium text-amber-200">
      {t("holdingsRefundPending")}
    </div>
  );
}

function formatDate(d: Date, lang: string): string {
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "ko-KR", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}
