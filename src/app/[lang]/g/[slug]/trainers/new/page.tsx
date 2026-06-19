import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireGymStaff } from "@/lib/auth/dal";
import { OwnerShell } from "../../OwnerShell";
import { TrainerForm } from "./TrainerForm";

export default async function NewTrainerPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const auth = await requireGymStaff(slug);
  const business = auth.business!;
  const t = await getTranslations("trainerAdd");

  return (
    <OwnerShell
      lang={lang}
      slug={slug}
      businessName={business.name}
      subtitle={t("title")}
      action={
        <Link
          href={`/${lang}/g/${slug}/trainers`}
          className="inline-flex items-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50"
        >
          {t("back")}
        </Link>
      }
    >
      <div className="mx-auto w-full max-w-5xl p-6">
        <TrainerForm slug={slug} lang={lang} tone="indigo" />
      </div>
    </OwnerShell>
  );
}
