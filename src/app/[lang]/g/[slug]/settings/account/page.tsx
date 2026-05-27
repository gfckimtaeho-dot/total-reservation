import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireGymStaff } from "@/lib/auth/dal";
import { AccountForm } from "./AccountForm";

export default async function MyAccountPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const user = await requireGymStaff(slug);
  const business = user.business!;
  const t = await getTranslations("settings.account");

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-zinc-100">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link
            href={`/${lang}/g/${slug}/dashboard`}
            className="font-heading text-2xl tracking-tight text-ink"
          >
            {business.name}
          </Link>
          <Link
            href={`/${lang}/g/${slug}/settings`}
            className="text-sm text-zinc-700 transition hover:text-ink"
          >
            {t("back")}
          </Link>
        </div>
      </header>

      <section className="bg-band">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-10">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/70">
            ACCOUNT · {business.slug}
          </span>
          <h1 className="font-heading max-w-2xl text-3xl leading-[1.1] tracking-tight text-ink sm:text-4xl">
            {t("title")}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-ink/70">
            {t("subtitle")}
          </p>
        </div>
      </section>

      <main className="flex-1 bg-white">
        <div className="mx-auto w-full max-w-2xl px-6 py-10">
          <AccountForm
            slug={slug}
            initial={{
              name: user.name,
              loginId: user.loginId ?? "",
              email: user.email ?? "",
              phone: user.phone ?? "",
              locale: (user.locale as "en" | "ko") ?? "en",
            }}
          />
        </div>
      </main>
    </div>
  );
}
