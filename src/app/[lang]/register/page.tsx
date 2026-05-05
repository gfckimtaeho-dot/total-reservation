import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { LangToggle } from "@/components/LangToggle";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { lang } = await params;
  const { token } = await searchParams;
  const t = await getTranslations("register");

  const tokenPresent = typeof token === "string" && token.length > 0;

  const cities = tokenPresent
    ? await prisma.city.findMany({
        orderBy: { name: "asc" },
        include: { barangays: { orderBy: { name: "asc" } } },
      })
    : [];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="bg-ink text-ink-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-end gap-3 px-6 py-2 text-xs">
          <span className="text-white/70">{t("topbar.alreadyMember")}</span>
          <Link
            href={`/${lang}/login`}
            className="font-medium underline-offset-4 hover:underline"
          >
            {t("topbar.login")}
          </Link>
        </div>
      </div>

      <header className="border-b border-zinc-100">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link
            href={`/${lang}`}
            className="font-heading text-2xl tracking-tight text-ink"
          >
            {t("header.brand")}
          </Link>
          <div className="flex items-center gap-5 text-sm">
            <LangToggle
              currentLang={lang}
              pathSuffix={`/register${token ? `?token=${encodeURIComponent(token)}` : ""}`}
            />
            <Link
              href={`/${lang}/admin/login`}
              className="text-zinc-700 transition hover:text-ink"
            >
              {t("header.adminLink")}
            </Link>
          </div>
        </div>
      </header>

      <section className="bg-band">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-20 sm:py-28">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/70">
            {t("hero.label")}
          </span>
          <h1 className="font-heading max-w-3xl text-5xl leading-[1.05] tracking-tight text-ink sm:text-6xl">
            {t.rich("hero.title", {
              em: (chunks) => <span className="italic">{chunks}</span>,
            })}
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-ink/70 sm:text-lg">
            {t("hero.tagline")}
          </p>
        </div>
      </section>

      <main className="flex-1 bg-white">
        <div className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-20">
          {tokenPresent ? (
            <RegisterForm token={token!} cities={cities} />
          ) : (
            <TokenMissing lang={lang} />
          )}
        </div>
      </main>

      <footer className="border-t border-zinc-100 py-6 text-center text-xs text-zinc-500">
        {t("footer.rights")}
      </footer>
    </div>
  );
}

async function TokenMissing({ lang }: { lang: string }) {
  const t = await getTranslations("register.tokenMissing");
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center sm:p-14">
      <h2 className="font-heading text-3xl tracking-tight text-ink sm:text-4xl">
        {t("title")}
      </h2>
      <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-zinc-600">
        {t("body")}
      </p>
      <Link
        href={`/${lang}`}
        className="mt-8 inline-block text-sm text-ink underline underline-offset-4"
      >
        {t("back")}
      </Link>
    </div>
  );
}
