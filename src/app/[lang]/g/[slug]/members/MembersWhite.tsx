import { getTranslations } from "next-intl/server";
import { OwnerShell } from "../OwnerShell";
import { MemberAddDialog } from "./MemberAddDialog";
import { MemberRow, type MemberView } from "./MemberRow";
import { MembersSearch } from "./MembersSearch";

type Props = {
  lang: string;
  slug: string;
  businessName: string;
  members: MemberView[];
  q: string;
  gender: "all" | "MALE" | "FEMALE";
  expiringSoon: boolean;
  expireWeekCount: number;
  expireMonthCount: number;
};

export async function MembersWhite({
  lang,
  slug,
  businessName,
  members,
  q,
  gender,
  expiringSoon,
  expireWeekCount,
  expireMonthCount,
}: Props) {
  const t = await getTranslations("members");
  const filtered = Boolean(q) || gender !== "all" || expiringSoon;

  return (
    <OwnerShell
      lang={lang}
      slug={slug}
      businessName={businessName}
      subtitle={
        <>
          {t("titleCount", { count: members.length })}
          {filtered && (
            <span className="ml-1 text-zinc-400">{t("filtered")}</span>
          )}
        </>
      }
      action={<MemberAddDialog slug={slug} lang={lang} />}
    >
      <div className="p-6">
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-zinc-200 p-4">
            <span className="mb-2 block w-fit rounded-md bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
              {t("expireWeekLabel")}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-bold tabular-nums tracking-tight text-rose-600">
                {expireWeekCount}
              </span>
              <span className="text-base text-zinc-400">{t("peopleUnit")}</span>
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 p-4">
            <span className="mb-2 block w-fit rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
              {t("expireMonthLabel")}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-bold tabular-nums tracking-tight text-amber-600">
                {expireMonthCount}
              </span>
              <span className="text-base text-zinc-400">{t("peopleUnit")}</span>
            </div>
          </div>
        </div>
        <MembersSearch q={q} gender={gender} expiringSoon={expiringSoon} />
        <div className="overflow-hidden rounded-2xl border border-zinc-200">
          <div className="overflow-x-auto">
            {members.length === 0 ? (
              <EmptyState filtered={filtered} t={t} />
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <Th>{t("colName")}</Th>
                    <Th>{t("colAge")}</Th>
                    <Th>{t("colPhone")}</Th>
                    <Th>{t("colEmail")}</Th>
                    <Th>{t("colExpiry")}</Th>
                    <Th>{t("colRemaining")}</Th>
                    <Th>{t("colActions")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <MemberRow key={m.id} slug={slug} member={m} lang={lang} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
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
        {filtered ? t("emptyNoMatch") : t("emptyNoMembers")}
      </div>
      <p className="max-w-md text-center text-sm text-zinc-600">
        {filtered ? t("emptyAdjustHint") : t("emptyAddHint")}
      </p>
    </div>
  );
}
