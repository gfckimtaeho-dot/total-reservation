import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { logout } from "@/lib/auth/actions";
import { SidebarNav } from "../dashboard/SidebarNav";
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

export async function MembersBlack({
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
  const tn = await getTranslations("nav");
  const filtered = Boolean(q) || gender !== "all" || expiringSoon;

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
              {t("titleCount", { count: members.length })}
              {filtered && (
                <span className="ml-2 text-sm font-normal text-zinc-500">
                  {t("filtered")}
                </span>
              )}
            </h1>
          </div>
          <MemberAddDialog slug={slug} tone="black" lang={lang} />
        </header>

        <div className="p-6">
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-300/80">
                {t("expireWeekLabel")}
              </span>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="font-heading text-4xl tabular-nums tracking-tight text-rose-300">
                  {expireWeekCount}
                </span>
                <span className="text-sm text-rose-300/70">{t("peopleUnit")}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-300/80">
                {t("expireMonthLabel")}
              </span>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="font-heading text-4xl tabular-nums tracking-tight text-amber-300">
                  {expireMonthCount}
                </span>
                <span className="text-sm text-amber-300/70">{t("peopleUnit")}</span>
              </div>
            </div>
          </div>
          <MembersSearch
            tone="black"
            q={q}
            gender={gender}
            expiringSoon={expiringSoon}
          />
          <div className="overflow-hidden rounded-2xl border border-white/5 bg-zinc-900">
            {members.length === 0 ? (
              <EmptyState filtered={filtered} t={t} />
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 bg-zinc-900/60">
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
                    <MemberRow
                      key={m.id}
                      slug={slug}
                      member={m}
                      tone="black"
                      lang={lang}
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
        {filtered ? t("emptyNoMatch") : t("emptyNoMembers")}
      </div>
      <p className="max-w-md text-center text-sm text-zinc-400">
        {filtered ? t("emptyAdjustHint") : t("emptyAddHint")}
      </p>
    </div>
  );
}
