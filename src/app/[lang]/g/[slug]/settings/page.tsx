import Link from "next/link";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { OwnerShell } from "../OwnerShell";
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
    <OwnerShell
      lang={lang}
      slug={slug}
      businessName={business.name}
      subtitle={t("title")}
    >
      <main className="bg-white">
        <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-10">
          <p className="text-sm leading-relaxed text-zinc-500">
            {t("subtitle")}
          </p>
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
    </OwnerShell>
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
          <h3 className="text-xl font-semibold tracking-tight text-zinc-900">
            {heading}
          </h3>
          <p className="mt-1 text-sm text-zinc-600">{body}</p>
        </div>
        {href && cta && (
          <Link
            href={href}
            className="shrink-0 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-700"
          >
            {cta}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
