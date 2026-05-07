import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db/client";
import { ActivateForm } from "./ActivateForm";

export default async function ActivatePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; slug: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { lang, slug } = await params;
  const { token } = await searchParams;
  const t = await getTranslations("activate");

  const business = await prisma.business.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });
  if (!business) notFound();

  const link = token
    ? await prisma.magicLinkToken.findUnique({
        where: { token },
        include: { targetUser: { select: { name: true, email: true } } },
      })
    : null;

  const tokenInvalid = !link || link.usedAt || link.expiresAt < new Date();
  const reason = !link
    ? t("invalidNotFound")
    : link.usedAt
      ? t("invalidUsed")
      : link.expiresAt < new Date()
        ? t("invalidExpired")
        : null;

  return (
    <div className="flex min-h-screen flex-col bg-amber-50/40">
      <header className="border-b border-amber-200/60 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link
            href={`/${lang}`}
            className="font-heading text-2xl tracking-tight text-ink"
          >
            예약가즈아
          </Link>
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
            {t("studioLabel", { slug: business.slug })}
          </span>
        </div>
      </header>

      <section className="bg-band">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-6 py-12">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/70">
            {business.name}
          </span>
          <h1 className="font-heading text-3xl leading-tight tracking-tight text-ink sm:text-4xl">
            {tokenInvalid ? (
              t("invalidTitle")
            ) : (
              <span
                dangerouslySetInnerHTML={{
                  __html: t("welcome", { name: link!.targetUser.name }),
                }}
              />
            )}
          </h1>
          {!tokenInvalid && (
            <p className="text-sm leading-relaxed text-ink/70">
              {t("welcomeBody")}
            </p>
          )}
        </div>
      </section>

      <main className="flex-1 bg-white">
        <div className="mx-auto w-full max-w-md px-6 py-12">
          {tokenInvalid ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
              <h2 className="font-heading text-lg tracking-tight text-rose-900">
                {t("errorBoxTitle")}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-rose-800">
                {reason}
              </p>
              <Link
                href={
                  link?.targetUser?.email
                    ? `/${lang}/g/${slug}/login?email=${encodeURIComponent(link.targetUser.email)}`
                    : `/${lang}/g/${slug}/login`
                }
                className="mt-4 inline-block text-sm font-medium text-ink underline"
              >
                {t("loginLink")}
              </Link>
            </div>
          ) : (
            <ActivateForm slug={slug} token={token!} />
          )}
        </div>
      </main>

      <footer className="border-t border-amber-200/60 bg-white py-6 text-center text-xs text-zinc-500">
        © 2026 예약가즈아 · /g/{business.slug}
      </footer>
    </div>
  );
}
