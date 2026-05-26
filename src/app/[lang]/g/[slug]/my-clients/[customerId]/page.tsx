import Link from "next/link";
import { notFound } from "next/navigation";
import { User2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireGymStaff } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { NoteEditor } from "./NoteEditor";
import { HandoverDialog } from "../../handover/HandoverDialog";

// 내 고객 상세 — 프로필 + 보유 권 + PT 히스토리(완료, 메모 편집) + 예정 PT.
// 가드: 트레이너는 본인 담당 권 가진 고객만 접근. OWNER/MANAGER 는 매장 전체.
// 완료 예약 최근 20건만 (오래된 회고는 우선순위 낮음 — 페이징 추가는 후속).
export default async function MyClientDetailPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string; customerId: string }>;
}) {
  const { lang, slug, customerId } = await params;
  const auth = await requireGymStaff(slug);
  const business = auth.business!;
  const t = await getTranslations("dashboard");
  const tc = await getTranslations("common");

  const staff =
    auth.role === "OWNER" || auth.role === "MANAGER"
      ? null
      : await prisma.staff.findFirst({
          where: { gymId: business.id, userId: auth.id },
          select: { id: true },
        });

  // 가드: 트레이너면 본인 담당 권을 가진 고객만 접근 허용.
  if (auth.role !== "OWNER" && auth.role !== "MANAGER") {
    if (!staff) notFound();
    const hasAssignedPkg = await prisma.package.findFirst({
      where: {
        gymId: business.id,
        userId: customerId,
        assignedStaffId: staff.id,
        refundedAt: null,
      },
      select: { id: true },
    });
    if (!hasAssignedPkg) notFound();
  }

  const [customer, packages, completedReservations, upcomingReservations] =
    await Promise.all([
      prisma.user.findFirst({
        where: { id: customerId, gymId: business.id, role: "CUSTOMER" },
        select: { id: true, name: true, phone: true },
      }),
      prisma.package.findMany({
        where: {
          gymId: business.id,
          userId: customerId,
          remainingCount: { gt: 0 },
          refundedAt: null,
          ...(staff ? { assignedStaffId: staff.id } : {}),
        },
        select: {
          id: true,
          remainingCount: true,
          totalCount: true,
          serviceId: true,
          service: { select: { name: true, capacity: true } },
          assignedStaff: {
            select: {
              user: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.reservation.findMany({
        where: {
          gymId: business.id,
          customerUserId: customerId,
          status: "COMPLETED",
          // PT(1:1)만 회고 대상. 단체 수업은 학생별 운동 부위 메모 패턴이
          // 아니라 노이즈 — capacity=1 인 서비스로 좁힌다.
          service: { capacity: 1 },
          ...(staff ? { staffId: staff.id } : {}),
        },
        select: {
          id: true,
          startAt: true,
          completedAt: true,
          completionNote: true,
          service: { select: { name: true } },
        },
        orderBy: { startAt: "desc" },
        take: 20,
      }),
      prisma.reservation.findMany({
        where: {
          gymId: business.id,
          customerUserId: customerId,
          status: { in: ["CONFIRMED", "PENDING_PAYMENT"] },
          startAt: { gte: new Date() },
          ...(staff ? { staffId: staff.id } : {}),
        },
        select: {
          id: true,
          serviceId: true,
          startAt: true,
          service: { select: { name: true } },
        },
        orderBy: { startAt: "asc" },
        take: 10,
      }),
    ]);

  if (!customer) notFound();

  const oneToOnePkgs = packages.filter((p) => p.service.capacity === 1);
  const groupPkgs = packages.filter((p) => p.service.capacity > 1);

  // 1:1 service 양도는 service 단위 일괄 → serviceId 로 group.
  type OneToOneGroup = {
    serviceId: string;
    serviceName: string;
    totalRemaining: number;
    totalCount: number;
    packageCount: number;
    currentTrainerUserId: string | null;
    currentTrainerName: string | null;
  };
  const oneToOneGroupsMap = new Map<string, OneToOneGroup>();
  for (const p of oneToOnePkgs) {
    const g = oneToOneGroupsMap.get(p.serviceId);
    if (g) {
      g.totalRemaining += p.remainingCount;
      g.totalCount += p.totalCount;
      g.packageCount += 1;
    } else {
      oneToOneGroupsMap.set(p.serviceId, {
        serviceId: p.serviceId,
        serviceName: p.service.name,
        totalRemaining: p.remainingCount,
        totalCount: p.totalCount,
        packageCount: 1,
        currentTrainerUserId: p.assignedStaff?.user.id ?? null,
        currentTrainerName: p.assignedStaff?.user.name ?? null,
      });
    }
  }
  const oneToOneGroups = Array.from(oneToOneGroupsMap.values());

  // service 별 미래 예약 카운트 — HandoverDialog 영향 요약용.
  const upcomingCountByService = new Map<string, number>();
  for (const r of upcomingReservations) {
    upcomingCountByService.set(
      r.serviceId,
      (upcomingCountByService.get(r.serviceId) ?? 0) + 1,
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-x-0 -top-20 h-[40rem] bg-gradient-to-b from-purple-700/30 via-pink-500/15 to-transparent" />
      <div className="pointer-events-none absolute -right-40 top-1/4 h-[28rem] w-[28rem] rounded-full bg-emerald-500/15 blur-3xl" />

      <header className="relative flex items-center gap-3 border-b border-white/5 px-5 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30">
          <User2 size={18} />
        </div>
        <h1 className="font-heading min-w-0 flex-1 truncate text-xl font-semibold tracking-tight text-white">
          {customer.name}
        </h1>
        <Link
          href={`/${lang}/g/${slug}/intake?customer=${customer.id}`}
          className="shrink-0 rounded-md border border-emerald-400/40 bg-emerald-400/15 px-4 py-2.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-400/25"
        >
          {t("myClientsIssueService")}
        </Link>
        <Link
          href={`/${lang}/g/${slug}/dashboard`}
          className="shrink-0 rounded-md border border-white/15 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white"
        >
          {tc("home")}
        </Link>
      </header>

      <main className="relative flex-1 space-y-4 p-4">
        {/* 보유 권 */}
        <section className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300/80">
            {t("myClientsServices")}
          </h2>
          {packages.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">
              {t("myClientsNoServices")}
            </p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {oneToOneGroups.map((g) => (
                <li
                  key={g.serviceId}
                  className="flex items-center justify-between gap-3 rounded-lg bg-zinc-950/50 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate font-medium text-white">
                    {g.serviceName}
                  </span>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="tabular-nums text-emerald-300">
                      {g.totalRemaining}
                      <span className="ml-1 text-xs text-zinc-500">
                        / {g.totalCount}
                      </span>
                    </span>
                    {g.currentTrainerUserId && (
                      <HandoverDialog
                        slug={slug}
                        customerId={customer.id}
                        customerName={customer.name}
                        serviceId={g.serviceId}
                        serviceName={g.serviceName}
                        fromStaffUserId={g.currentTrainerUserId}
                        fromStaffName={g.currentTrainerName ?? ""}
                        activePackages={g.packageCount}
                        upcomingReservations={
                          upcomingCountByService.get(g.serviceId) ?? 0
                        }
                        tone="dark"
                        successHref={`/${lang}/g/${slug}/my-clients`}
                      />
                    )}
                  </div>
                </li>
              ))}
              {groupPkgs.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-lg bg-zinc-950/50 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-purple-200">
                    {p.service.name}
                  </span>
                  <span className="tabular-nums text-purple-300">
                    {p.remainingCount}
                    <span className="ml-1 text-xs text-zinc-500">
                      / {p.totalCount}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 예정 PT */}
        <section className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-300/80">
            {t("myClientsUpcoming")}
          </h2>
          {upcomingReservations.length === 0 ? (
            <p className="mt-3 text-base text-zinc-500">
              {t("myClientsUpcomingEmpty")}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {upcomingReservations.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 rounded-lg bg-zinc-950/50 px-4 py-3 text-base"
                >
                  <span className="font-mono tabular-nums text-orange-300">
                    {formatDateTime(r.startAt, lang)}
                  </span>
                  <span className="text-zinc-300">{r.service.name}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* PT 히스토리 (메모 편집) */}
        <section className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300/80">
              {t("myClientsHistory")}
            </h2>
            {completedReservations.length > 0 && (
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                {t("myClientsHistoryRecent", {
                  n: completedReservations.length,
                })}
              </span>
            )}
          </div>
          {completedReservations.length === 0 ? (
            <p className="mt-3 text-base text-zinc-500">
              {t("myClientsHistoryEmpty")}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {completedReservations.map((r) => (
                <li
                  key={r.id}
                  className="rounded-lg bg-zinc-950/50 p-4"
                >
                  <div className="flex items-center gap-3 text-base">
                    <span className="font-mono shrink-0 tabular-nums text-emerald-300">
                      {formatDateTime(r.startAt, lang)}
                    </span>
                    <span className="text-zinc-400">{r.service.name}</span>
                  </div>
                  <div className="mt-2">
                    <NoteEditor
                      reservationId={r.id}
                      initialNote={r.completionNote ?? ""}
                      slug={slug}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

// UTC-naive 저장 — UTC 파츠가 곧 벽시계. 매장 타임존과 무관하게 그대로 표시.
// 요일도 함께 — "5/24 (Sat) 14:00" 형식. 사용자가 한눈에 무슨 요일인지 인식.
function formatDateTime(d: Date, lang: string): string {
  const date = new Intl.DateTimeFormat(lang === "en" ? "en-US" : "ko-KR", {
    timeZone: "UTC",
    month: "numeric",
    day: "numeric",
  }).format(d);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
  }).format(d);
  const time = new Intl.DateTimeFormat(lang === "en" ? "en-US" : "ko-KR", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${date} (${weekday}) ${time}`;
}
