import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { LangToggle } from "@/components/LangToggle";

export default async function Landing({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = await getTranslations("landing");

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-zinc-100">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <span className="font-heading text-2xl tracking-tight text-ink">
            {t("brand")}
          </span>
          <div className="flex items-center gap-5 text-sm">
            <LangToggle currentLang={lang} pathSuffix="" />
            <Link
              href={`/${lang}/login`}
              className="text-zinc-700 transition hover:text-ink"
            >
              {t("studioLogin")}
            </Link>
            <Link
              href={`/${lang}/admin/login`}
              className="text-zinc-700 transition hover:text-ink"
            >
              {t("adminLogin")}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-24">
        <div className="max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
            {t("tagline")}
          </span>
          <h1 className="font-heading mt-6 text-5xl leading-[1.05] tracking-tight text-ink sm:text-6xl">
            {t.rich("title", { em: (c) => <span className="italic">{c}</span> })}
          </h1>
          <p className="mt-6 text-base leading-relaxed text-zinc-600 sm:text-lg">
            {t("body")}
          </p>
        </div>
      </main>

      <footer className="border-t border-zinc-100 py-6 text-center text-xs text-zinc-500">
        {t("rights")}
      </footer>
    </div>
  );
}
