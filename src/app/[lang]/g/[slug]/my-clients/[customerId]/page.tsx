import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Phone, User2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireGymStaff } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { NoteEditor } from "./NoteEditor";

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
          ...(staff ? { assignedStaffId: staff.id } : {}),
        },
        select: {
          id: true,
          remainingCount: true,
          totalCount: true,
          service: { select: { name: true, capacity: true } },
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

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-x-0 -top-20 h-[40rem] bg-gradient-to-b from-purple-700/30 via-pink-500/15 to-transparent" />
      <div className="pointer-events-none absolute -right-40 top-1/4 h-[28rem] w-[28rem] rounded-full bg-emerald-500/15 blur-3xl" />

      <header className="relative flex items-center gap-3 border-b border-white/5 px-5 py-3">
        <Link
          href={`/${lang}/g/${slug}/my-clients`}
          aria-label={t("myClientsBack")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-zinc-300 transition hover:bg-white/5"
        >
          <ChevronLeft size={20} />
        </Link>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30">
          <User2 size={18} />
        </div>
        <h1 className="font-heading min-w-0 flex-1 truncate text-xl font-semibold tracking-tight text-white">
          {customer.name}
        </h1>
        {customer.phone && (
          <a
            href={`tel:${customer.phone}`}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs text-zinc-300 ring-1 ring-white/10 hover:bg-white/10"
          >
            <Phone size={12} />
            {customer.phone}
          </a>
        )}
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
              {oneToOnePkgs.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-lg bg-zinc-950/50 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-white">
                    {p.service.name}
                  </span>
                  <span className="tabular-nums text-emerald-300">
                    {p.remainingCount}
                    <span className="ml-1 text-xs text-zinc-500">
                      / {p.totalCount}
                    </span>
                  </span>
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
            <p className="mt-3 text-sm text-zinc-500">
              {t("myClientsUpcomingEmpty")}
            </p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {upcomingReservations.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 rounded-lg bg-zinc-950/50 px-3 py-2 text-sm"
                >
                  <span className="font-mono text-sm tabular-nums text-orange-300">
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
            <p className="mt-3 text-sm text-zinc-500">
              {t("myClientsHistoryEmpty")}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {completedReservations.map((r) => (
                <li
                  key={r.id}
                  className="rounded-lg bg-zinc-950/50 p-3"
                >
                  <div className="flex items-center gap-3 text-sm">
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
function formatDateTime(d: Date, lang: string): string {
  const fmt = new Intl.DateTimeFormat(lang === "en" ? "en-US" : "ko-KR", {
    timeZone: "UTC",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return fmt.format(d);
}
