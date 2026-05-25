import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { logout } from "@/lib/auth/actions";
import { requireGymStaff } from "@/lib/auth/dal";
import { SidebarNav } from "../../dashboard/SidebarNav";
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
  const tn = await getTranslations("nav");

  return (
    <div className="flex min-h-screen bg-white">
      <aside className="hidden w-60 shrink-0 flex-col lg:flex border-r border-violet-100 bg-violet-50">
        <div className="border-b px-6 py-6 border-violet-100">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
            {tn("studio")}
          </span>
          <div className="mt-1 font-heading text-lg tracking-tight text-ink">
            {business.name}
          </div>
          <div className="mt-0.5 text-xs text-zinc-500">/g/{slug}</div>
        </div>
        <SidebarNav />
        <div className="border-t px-3 py-4 border-violet-100">
          <form action={logout.bind(null, `/${lang}/g/${slug}/login`)}>
            <button className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50">
              {tn("logout")}
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <header className="flex items-center justify-between border-b px-8 py-5 border-violet-100">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
              TRAINERS
            </span>
            <h1 className="font-heading text-xl tracking-tight text-ink">
              {t("title")}
            </h1>
          </div>
          <Link
            href={`/${lang}/g/${slug}/trainers`}
            className="text-sm transition text-zinc-600 hover:text-ink"
          >
            {t("back")}
          </Link>
        </header>

        <div className="mx-auto w-full max-w-5xl p-6">
          <TrainerForm slug={slug} lang={lang} tone="white" />
        </div>
      </main>
    </div>
  );
}
