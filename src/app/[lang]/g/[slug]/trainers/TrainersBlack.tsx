import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { logout } from "@/lib/auth/actions";
import { SidebarNav } from "../dashboard/SidebarNav";
import { TrainersSearch } from "./TrainersSearch";
import { TrainerRow, type TrainerView } from "./TrainerRow";

type Specialty = "HEALTH" | "YOGA" | "PILATES" | "DANCE";

type Props = {
  lang: string;
  slug: string;
  businessName: string;
  trainers: TrainerView[];
  q: string;
  role: "all" | "TRAINER" | "MANAGER";
  specialties: Specialty[];
  onLeave: boolean;
};

export async function TrainersBlack({
  lang,
  slug,
  businessName,
  trainers,
  q,
  role,
  specialties,
  onLeave,
}: Props) {
  const t = await getTranslations("trainers");
  const tn = await getTranslations("nav");
  const filtered =
    Boolean(q) || role !== "all" || specialties.length > 0 || onLeave;

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-200">
      <aside className="hidden w-60 shrink-0 flex-col bg-black lg:flex">
        <div className="border-b border-white/5 px-6 py-6">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-lime-300/80">
            {tn("studio")}
          </span>
          <div className="mt-1 font-heading text-lg tracking-tight text-white">
            {businessName}
          </div>
          <div className="mt-0.5 text-xs text-zinc-500">/g/{slug}</div>
        </div>
        <SidebarNav tone="black" />
        <div className="border-t border-white/5 px-3 py-4">
          <form action={logout.bind(null, `/${lang}/g/${slug}/login`)}>
            <button className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-zinc-400 hover:bg-white/5">
              {tn("logout")}
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <header className="flex items-center justify-between border-b border-white/5 px-8 py-5">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-lime-300/80">
              {t("eyebrow")}
            </span>
            <h1 className="font-heading text-xl tracking-tight text-white">
              {t("titleCount", { count: trainers.length })}
              {filtered && (
                <span className="ml-2 text-sm font-normal text-zinc-500">
                  {t("filtered")}
                </span>
              )}
            </h1>
          </div>
          <Link
            href={`/${lang}/g/${slug}/trainers/new`}
            className="inline-flex h-10 items-center rounded-md bg-lime-300 px-4 text-sm font-medium text-zinc-950 transition hover:bg-lime-200"
          >
            {t("addBtn")}
          </Link>
        </header>

        <div className="p-6">
          <TrainersSearch
            tone="black"
            q={q}
            role={role}
            specialties={specialties}
            onLeave={onLeave}
          />
          <div className="overflow-x-auto rounded-2xl border border-white/5 bg-zinc-900">
            {trainers.length === 0 ? (
              <EmptyState filtered={filtered} t={t} />
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 bg-zinc-900/60">
                    <Th>{t("colPhoto")}</Th>
                    <Th>{t("colName")}</Th>
                    <Th>{t("colRole")}</Th>
                    <Th>{t("colSpecialties")}</Th>
                    <Th>{t("colWeeklyDays")}</Th>
                    <Th>{t("colTodayStatus")}</Th>
                    <Th>{t("colPhone")}</Th>
                    <Th>{t("colActions")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {trainers.map((tr) => (
                    <TrainerRow
                      key={tr.staffId}
                      lang={lang}
                      slug={slug}
                      trainer={tr}
                      tone="black"
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <footer className="border-t border-white/5 px-8 py-5 text-xs text-zinc-500">
          예약가즈아 · /g/{slug} ·{" "}
          <Link
            href={`/${lang}/g/${slug}/dashboard`}
            className="hover:text-lime-300"
          >
            {t("footerLink")}
          </Link>
        </footer>
      </main>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-lime-300/80">
      {children}
    </th>
  );
}

function EmptyState({
  filtered,
  t,
}: {
  filtered: boolean;
  t: (k: string) => string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-20">
      <div className="font-heading text-2xl tracking-tight text-white">
        {filtered ? t("emptyNoMatch") : t("emptyNoTrainers")}
      </div>
      <p className="max-w-md text-center text-sm text-zinc-400">
        {filtered ? t("emptyAdjustHint") : t("emptyAddHint")}
      </p>
    </div>
  );
}
