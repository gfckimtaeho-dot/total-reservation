import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LangToggle } from "@/components/LangToggle";
import { LoginForm } from "./LookupForm";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const { lang } = await params;
  const { email } = await searchParams;
  const t = await getTranslations("login.unified");

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
          <LangToggle
            currentLang={lang}
            pathSuffix={`/login${email ? `?email=${encodeURIComponent(email)}` : ""}`}
          />
        </div>
      </header>

      <section className="bg-band">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-16 sm:py-20">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/70">
            SIGN IN
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
          <LoginForm initialEmail={email ?? ""} />
        </div>
      </main>

      <footer className="border-t border-zinc-100 py-6 text-center text-xs text-zinc-500">
        <Link
          href={`/${lang}`}
          className="text-zinc-500 hover:text-ink"
        >
          {t("back")}
        </Link>
      </footer>
    </div>
  );
}
