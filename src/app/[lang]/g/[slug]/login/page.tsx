import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db/client";
import { LangToggle } from "@/components/LangToggle";
import { GymLoginForm } from "./GymLoginForm";

export default async function GymLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; slug: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const { lang, slug } = await params;
  const { email } = await searchParams;
  const t = await getTranslations("login.gym");

  const business = await prisma.business.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, status: true },
  });
  if (!business) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-zinc-100">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link
            href={`/${lang}`}
            className="font-heading text-2xl tracking-tight text-ink"
          >
            예약가즈아
          </Link>
          <div className="flex items-center gap-5">
            <LangToggle
              currentLang={lang}
              pathSuffix={`/g/${business.slug}/login${email ? `?email=${encodeURIComponent(email)}` : ""}`}
            />
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
              /g/{business.slug}
            </span>
          </div>
        </div>
      </header>

      <section className="bg-band">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-16 sm:py-20">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/70">
            {business.name}
          </span>
          <h1 className="font-heading max-w-2xl text-4xl leading-[1.1] tracking-tight text-ink sm:text-5xl">
            {t("title")}
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-ink/70 sm:text-base">
            {t("subtitle")}
          </p>
        </div>
      </section>

      <main className="flex-1 bg-white">
        <div className="mx-auto w-full max-w-md px-6 py-16">
          <GymLoginForm slug={business.slug} initialEmail={email ?? ""} />
        </div>
      </main>

      <footer className="border-t border-zinc-100 py-6 text-center text-xs text-zinc-500">
        <Link
          href={`/${lang}/login`}
          className="text-zinc-500 hover:text-ink"
        >
          {t("back")}
        </Link>
      </footer>
    </div>
  );
}
