import { getTranslations } from "next-intl/server";
import { logout } from "@/lib/auth/actions";
import { requireGymCustomer } from "@/lib/auth/dal";
import { MeAccessQr } from "./MeAccessQr";

export default async function CustomerHomePage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const user = await requireGymCustomer(slug);
  const business = user.business!;
  const t = await getTranslations("me");

  return (
    <div className="flex min-h-screen flex-col bg-amber-50/40">
      <header className="border-b border-amber-200/60 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
              {business.name}
            </span>
            <div className="font-heading text-lg tracking-tight text-ink">
              {t("header")}
            </div>
          </div>
          <form action={logout.bind(null, `/${lang}/g/${slug}/login`)}>
            <button className="text-sm text-zinc-600 hover:text-ink">
              {t("logout")}
            </button>
          </form>
        </div>
      </header>

      <section className="bg-band">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-6 py-12">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/70">
            {t("memberEyebrow", { storeName: business.name })}
          </span>
          <h1
            className="font-heading text-3xl leading-tight tracking-tight text-ink sm:text-4xl"
            dangerouslySetInnerHTML={{
              __html: t("welcome", { name: user.name }),
            }}
          />
          <p className="text-sm leading-relaxed text-ink/70">
            {t("body", { storeName: business.name })}
          </p>
        </div>
      </section>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl space-y-4 px-6 py-12">
          <MeAccessQr slug={slug} />

          <div className="rounded-2xl border border-amber-200/60 bg-white p-6">
            <h2 className="font-heading text-xl tracking-tight text-ink">
              {t("myInfo")}
            </h2>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Row label={t("labelName")} value={user.name} />
              <Row
                label={t("labelGender")}
                value={
                  user.gender === "MALE"
                    ? t("genderMale")
                    : user.gender === "FEMALE"
                      ? t("genderFemale")
                      : "-"
                }
              />
              <Row label={t("labelPhone")} value={user.phone ?? "-"} />
              <Row label={t("labelEmail")} value={user.email ?? "-"} />
            </dl>
          </div>

          <div className="rounded-2xl bg-band/40 p-6 ring-1 ring-amber-200/60">
            <h3 className="font-heading text-lg tracking-tight text-ink">
              {t("pwaCardTitle")}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-700">
              {t("pwaCardBody")}
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-amber-200/60 bg-white py-6 text-center text-xs text-zinc-500">
        © 2026 예약가즈아 · /g/{slug}
      </footer>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </>
  );
}
