import type { Viewport } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft, Undo2 } from "lucide-react";

// V18 Sunset Peach — 화이트 테마. 모바일 상태바도 흰색.
export const viewport: Viewport = {
  themeColor: "#ffffff",
};
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

  // 환불 신청된 권은 status 무관하게 보유 화면에서 즉시 제외 — 신청 시점부터
  // 권은 사용 동결, 화면에 남아있어 봐야 사용자에게 혼란. 환불 진행 상황은
  // 별도 알림/페이지에서 (미구현).
  const NO_REFUND_REQUEST = {
    refundRequests: { none: {} },
  };
  const [memberships, packages] = await Promise.all([
    prisma.membership.findMany({
      where: {
        gymId: business.id,
        userId: user.id,
        endDate: { gte: todayMid },
        ...NO_REFUND_REQUEST,
      },
      include: { plan: { select: { name: true } } },
      orderBy: { endDate: "asc" },
    }),
    prisma.package.findMany({
      where: {
        gymId: business.id,
        userId: user.id,
        remainingCount: { gt: 0 },
        ...NO_REFUND_REQUEST,
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
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-orange-50 via-rose-50 to-amber-50 font-sans text-zinc-900">
      <div className="pointer-events-none absolute -top-32 left-1/4 h-[28rem] w-[28rem] rounded-full bg-orange-200/60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 right-0 h-[24rem] w-[28rem] rounded-full bg-rose-200/50 blur-3xl" />

      <header className="relative border-b border-orange-100">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-6 py-3">
          <div className="text-2xl font-bold tracking-tight text-zinc-900">
            {t("holdingsTitle")}
          </div>
          <Link
            href={`/${lang}/g/${slug}/me`}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-orange-200 bg-white text-orange-700 hover:bg-orange-50"
            aria-label={t("holdingsBack")}
          >
            <ChevronLeft size={18} />
          </Link>
        </div>
      </header>

      <main className="relative">
        <div className="mx-auto max-w-3xl space-y-5 px-6 py-6">
          {empty && (
            <div className="rounded-3xl border border-orange-200/60 bg-white/90 p-5 backdrop-blur">
              <div className="font-heading text-sm tracking-tight text-zinc-900">
                {t("noActiveTitle")}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">
                {t("noActiveBody")}
              </p>
            </div>
          )}

          {/* 카드 타입 소제목 폐기 — 카드 디자인 자체로 종류가 명확하고
              한 줄당 한 권으로 한눈에 보임. 공간 확보를 위해 모든 카드를
              한 ul 로 통합. 정렬은 회원권 → 1:1 → 단체 순(중요도 + 자주 봄). */}
          {(memberships.length > 0 || packages.length > 0) && (
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
                    className="rounded-2xl border border-orange-200/60 bg-white/90 p-5 backdrop-blur"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-2xl font-bold tracking-tight text-zinc-900">
                        {m.plan?.name ?? t("membershipsTitle")}
                      </span>
                      <span
                        className={
                          "shrink-0 text-xl font-bold tabular-nums " +
                          (soon ? "text-amber-700" : "text-emerald-700")
                        }
                      >
                        {t("membershipDaysLeft", { n: daysLeft })}
                      </span>
                    </div>
                    <div
                      className={
                        "mt-1 text-sm " +
                        (soon ? "text-amber-700" : "text-zinc-500")
                      }
                    >
                      {t("membershipExpiresOn", { date: expiresLabel })}
                    </div>
                    <RefundLink
                      lang={lang}
                      slug={slug}
                      kind="MEMBERSHIP"
                      id={m.id}
                      t={t}
                    />
                  </li>
                );
              })}

              {personal.map((p) => {
                const counts = packageCounts(
                  p.totalCount,
                  p.remainingCount,
                  p.service.deductCount,
                  openByPkg.get(p.id) ?? 0,
                );
                return (
                  <li
                    key={p.id}
                    className="rounded-2xl border border-orange-200/60 bg-white/90 p-5 backdrop-blur"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-2xl font-bold tracking-tight text-zinc-900">
                        {p.service.name}
                      </span>
                      <span
                        className={
                          "shrink-0 text-xl font-bold tabular-nums " +
                          (counts.available > 0
                            ? "text-emerald-700"
                            : "text-zinc-400")
                        }
                      >
                        {t("packageAvailableBig", { n: counts.available })}
                      </span>
                    </div>
                    <div className="mt-1 text-sm tabular-nums text-zinc-500">
                      {t("packageStatLine", {
                        total: p.totalCount,
                        done: counts.completed,
                        booked: counts.booked,
                      })}
                    </div>
                    <PackageTrainerCard
                      slug={slug}
                      lang={lang}
                      packageId={p.id}
                      pendingRebookCount={pendingRebookByPkg.get(p.id) ?? 0}
                      assignedStaff={
                        p.assignedStaff
                          ? {
                              name: p.assignedStaff.user.name,
                              photoUrl: p.assignedStaff.photoUrl,
                              specialty:
                                p.assignedStaff.specialties[0] ?? null,
                            }
                          : null
                      }
                    />
                  </li>
                );
              })}

              {group.map((p) => {
                const counts = packageCounts(
                  p.totalCount,
                  p.remainingCount,
                  p.service.deductCount,
                  openByPkg.get(p.id) ?? 0,
                );
                return (
                  <li
                    key={p.id}
                    className="rounded-2xl border border-orange-200/60 bg-white/90 p-5 backdrop-blur"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-2xl font-bold tracking-tight text-zinc-900">
                        {p.service.name}
                      </span>
                      <span
                        className={
                          "shrink-0 text-xl font-bold tabular-nums " +
                          (counts.available > 0
                            ? "text-emerald-700"
                            : "text-zinc-400")
                        }
                      >
                        {t("packageAvailableBig", { n: counts.available })}
                      </span>
                    </div>
                    <div className="mt-1 text-sm tabular-nums text-zinc-500">
                      {t("packageStatLine", {
                        total: p.totalCount,
                        done: counts.completed,
                        booked: counts.booked,
                      })}
                    </div>
                    <RefundLink
                      lang={lang}
                      slug={slug}
                      kind="PACKAGE"
                      id={p.id}
                      t={t}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

// 횟수권 상태 계산.
//   완료    = 총 - 잔여 (수업 끝나며 차감된 만큼)
//   예약중  = 미완료 예약 수 x 회당 차감 (잡아뒀고 아직 안 끝난 몫)
//   예약가능 = 잔여 - 예약중 (지금 더 잡을 수 있는 몫)
function packageCounts(
  totalCount: number,
  remainingCount: number,
  deductCount: number,
  openCount: number,
): { completed: number; booked: number; available: number } {
  const completed = totalCount - remainingCount;
  const booked = openCount * deductCount;
  const available = Math.max(0, remainingCount - booked);
  return { completed, booked, available };
}

// 환불 신청 링크 — PackageTrainerCard footer 의 환불 버튼과 동일 스타일.
// 회원권/단체 권 카드 하단에 단독으로 사용 (PT 권은 PackageTrainerCard 안에서).
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
    <div className="mt-3">
      <a
        href={`/${lang}/g/${slug}/me/holdings/refund?kind=${kind}&id=${id}`}
        className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-medium text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50"
      >
        <Undo2 size={13} />
        {t("holdingsRefundRequest")}
      </a>
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
