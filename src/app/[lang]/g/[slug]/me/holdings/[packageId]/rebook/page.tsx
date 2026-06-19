import type { Viewport } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft, CheckCircle2 } from "lucide-react";

export const viewport: Viewport = {
  themeColor: "#ffffff",
};
import { requireGymCustomer } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { gymTodayRange } from "@/lib/calendar/gymTime";
import { loadTrainerCalendar } from "@/lib/calendar/trainerCalendarPro";
import { RebookPicker } from "./RebookPicker";
import type { ReservationStatus } from "@/generated/prisma/enums";

type T = (key: string, vars?: Record<string, string | number>) => string;

const DEAD_OR_DONE: ReservationStatus[] = [
  "CANCELLED",
  "REJECTED",
  "COMPLETED",
  "NO_SHOW",
];

// 페이지 B — 트레이너 변경 후 충돌(자동 변경 못 한) 미래 예약을 새 트레이너
// 캘린더에서 다시 잡는다. "재예약 필요" 건은 상태에서 파생(staffId !=
// assignedStaffId) — 따로 ID를 들고 다니지 않아 새로고침/재진입에 강하다.
export default async function RebookPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string; packageId: string }>;
}) {
  const { lang, slug, packageId } = await params;
  const user = await requireGymCustomer(slug);
  const business = user.business!;
  const t = (await getTranslations("me")) as unknown as T;

  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
    select: {
      id: true,
      gymId: true,
      userId: true,
      assignedStaffId: true,
      service: { select: { name: true, capacity: true } },
      assignedStaff: { select: { user: { select: { name: true } } } },
    },
  });

  if (
    !pkg ||
    pkg.gymId !== business.id ||
    pkg.userId !== user.id ||
    pkg.service.capacity !== 1 ||
    !pkg.assignedStaffId ||
    !pkg.assignedStaff
  ) {
    redirect(`/${lang}/g/${slug}/me/holdings`);
  }

  const trainerName = pkg.assignedStaff.user.name;
  const { end: todayEnd } = gymTodayRange(business.timeZone);

  // 재예약 필요 = 이 패키지의 미래 1:1 예약 중 아직 새 트레이너가 아닌 것.
  const pending = await prisma.reservation.findMany({
    where: {
      gymId: business.id,
      packageId,
      scheduledClassId: null,
      status: { notIn: DEAD_OR_DONE },
      startAt: { gte: todayEnd },
      staffId: { not: pkg.assignedStaffId },
    },
    select: {
      id: true,
      startAt: true,
      service: { select: { name: true } },
    },
    orderBy: { startAt: "asc" },
  });

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-orange-50 via-rose-50 to-amber-50 font-sans text-zinc-900">
      <div className="pointer-events-none absolute -top-24 left-1/3 h-[26rem] w-[26rem] rounded-full bg-orange-300/40 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -right-10 h-[22rem] w-[22rem] rounded-full bg-rose-300/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 left-0 h-[20rem] w-[24rem] rounded-full bg-amber-300/30 blur-3xl" />

      <header className="relative">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-6 py-3">
          <div className="text-2xl font-bold tracking-tight text-zinc-900">
            {t("rebookTitle")}
          </div>
          <Link
            href={`/${lang}/g/${slug}/me/holdings`}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-orange-200 bg-white text-orange-700 hover:bg-orange-50"
            aria-label={t("rebookBack")}
          >
            <ChevronLeft size={18} />
          </Link>
        </div>
      </header>

      <main className="relative">
        <div className="mx-auto max-w-3xl space-y-4 px-6 py-6">
          {pending.length === 0 ? (
            <section className="rounded-3xl border border-emerald-300 bg-emerald-50 p-6 text-center backdrop-blur">
              <CheckCircle2
                size={32}
                className="mx-auto text-emerald-600"
              />
              <div className="mt-3 font-heading text-base font-bold tracking-tight text-zinc-900">
                {t("rebookDone")}
              </div>
              <Link
                href={`/${lang}/g/${slug}/me/holdings`}
                className="mt-4 inline-block rounded-full bg-white px-4 py-2 text-xs font-semibold text-zinc-700 ring-1 ring-orange-200 hover:bg-orange-50"
              >
                {t("rebookDoneHome")}
              </Link>
            </section>
          ) : (
            <RebookCalendar
              slug={slug}
              lang={lang}
              packageId={packageId}
              gymId={business.id}
              userId={user.id}
              trainerName={trainerName}
              timeZone={business.timeZone}
              pending={pending.map((p) => ({
                id: p.id,
                startIso: p.startAt.toISOString(),
                serviceName: p.service.name,
              }))}
              t={t}
            />
          )}
        </div>
      </main>
    </div>
  );
}

// 캘린더 로딩은 별도 async 컴포넌트로 — pending 이 있을 때만 호출.
async function RebookCalendar({
  slug,
  lang,
  packageId,
  gymId,
  userId,
  trainerName,
  timeZone,
  pending,
  t,
}: {
  slug: string;
  lang: string;
  packageId: string;
  gymId: string;
  userId: string;
  trainerName: string;
  timeZone: string;
  pending: { id: string; startIso: string; serviceName: string }[];
  t: T;
}) {
  // assignedStaffId 는 호출 직전 page 에서 검증됨 — 캘린더는 그 트레이너 기준.
  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
    select: { assignedStaffId: true },
  });
  const cal = await loadTrainerCalendar(
    gymId,
    pkg!.assignedStaffId!,
    trainerName,
    timeZone,
  );
  // 내일부터 2주 — 새 예약 플로우와 동일한 창.
  const firstIdx = cal.todayIdx + 1;
  const days = cal.days.slice(firstIdx, firstIdx + 14);

  return (
    <>
      <section className="rounded-3xl bg-white/70 p-5 ring-1 ring-white/80 backdrop-blur-xl shadow-[0_24px_60px_-30px_rgba(249,115,22,0.45)]">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-600">
          {t("rebookIntro", { name: trainerName })}
        </div>
        <div className="mt-2 font-heading text-base font-bold tracking-tight text-zinc-900">
          {t("rebookRemaining", { n: pending.length })}
        </div>
      </section>

      <RebookPicker
        slug={slug}
        lang={lang}
        packageId={packageId}
        trainerName={trainerName}
        currentUserId={userId}
        pending={pending}
        days={days}
        slotAxis={cal.slotAxis}
      />
    </>
  );
}
