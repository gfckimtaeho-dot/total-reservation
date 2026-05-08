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

export async function TrainersNormal({
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
    <div className="flex min-h-screen bg-amber-50/50">
      <aside className="hidden w-60 shrink-0 flex-col bg-band lg:flex">
        <div className="border-b border-ink/10 px-6 py-6">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/70">
            {tn("studio")}
          </span>
          <div className="mt-1 font-heading text-lg tracking-tight text-ink">
            {businessName}
          </div>
          <div className="mt-0.5 text-xs text-ink/60">/g/{slug}</div>
        </div>
        <SidebarNav tone="normal" />
        <div className="border-t border-ink/10 px-3 py-4">
          <form action={logout.bind(null, `/${lang}/g/${slug}/login`)}>
            <button className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-ink/80 hover:bg-white/40">
              {tn("logout")}
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <header className="flex items-center justify-between border-b border-amber-200/60 px-8 py-5">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
              {t("eyebrow")}
            </span>
            <h1 className="font-heading text-xl tracking-tight text-ink">
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
            className="inline-flex h-10 items-center rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-ink/90"
          >
            {t("addBtn")}
          </Link>
        </header>

        <div className="p-6">
          <TrainersSearch
            tone="normal"
            q={q}
            role={role}
            specialties={specialties}
            onLeave={onLeave}
          />
          <div className="overflow-x-auto rounded-2xl border border-amber-200/60 bg-white">
            {trainers.length === 0 ? (
              <EmptyState filtered={filtered} t={t} />
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-amber-200/60 bg-amber-50/40">
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
                      tone="normal"
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <footer className="border-t border-amber-200/60 bg-white/50 px-8 py-5 text-xs text-zinc-500">
          예약가즈아 · /g/{slug} ·{" "}
          <Link
            href={`/${lang}/g/${slug}/dashboard`}
            className="hover:text-ink"
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
    <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/60">
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
      <div className="font-heading text-2xl tracking-tight text-ink">
        {filtered ? t("emptyNoMatch") : t("emptyNoTrainers")}
      </div>
      <p className="max-w-md text-center text-sm text-zinc-600">
        {filtered ? t("emptyAdjustHint") : t("emptyAddHint")}
      </p>
    </div>
  );
}
