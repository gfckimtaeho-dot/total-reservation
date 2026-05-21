import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { requireGymCustomer } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { gymTodayUtcMidnight } from "@/lib/calendar/gymTime";
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
        service: { select: { id: true, name: true, capacity: true } },
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
                        <div
                          className={
                            "shrink-0 font-heading text-sm tabular-nums " +
                            (soon ? "text-amber-200" : "text-zinc-200")
                          }
                        >
                          {t("membershipDaysLeft", { n: daysLeft })}
                        </div>
                      </div>
                      <RefundPlaceholder t={t} />
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
                        <div className="mt-0.5 text-xs text-zinc-400">
                          {t("packageRemaining", {
                            remaining: p.remainingCount,
                            total: p.totalCount,
                          })}
                        </div>
                      </div>
                      {p.assignedStaffId && (
                        <a
                          href={`/${lang}/g/${slug}/me/reservations/new?pkg=${p.id}`}
                          className="shrink-0 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_4px_14px_-6px_rgba(251,146,60,0.6)] hover:brightness-110"
                        >
                          {t("actionBook")}
                        </a>
                      )}
                    </div>
                    <PackageTrainerCard
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
                    <RefundPlaceholder t={t} />
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
                        <div className="mt-0.5 text-xs text-zinc-400">
                          {t("packageRemaining", {
                            remaining: p.remainingCount,
                            total: p.totalCount,
                          })}
                        </div>
                      </div>
                    </div>
                    <RefundPlaceholder t={t} />
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

function RefundPlaceholder({ t }: { t: T }) {
  return (
    <div className="mt-3 border-t border-white/5 pt-2 text-[10px] text-zinc-500">
      {t("holdingsRefundPlaceholder")}
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
