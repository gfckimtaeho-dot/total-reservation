import type { Viewport } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { requireGymCustomer } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { gymTodayRange } from "@/lib/calendar/gymTime";
import { loadTrainerCalendar } from "@/lib/calendar/trainerCalendarPro";
import { MovePicker } from "./MovePicker";

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default async function ReservationMovePage({
  params,
}: {
  params: Promise<{ lang: string; slug: string; id: string }>;
}) {
  const { lang, slug, id } = await params;
  const user = await requireGymCustomer(slug);
  const business = user.business!;
  const t = await getTranslations("me");

  const res = await prisma.reservation.findUnique({
    where: { id },
    include: {
      service: { select: { name: true, capacity: true } },
      staff: { select: { id: true, user: { select: { name: true } } } },
    },
  });

  if (
    !res ||
    res.gymId !== business.id ||
    res.customerUserId !== user.id ||
    res.scheduledClassId !== null ||
    res.service.capacity !== 1 ||
    ["CANCELLED", "REJECTED", "COMPLETED", "NO_SHOW"].includes(res.status)
  ) {
    redirect(`/${lang}/g/${slug}/me`);
  }

  const { end: todayEnd } = gymTodayRange(business.timeZone);
  if (res.startAt < todayEnd) {
    redirect(`/${lang}/g/${slug}/me`);
  }

  const cal = await loadTrainerCalendar(
    business.id,
    res.staff.id,
    res.staff.user.name,
    business.timeZone,
  );

  const firstIdx = cal.todayIdx + 1;
  const days = cal.days.slice(firstIdx, firstIdx + 14);

  const currentStart = formatDateTime(res.startAt, lang);
  const currentEnd = formatTime(res.endAt, lang);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-orange-50 via-rose-50 to-amber-50 font-sans text-zinc-900">
      <div className="pointer-events-none absolute -top-24 left-1/3 h-[26rem] w-[26rem] rounded-full bg-orange-300/40 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -right-10 h-[22rem] w-[22rem] rounded-full bg-rose-300/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 left-0 h-[20rem] w-[24rem] rounded-full bg-amber-300/30 blur-3xl" />

      <header className="relative">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-6 py-3">
          <div className="text-2xl font-bold tracking-tight text-zinc-900">
            {t("moveTitle")}
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

      <main className="relative flex-1">
        <div className="mx-auto w-full max-w-3xl space-y-4 px-6 py-6">
          <section className="rounded-3xl bg-white/70 p-5 ring-1 ring-white/80 backdrop-blur-xl shadow-[0_24px_60px_-30px_rgba(249,115,22,0.45)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-600">
              {t("moveCurrent")}
            </div>
            <div className="mt-2 font-heading text-lg font-bold tracking-tight text-zinc-900">
              {res.service.name}
            </div>
            <div className="mt-0.5 text-sm text-zinc-700">
              {currentStart} - {currentEnd}
            </div>
            <div className="mt-0.5 text-xs text-zinc-500">
              {t("withStaff", { name: res.staff.user.name })}
            </div>
          </section>

          <section className="rounded-3xl bg-white/70 p-5 ring-1 ring-white/80 backdrop-blur-xl shadow-[0_24px_60px_-30px_rgba(249,115,22,0.45)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-600">
              {t("moveTrainer", { name: res.staff.user.name })}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              {t("moveHint")}
            </p>
            <MovePicker
              slug={slug}
              lang={lang}
              reservationId={res.id}
              days={days}
              slotAxis={cal.slotAxis}
            />
          </section>
        </div>
      </main>
    </div>
  );
}

function formatDateTime(d: Date, lang: string): string {
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "ko-KR", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function formatTime(d: Date, lang: string): string {
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "ko-KR", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}
