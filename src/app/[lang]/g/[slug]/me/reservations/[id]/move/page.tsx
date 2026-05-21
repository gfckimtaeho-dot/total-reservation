import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireGymCustomer } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { gymTodayRange } from "@/lib/calendar/gymTime";
import { loadTrainerCalendar } from "@/lib/calendar/trainerCalendarPro";
import { MovePicker } from "./MovePicker";

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

  // 내일부터 14일치만 잘라 클라이언트에 넘김.
  const firstIdx = cal.todayIdx + 1;
  const days = cal.days.slice(firstIdx, firstIdx + 14);

  const currentStart = formatDateTime(res.startAt, lang);
  const currentEnd = formatTime(res.endAt, lang);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <div>
            <Link
              href={`/${lang}/g/${slug}/me`}
              className="text-xs text-zinc-400 hover:text-zinc-100"
            >
              {t("moveBack")}
            </Link>
            <div className="mt-1 font-heading text-lg tracking-tight text-zinc-50">
              {t("moveTitle")}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl space-y-4 px-6 py-6">
          <section className="rounded-2xl bg-zinc-900/60 p-5 ring-1 ring-zinc-800">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
              {t("moveCurrent")}
            </div>
            <div className="mt-2 font-heading text-lg tracking-tight text-zinc-50">
              {res.service.name}
            </div>
            <div className="mt-0.5 text-sm text-zinc-300">
              {currentStart} - {currentEnd}
            </div>
            <div className="mt-0.5 text-xs text-zinc-400">
              {t("withStaff", { name: res.staff.user.name })}
            </div>
          </section>

          <section className="rounded-2xl bg-zinc-900/60 p-5 ring-1 ring-zinc-800">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
              {t("moveTrainer", { name: res.staff.user.name })}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
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
