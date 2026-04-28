import { getTranslations } from "next-intl/server";
import Link from "next/link";

const categories = [
  { key: "gym", emoji: "🏋️", available: true },
  { key: "massage", emoji: "💆", available: true },
  { key: "salon", emoji: "✂️", available: false },
  { key: "golf", emoji: "⛳", available: false },
] as const;

export default async function Landing() {
  const t = await getTranslations("landing");

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar — sits over the hero gradient */}
      <header className="absolute left-0 right-0 top-0 z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 text-white">
          <div className="h-7 w-7 rounded-lg bg-white/20 backdrop-blur" />
          <span className="font-semibold tracking-tight">TotalReservation</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-white/90">
          <span>KO · EN</span>
          <Link
            href="/login"
            className="rounded-full bg-white/20 px-4 py-1.5 backdrop-blur transition hover:bg-white/30"
          >
            {t("topbar.login")}
          </Link>
        </div>
      </header>

      {/* Hero band */}
      <section className="relative isolate flex min-h-[70vh] flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-orange-500 via-rose-500 to-fuchsia-600 px-6 pt-24 pb-16 text-center text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-20 top-1/3 h-72 w-72 rounded-full bg-yellow-300/30 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-fuchsia-400/30 blur-3xl"
        />

        <p className="mb-5 text-sm font-medium uppercase tracking-[0.2em] text-white/80">
          {t("hero.label")}
        </p>
        <h1 className="mb-6 max-w-4xl text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl">
          {t.rich("hero.title", {
            em: (chunks) => <span className="italic">{chunks}</span>,
          })}
        </h1>
        <p className="mb-10 max-w-xl text-lg text-white/90 sm:text-xl">
          {t("hero.tagline")}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/customer"
            className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-base font-semibold text-zinc-900 transition-all hover:scale-[1.03] hover:shadow-2xl"
          >
            {t("hero.ctaCustomer")}
          </Link>
          <Link
            href="/signup/business"
            className="inline-flex items-center justify-center rounded-full border border-white/40 px-8 py-3.5 text-base font-medium text-white backdrop-blur transition hover:bg-white/10"
          >
            {t("hero.ctaBusiness")}
          </Link>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto w-full max-w-6xl flex-1 px-6 py-20">
        <div className="mb-10 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t("categories.heading")}
          </h2>
          <span className="text-sm text-zinc-500">
            {t("categories.subheading")}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {categories.map((c) => (
            <div
              key={c.key}
              className={`group rounded-2xl border border-zinc-200 p-6 transition-all dark:border-zinc-800 ${
                c.available
                  ? "cursor-pointer bg-white hover:-translate-y-1 hover:border-zinc-400 hover:shadow-xl dark:bg-zinc-900"
                  : "bg-zinc-50/50 dark:bg-zinc-900/40"
              }`}
            >
              <div className="text-4xl">{c.emoji}</div>
              <div className="mt-4 font-semibold">
                {t(`categories.items.${c.key}`)}
              </div>
              <div
                className={`mt-1 text-xs ${
                  c.available ? "text-emerald-600" : "text-zinc-500"
                }`}
              >
                {t(c.available ? "categories.soon" : "categories.planned")}
              </div>
            </div>
          ))}
        </div>

        {/* Business CTA strip */}
        <div className="mt-16 flex flex-col items-center justify-between gap-4 rounded-3xl border border-zinc-200 bg-zinc-50 p-8 sm:flex-row dark:border-zinc-800 dark:bg-zinc-900/50">
          <div>
            <h3 className="text-xl font-semibold tracking-tight">
              {t("businessBlock.heading")}
            </h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {t("businessBlock.subheading")}
            </p>
          </div>
          <Link
            href="/signup/business"
            className="inline-flex h-11 items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {t("businessBlock.cta")}
          </Link>
        </div>
      </section>

      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-500 dark:border-zinc-800">
        © 2026 Total Reservation
      </footer>
    </div>
  );
}
