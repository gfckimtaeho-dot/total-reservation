import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { OwnerShell } from "../OwnerShell";
import { TrainersSearch } from "./TrainersSearch";
import { TrainerRow, type TrainerView } from "./TrainerRow";
import { AttendanceMatrix, type AttendanceRow } from "./AttendanceMatrix";

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
  attendance: AttendanceRow[];
};

export async function TrainersWhite({
  lang,
  slug,
  businessName,
  trainers,
  q,
  role,
  specialties,
  onLeave,
  attendance,
}: Props) {
  const t = await getTranslations("trainers");
  const filtered =
    Boolean(q) || role !== "all" || specialties.length > 0 || onLeave;

  return (
    <OwnerShell
      lang={lang}
      slug={slug}
      businessName={businessName}
      subtitle={
        <>
          {t("titleCount", { count: trainers.length })}
          {filtered && (
            <span className="ml-1 text-zinc-400">{t("filtered")}</span>
          )}
        </>
      }
      action={
        <Link
          href={`/${lang}/g/${slug}/trainers/new`}
          className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          {t("addBtn")}
        </Link>
      }
    >
      <div className="p-6">
        <TrainersSearch
          tone="indigo"
          q={q}
          role={role}
          specialties={specialties}
          onLeave={onLeave}
        />
        <div className="overflow-hidden rounded-2xl border border-zinc-200">
          <div className="overflow-x-auto">
            {trainers.length === 0 ? (
              <EmptyState filtered={filtered} t={t} />
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
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
                      tone="indigo"
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <AttendanceMatrix attendance={attendance} lang={lang} />
      </div>
    </OwnerShell>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
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
      <div className="text-2xl font-semibold tracking-tight text-zinc-900">
        {filtered ? t("emptyNoMatch") : t("emptyNoTrainers")}
      </div>
      <p className="max-w-md text-center text-sm text-zinc-600">
        {filtered ? t("emptyAdjustHint") : t("emptyAddHint")}
      </p>
    </div>
  );
}
