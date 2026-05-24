import type { Viewport } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { requireGymCustomer } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { loadTrainerCalendar } from "@/lib/calendar/trainerCalendarPro";
import {
  gymTodayUtcMidnight,
  gymNowUtcNaive,
} from "@/lib/calendar/gymTime";
import { NewReservationPicker } from "./NewReservationPicker";

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default async function NewReservationPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; slug: string }>;
  searchParams: Promise<{ pkg?: string; date?: string }>;
}) {
  const { lang, slug } = await params;
  const sp = await searchParams;
  const user = await requireGymCustomer(slug);
  const business = user.business!;
  const t = await getTranslations("me");

  const packageId = sp.pkg ?? "";
  if (!packageId) redirect(`/${lang}/g/${slug}/me`);

  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
    include: {
      service: { select: { name: true, capacity: true, durationMin: true } },
      assignedStaff: {
        select: { id: true, user: { select: { name: true } } },
      },
    },
  });

  if (
    !pkg ||
    pkg.gymId !== business.id ||
    pkg.userId !== user.id ||
    pkg.service.capacity !== 1 ||
    pkg.remainingCount <= 0 ||
    pkg.refundedAt
  ) {
    redirect(`/${lang}/g/${slug}/me`);
  }

  if (!pkg.assignedStaff) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-rose-50 to-amber-50 font-sans text-zinc-900">
        <Header lang={lang} slug={slug} t={t} />
        <main className="mx-auto w-full max-w-3xl space-y-4 px-6 py-6">
          <section className="rounded-3xl border border-amber-300 bg-amber-50 p-5 backdrop-blur">
            <p className="text-base font-medium text-amber-900">
              {t("newNoTrainer")}
            </p>
            <Link
              href={`/${lang}/g/${slug}/me/holdings/${pkg.id}/trainer?next=${encodeURIComponent(
                `/${lang}/g/${slug}/me/reservations/new?pkg=${pkg.id}${sp.date ? `&date=${sp.date}` : ""}`,
              )}`}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(245,158,11,0.6)] hover:bg-amber-600"
            >
              {t("actionPickTrainer")}
            </Link>
          </section>
        </main>
      </div>
    );
  }

  const cal = await loadTrainerCalendar(
    business.id,
    pkg.assignedStaff.id,
    pkg.assignedStaff.user.name,
    business.timeZone,
  );

  // 신규 정책 — 당일 PT 도 가능. 오늘부터 14일치(또는 ?date 지정 1일).
  const todayMid = gymTodayUtcMidnight(business.timeZone);
  const todayKey = `${todayMid.getUTCFullYear()}-${String(
    todayMid.getUTCMonth() + 1,
  ).padStart(2, "0")}-${String(todayMid.getUTCDate()).padStart(2, "0")}`;
  const gymNow = gymNowUtcNaive(business.timeZone);
  const minTodayStartMin =
    gymNow.getUTCHours() * 60 + gymNow.getUTCMinutes() + 60; // 1시간 버퍼

  const days = sp.date
    ? cal.days.filter(
        (d) =>
          `${d.year}-${String(d.month).padStart(2, "0")}-${String(
            d.day,
          ).padStart(2, "0")}` === sp.date,
      )
    : cal.days.slice(cal.todayIdx, cal.todayIdx + 14);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-orange-50 via-rose-50 to-amber-50 font-sans text-zinc-900">
      <div className="pointer-events-none absolute -top-32 left-1/4 h-[28rem] w-[28rem] rounded-full bg-orange-200/60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 right-0 h-[24rem] w-[28rem] rounded-full bg-rose-200/50 blur-3xl" />

      <Header lang={lang} slug={slug} t={t} />

      <main className="relative mx-auto w-full max-w-3xl space-y-4 px-6 py-6">
        <section className="rounded-3xl border border-orange-200/60 bg-white/90 p-5 backdrop-blur">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-3xl font-bold tracking-tight text-zinc-900">
              {pkg.service.name}
            </span>
            <span className="text-2xl font-bold text-orange-700">
              {pkg.assignedStaff.user.name}
            </span>
            <span className="text-base text-zinc-500">Tr</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600">
            {sp.date ? t("newHintDate") : t("newHint")}
          </p>
          <NewReservationPicker
            slug={slug}
            lang={lang}
            packageId={pkg.id}
            days={days}
            slotAxis={cal.slotAxis}
            dateMode={Boolean(sp.date)}
            todayKey={todayKey}
            minTodayStartMin={minTodayStartMin}
          />
        </section>
      </main>
    </div>
  );
}

function Header({
  lang,
  slug,
  t,
}: {
  lang: string;
  slug: string;
  t: (k: string) => string;
}) {
  return (
    <header className="relative border-b border-orange-100">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-6 py-3">
        <div className="text-2xl font-bold tracking-tight text-zinc-900">
          {t("newTitle")}
        </div>
        <Link
          href={`/${lang}/g/${slug}/me/calendar`}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-orange-200 bg-white text-orange-700 hover:bg-orange-50"
          aria-label={t("moveBack")}
        >
          <ChevronLeft size={18} />
        </Link>
      </div>
    </header>
  );
}
