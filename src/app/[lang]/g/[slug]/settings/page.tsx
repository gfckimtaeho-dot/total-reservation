import Link from "next/link";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { LangToggle } from "@/components/LangToggle";
import { HotelGuestPriceForm } from "./HotelGuestPriceForm";
import { ScannerLinkCard } from "./ScannerLinkCard";

export default async function GymSettingsPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const user = await requireGymStaff(slug);
  const business = user.business!;
  const t = await getTranslations("settings");

  // 호텔 게스트 단가는 OWNER/MANAGER 만 설정. 세션 business 엔 없는 필드라 조회.
  // 스캐너 링크 표시는 절대 URL 필요 — 요청 host 로 origin 구성(클라 window 회피).
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;

  const canManagePrice = user.role === "OWNER" || user.role === "MANAGER";
  const settingsRow = canManagePrice
    ? await prisma.business.findUnique({
        where: { id: business.id },
        select: {
          hotelGuestDailyPricePhp: true,
          scannerKey: true,
          contactEmail: true,
        },
      })
    : null;

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
            href={`/${lang}/g/${slug}/dashboard`}
            className="text-sm text-zinc-700 transition hover:text-ink"
          >
            {t("back")}
          </Link>
        </div>
      </header>

      <section className="bg-band">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-12 sm:py-16">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/70">
            SETTINGS · {business.slug}
          </span>
          <h1 className="font-heading max-w-2xl text-4xl leading-[1.1] tracking-tight text-ink sm:text-5xl">
            {t("title")}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-ink/70 sm:text-base">
            {t("subtitle")}
          </p>
        </div>
      </section>

      <main className="flex-1 bg-white">
        <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-12 sm:py-16">
          <SettingCard
            heading={t("language.heading")}
            body={t("language.body")}
          >
            <div className="mt-4 flex items-center gap-4">
              <span className="text-xs text-zinc-500">
                {t("language.current")}:
              </span>
              <LangToggle
                currentLang={lang}
                pathSuffix={`/g/${slug}/settings`}
              />
            </div>
          </SettingCard>

          <SettingCard
            heading={t("account.heading")}
            body={t("account.body")}
            href={`/${lang}/g/${slug}/settings/account`}
            cta={t("account.cta")}
          />

          {canManagePrice && (
            <SettingCard
              heading={t("hotelGuestPrice.heading")}
              body={t("hotelGuestPrice.body")}
            >
              <HotelGuestPriceForm
                slug={slug}
                current={settingsRow?.hotelGuestDailyPricePhp ?? null}
              />
            </SettingCard>
          )}

          {canManagePrice && (
            <SettingCard
              heading={t("scannerLink.heading")}
              body={t("scannerLink.body")}
            >
              <ScannerLinkCard
                slug={slug}
                lang={lang}
                scannerKey={settingsRow?.scannerKey ?? null}
                defaultEmail={settingsRow?.contactEmail ?? ""}
                origin={origin}
              />
            </SettingCard>
          )}
        </div>
      </main>

      <footer className="border-t border-zinc-100 py-6 text-center text-xs text-zinc-500">
        © 2026 예약가즈아 · /g/{business.slug}
      </footer>
    </div>
  );
}

function SettingCard({
  heading,
  body,
  href,
  cta,
  children,
}: {
  heading: string;
  body: string;
  href?: string;
  cta?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-heading text-xl tracking-tight text-ink">
            {heading}
          </h3>
          <p className="mt-1 text-sm text-zinc-600">{body}</p>
        </div>
        {href && cta && (
          <Link
            href={href}
            className="shrink-0 rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-white transition hover:bg-ink/90"
          >
            {cta}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
