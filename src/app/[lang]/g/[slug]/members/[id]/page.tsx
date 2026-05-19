import Link from "next/link";
import { notFound } from "next/navigation";
import { differenceInYears } from "date-fns";
import { getTranslations } from "next-intl/server";
import { logout } from "@/lib/auth/actions";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { getTheme } from "@/lib/theme";
import { SidebarNav } from "../../dashboard/SidebarNav";
import { MemberAddDialog } from "../MemberAddDialog";

const PAGE_BG = {
  normal: "bg-amber-50/50",
  black: "bg-zinc-950 text-zinc-200",
  white: "bg-violet-50/40",
} as const;

const SIDEBAR_BG = {
  normal: "bg-band",
  black: "bg-black",
  white: "border-r border-violet-100 bg-violet-50",
} as const;

const SIDEBAR_BORDER = {
  normal: "border-ink/10",
  black: "border-white/5",
  white: "border-violet-100",
} as const;

const SIDEBAR_LABEL = {
  normal: "text-ink/70",
  black: "text-lime-300/80",
  white: "text-ink/60",
} as const;

const SIDEBAR_NAME = {
  normal: "text-ink",
  black: "text-white",
  white: "text-ink",
} as const;

const HEADER_BORDER = {
  normal: "border-amber-200/60",
  black: "border-white/5",
  white: "border-violet-100",
} as const;

const SECTION = {
  normal: "rounded-2xl bg-white ring-1 ring-amber-200/60 p-6",
  black: "rounded-2xl bg-zinc-900 ring-1 ring-white/10 p-6",
  white: "rounded-2xl bg-white ring-1 ring-violet-100 p-6",
} as const;

const TITLE = {
  normal: "text-ink",
  black: "text-white",
  white: "text-ink",
} as const;

const SUBTLE = {
  normal: "text-zinc-600",
  black: "text-zinc-400",
  white: "text-zinc-600",
} as const;

const PILL_ACTIVE = {
  normal: "bg-band/60 text-ink",
  black: "bg-lime-300/20 text-lime-300",
  white: "bg-violet-100 text-violet-800",
} as const;

const PILL_PENDING = {
  normal: "bg-amber-100 text-amber-900/80",
  black: "bg-amber-300/20 text-amber-300",
  white: "bg-amber-100 text-amber-800",
} as const;

const ROW_BORDER = {
  normal: "border-amber-200/60",
  black: "border-white/10",
  white: "border-violet-100",
} as const;

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string; id: string }>;
}) {
  const { lang, slug, id } = await params;
  const auth = await requireGymStaff(slug);
  const business = auth.business!;
  const theme = await getTheme();
  const t = await getTranslations("memberDetail");
  const tn = await getTranslations("nav");

  const u = await prisma.user.findFirst({
    where: { id, gymId: business.id, role: "CUSTOMER" },
    select: {
      id: true,
      name: true,
      gender: true,
      phone: true,
      email: true,
      dob: true,
      emergencyContactPhone: true,
      note: true,
      status: true,
      locale: true,
      createdAt: true,
      memberships: {
        orderBy: { endDate: "desc" },
        select: {
          id: true,
          startDate: true,
          endDate: true,
          plan: { select: { name: true } },
        },
      },
      packages: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          totalCount: true,
          remainingCount: true,
          service: { select: { name: true } },
        },
      },
    },
  });
  if (!u) notFound();

  const today = new Date();
  const age = u.dob ? differenceInYears(today, u.dob) : null;
  const dobStr = u.dob ? u.dob.toISOString().slice(0, 10) : null;
  const joinedStr = u.createdAt.toISOString().slice(0, 10);

  const statusLabel =
    u.status === "ACTIVE"
      ? t("statusActive")
      : u.status === "PENDING"
        ? t("statusPending")
        : t("statusWithdrawn");
  const statusPill =
    u.status === "ACTIVE" ? PILL_ACTIVE[theme] : PILL_PENDING[theme];

  return (
    <div className={`flex min-h-screen ${PAGE_BG[theme]}`}>
      <aside
        className={`hidden w-60 shrink-0 flex-col lg:flex ${SIDEBAR_BG[theme]}`}
      >
        <div className={`border-b px-6 py-6 ${SIDEBAR_BORDER[theme]}`}>
          <span
            className={`text-xs font-semibold uppercase tracking-[0.22em] ${SIDEBAR_LABEL[theme]}`}
          >
            {tn("studio")}
          </span>
          <div
            className={`mt-1 font-heading text-lg tracking-tight ${SIDEBAR_NAME[theme]}`}
          >
            {business.name}
          </div>
          <div
            className={`mt-0.5 text-xs ${
              theme === "normal" ? "text-ink/60" : "text-zinc-500"
            }`}
          >
            /g/{slug}
          </div>
        </div>
        <SidebarNav tone={theme} />
        <div className={`border-t px-3 py-4 ${SIDEBAR_BORDER[theme]}`}>
          <form action={logout.bind(null, `/${lang}/g/${slug}/login`)}>
            <button
              className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm ${
                theme === "black"
                  ? "text-zinc-400 hover:bg-white/5"
                  : theme === "white"
                    ? "text-zinc-700 hover:bg-zinc-50"
                    : "text-ink/80 hover:bg-white/40"
              }`}
            >
              {tn("logout")}
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <header
          className={`flex items-center justify-between border-b px-8 py-5 ${HEADER_BORDER[theme]}`}
        >
          <div>
            <span
              className={`text-xs font-semibold uppercase tracking-[0.22em] ${
                theme === "black" ? "text-lime-300/80" : "text-ink/60"
              }`}
            >
              {t("eyebrow")}
            </span>
            <h1
              className={`font-heading text-xl tracking-tight ${TITLE[theme]}`}
            >
              {u.name}{" "}
              <span
                className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium align-middle ${statusPill}`}
              >
                {statusLabel}
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <MemberAddDialog
              slug={slug}
              tone={theme}
              lang={lang}
              mode="edit"
              member={{
                id: u.id,
                name: u.name,
                gender: u.gender as "MALE" | "FEMALE" | null,
                phone: u.phone,
                email: u.email,
                dob: dobStr,
                emergencyContactPhone: u.emergencyContactPhone,
                note: u.note,
                locale: u.locale as "en" | "ko",
              }}
            />
            <Link
              href={`/${lang}/g/${slug}/members`}
              className={`text-sm transition ${
                theme === "black"
                  ? "text-zinc-400 hover:text-lime-300"
                  : "text-zinc-600 hover:text-ink"
              }`}
            >
              {t("back")}
            </Link>
          </div>
        </header>

        <div className="mx-auto w-full max-w-5xl space-y-5 p-6">
          {/* Basic */}
          <section className={SECTION[theme]}>
            <h2
              className={`font-heading text-lg tracking-tight ${TITLE[theme]}`}
            >
              {t("basicHeading")}
            </h2>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <Cell
                label={t("labelGender")}
                value={
                  u.gender === "MALE"
                    ? t("genderMale")
                    : u.gender === "FEMALE"
                      ? t("genderFemale")
                      : t("noValue")
                }
                title={TITLE[theme]}
                subtle={SUBTLE[theme]}
              />
              <Cell
                label={t("labelAge")}
                value={age != null ? t("ageUnit", { age }) : t("noValue")}
                title={TITLE[theme]}
                subtle={SUBTLE[theme]}
              />
              <Cell
                label={t("labelDob")}
                value={dobStr ?? t("noValue")}
                title={TITLE[theme]}
                subtle={SUBTLE[theme]}
              />
              <Cell
                label={t("labelPhone")}
                value={u.phone ?? t("noValue")}
                title={TITLE[theme]}
                subtle={SUBTLE[theme]}
              />
              <Cell
                label={t("labelEmail")}
                value={u.email ?? t("noValue")}
                title={TITLE[theme]}
                subtle={SUBTLE[theme]}
              />
              <Cell
                label={t("labelEmergency")}
                value={u.emergencyContactPhone ?? t("noValue")}
                title={TITLE[theme]}
                subtle={SUBTLE[theme]}
              />
              <Cell
                label={t("labelLanguage")}
                value={
                  u.locale === "en" ? t("langEnglish") : t("langKorean")
                }
                title={TITLE[theme]}
                subtle={SUBTLE[theme]}
              />
              <Cell
                label={t("labelStatus")}
                value={statusLabel}
                title={TITLE[theme]}
                subtle={SUBTLE[theme]}
              />
              <Cell
                label={t("labelJoined")}
                value={joinedStr}
                title={TITLE[theme]}
                subtle={SUBTLE[theme]}
              />
            </dl>
            <div className="mt-4">
              <dt
                className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${SUBTLE[theme]}`}
              >
                {t("labelNote")}
              </dt>
              <dd
                className={`mt-1 whitespace-pre-wrap text-sm ${TITLE[theme]}`}
              >
                {u.note || t("noValue")}
              </dd>
            </div>
          </section>

          {/* Memberships */}
          <section className={SECTION[theme]}>
            <h2
              className={`font-heading text-lg tracking-tight ${TITLE[theme]}`}
            >
              {t("membershipsHeading")}
            </h2>
            {u.memberships.length === 0 ? (
              <p className={`mt-3 text-sm ${SUBTLE[theme]}`}>
                {t("membershipsNone")}
              </p>
            ) : (
              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className={`border-b ${ROW_BORDER[theme]}`}>
                    <th
                      className={`px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] ${SUBTLE[theme]}`}
                    >
                      {t("colPlan")}
                    </th>
                    <th
                      className={`px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] ${SUBTLE[theme]}`}
                    >
                      {t("colPeriod")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {u.memberships.map((m) => (
                    <tr
                      key={m.id}
                      className={`border-b ${ROW_BORDER[theme]}`}
                    >
                      <td className={`px-3 py-2 text-left ${TITLE[theme]}`}>
                        {m.plan?.name ?? t("noValue")}
                      </td>
                      <td
                        className={`px-3 py-2 text-center tabular-nums ${TITLE[theme]}`}
                      >
                        {m.startDate.toISOString().slice(0, 10)} ~{" "}
                        {m.endDate.toISOString().slice(0, 10)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Packages */}
          <section className={SECTION[theme]}>
            <h2
              className={`font-heading text-lg tracking-tight ${TITLE[theme]}`}
            >
              {t("packagesHeading")}
            </h2>
            {u.packages.length === 0 ? (
              <p className={`mt-3 text-sm ${SUBTLE[theme]}`}>
                {t("packagesNone")}
              </p>
            ) : (
              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className={`border-b ${ROW_BORDER[theme]}`}>
                    <th
                      className={`px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] ${SUBTLE[theme]}`}
                    >
                      {t("colService")}
                    </th>
                    <th
                      className={`px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] ${SUBTLE[theme]}`}
                    >
                      {t("colRemaining")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {u.packages.map((p) => (
                    <tr
                      key={p.id}
                      className={`border-b ${ROW_BORDER[theme]}`}
                    >
                      <td className={`px-3 py-2 text-left ${TITLE[theme]}`}>
                        {p.service?.name ?? t("noValue")}
                      </td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums ${TITLE[theme]}`}
                      >
                        {Number(p.remainingCount)} / {Number(p.totalCount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function Cell({
  label,
  value,
  title,
  subtle,
}: {
  label: string;
  value: string;
  title: string;
  subtle: string;
}) {
  return (
    <div>
      <dt
        className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${subtle}`}
      >
        {label}
      </dt>
      <dd className={`mt-0.5 ${title}`}>{value}</dd>
    </div>
  );
}
