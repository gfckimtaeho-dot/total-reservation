import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function Landing() {
  const t = await getTranslations("landing");

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        {t("title")}
      </h1>
      <p className="mt-4 max-w-md text-lg text-zinc-600 dark:text-zinc-400">
        {t("tagline")}
      </p>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/customer"
          className="inline-flex h-12 items-center justify-center rounded-full bg-foreground px-6 text-background transition-colors hover:opacity-90"
        >
          {t("ctaCustomer")}
        </Link>
        <Link
          href="/business/register"
          className="inline-flex h-12 items-center justify-center rounded-full border border-current px-6 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
        >
          {t("ctaBusiness")}
        </Link>
      </div>
    </main>
  );
}
