import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireGymCustomer } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { loadTrainerCalendar } from "@/lib/calendar/trainerCalendarPro";
import { NewReservationPicker } from "./NewReservationPicker";

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
    pkg.remainingCount <= 0
  ) {
    redirect(`/${lang}/g/${slug}/me`);
  }

  if (!pkg.assignedStaff) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <Header lang={lang} slug={slug} t={t} />
        <main className="mx-auto w-full max-w-3xl space-y-4 px-6 py-6">
          <section className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-5 backdrop-blur-xl">
            <p className="text-sm text-amber-100">{t("newNoTrainer")}</p>
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

  // date 파라미터(고객 캘린더에서 날짜 클릭 진입)면 그 하루만, 없으면
  // 내일부터 2주. date 가 캘린더 범위 밖/과거면 빈 배열 → "빈 시간 없음".
  const firstIdx = cal.todayIdx + 1;
  const days = sp.date
    ? cal.days.filter(
        (d, i) =>
          i > cal.todayIdx &&
          `${d.year}-${String(d.month).padStart(2, "0")}-${String(
            d.day,
          ).padStart(2, "0")}` === sp.date,
      )
    : cal.days.slice(firstIdx, firstIdx + 14);

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute -top-32 left-1/4 h-[28rem] w-[28rem] rounded-full bg-rose-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 top-1/3 h-[24rem] w-[24rem] rounded-full bg-emerald-400/15 blur-3xl" />

      <Header lang={lang} slug={slug} t={t} />

      <main className="relative mx-auto w-full max-w-3xl space-y-4 px-6 py-6">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-200/90">
            {t("newCurrent")}
          </div>
          <div className="mt-2 font-heading text-lg tracking-tight text-white">
            {pkg.service.name}
          </div>
          <div className="mt-0.5 text-sm text-zinc-300">
            {t("withStaff", { name: pkg.assignedStaff.user.name })}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-200/90">
            {t("newTrainer", { name: pkg.assignedStaff.user.name })}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">
            {sp.date ? t("newHintDate") : t("newHint")}
          </p>
          <NewReservationPicker
            slug={slug}
            lang={lang}
            packageId={pkg.id}
            days={days}
            slotAxis={cal.slotAxis}
            dateMode={Boolean(sp.date)}
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
    <header className="relative border-b border-white/5 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <div>
          <Link
            href={`/${lang}/g/${slug}/me`}
            className="text-xs text-zinc-400 hover:text-rose-200"
          >
            {t("moveBack")}
          </Link>
          <div className="mt-1 font-heading text-lg tracking-tight text-white">
            {t("newTitle")}
          </div>
        </div>
      </div>
    </header>
  );
}
