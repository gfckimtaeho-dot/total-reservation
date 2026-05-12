import Link from "next/link";
import { notFound } from "next/navigation";
import { differenceInYears } from "date-fns";
import QRCode from "qrcode";
import { getTranslations } from "next-intl/server";
import { logout } from "@/lib/auth/actions";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { getTheme } from "@/lib/theme";
import { ensureAccessToken } from "@/lib/auth/accessToken";
import { SidebarNav } from "../../dashboard/SidebarNav";
import { RegenerateQrButton } from "./RegenerateQrButton";
import { LeaveManager } from "./LeaveManager";

const PAGE_BG = {
  normal: "bg-amber-50/50",
  black: "bg-zinc-950 text-zinc-200",
  white: "bg-white",
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
  white: "border-zinc-100",
} as const;

const SECTION = {
  normal: "rounded-2xl bg-white ring-1 ring-amber-200/60 p-6",
  black: "rounded-2xl bg-zinc-900 ring-1 ring-white/10 p-6",
  white: "rounded-2xl bg-white ring-1 ring-zinc-200 p-6",
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

const PILL_TRAINER = {
  normal: "bg-band/60 text-ink",
  black: "bg-lime-300/20 text-lime-300",
  white: "bg-sky-100 text-sky-900",
} as const;

const PILL_MANAGER = {
  normal: "bg-amber-100 text-amber-900/80",
  black: "bg-amber-300/20 text-amber-300",
  white: "bg-amber-100 text-amber-800",
} as const;

const WEEKDAY_ON = {
  normal: "bg-emerald-500 text-white",
  black: "bg-lime-300 text-zinc-950",
  white: "bg-sky-700 text-white",
} as const;

const WEEKDAY_OFF = {
  normal: "bg-zinc-200 text-zinc-500",
  black: "bg-zinc-700 text-zinc-400",
  white: "bg-zinc-200 text-zinc-500",
} as const;

const ALL_WEEKDAYS = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
] as const;

export default async function TrainerDetailPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string; id: string }>;
}) {
  const { lang, slug, id } = await params;
  const auth = await requireGymStaff(slug);
  const business = auth.business!;
  const theme = await getTheme();
  const t = await getTranslations("trainers");
  const tn = await getTranslations("nav");

  const staff = await prisma.staff.findFirst({
    where: { id, gymId: business.id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          dob: true,
          gender: true,
          emergencyContactPhone: true,
          note: true,
          status: true,
          createdAt: true,
        },
      },
      images: { orderBy: { position: "asc" } },
      leaves: { orderBy: { startDate: "desc" } },
    },
  });
  if (!staff) notFound();

  const u = staff.user;
  const today = new Date();
  const age = u.dob ? differenceInYears(today, u.dob) : null;
  const dobStr = u.dob ? u.dob.toISOString().slice(0, 10) : null;
  const allSpecs = [
    ...staff.specialties.map((s) => t(`specialty.${s}`)),
    ...(staff.customSpecialty ? [staff.customSpecialty] : []),
  ].join(" / ");

  const offSet = new Set(staff.weeklyOffDays);
  const accessToken = await ensureAccessToken(u.id);
  const qrDataUrl = await QRCode.toDataURL(accessToken, {
    width: 240,
    margin: 1,
    color: { dark: "#0a0a0a", light: "#ffffff" },
  });

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
              TRAINERS
            </span>
            <h1
              className={`font-heading text-xl tracking-tight ${TITLE[theme]}`}
            >
              {u.name}{" "}
              <span
                className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium align-middle ${
                  staff.role === "MANAGER"
                    ? PILL_MANAGER[theme]
                    : PILL_TRAINER[theme]
                }`}
              >
                {t(staff.role === "MANAGER" ? "roleManager" : "roleTrainer")}
              </span>
            </h1>
          </div>
          <Link
            href={`/${lang}/g/${slug}/trainers`}
            className={`text-sm transition ${
              theme === "black"
                ? "text-zinc-400 hover:text-lime-300"
                : "text-zinc-600 hover:text-ink"
            }`}
          >
            {t("detailBack")}
          </Link>
        </header>

        <div className="mx-auto w-full max-w-5xl space-y-5 p-6">
          {/* Access QR */}
          <section className={SECTION[theme]}>
            <h2
              className={`font-heading text-lg tracking-tight ${TITLE[theme]}`}
            >
              {t("detailQr")}
            </h2>
            <p className={`mt-1 text-xs ${SUBTLE[theme]}`}>
              {t("detailQrHint")}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-5">
              <div className="rounded-xl bg-white p-3 ring-1 ring-zinc-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt="Access QR"
                  className="block h-40 w-40"
                />
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <code
                  className={`break-all rounded-md px-2 py-1.5 font-mono text-[11px] ${
                    theme === "black"
                      ? "bg-zinc-800 text-zinc-300"
                      : "bg-zinc-50 text-zinc-600"
                  }`}
                >
                  {accessToken}
                </code>
                <RegenerateQrButton
                  slug={slug}
                  staffId={staff.id}
                  tone={theme}
                />
              </div>
            </div>
          </section>

          {/* Photos */}
          <section className={SECTION[theme]}>
            <h2
              className={`font-heading text-lg tracking-tight ${TITLE[theme]}`}
            >
              {t("detailPhotos")}
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-5">
              {staff.images.length === 0 ? (
                <div className={`text-sm ${SUBTLE[theme]}`}>
                  {t("noValue")}
                </div>
              ) : (
                staff.images.map((img, i) => (
                  <div
                    key={img.id}
                    className={`relative overflow-hidden rounded-xl bg-zinc-50 ${
                      i === 0 ? "sm:col-span-2 sm:row-span-2" : ""
                    }`}
                  >
                    <img
                      src={img.url}
                      alt=""
                      className="aspect-square h-full w-full object-contain"
                    />
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Basic */}
          <section className={SECTION[theme]}>
            <h2
              className={`font-heading text-lg tracking-tight ${TITLE[theme]}`}
            >
              {t("detailBasic")}
            </h2>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <Row
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
              <Row
                label={t("labelAge")}
                value={age != null ? t("ageUnit", { age }) : t("noValue")}
                title={TITLE[theme]}
                subtle={SUBTLE[theme]}
              />
              <Row
                label={t("labelDob")}
                value={dobStr ?? t("noValue")}
                title={TITLE[theme]}
                subtle={SUBTLE[theme]}
              />
              <Row
                label={t("labelPhone")}
                value={u.phone ?? t("noValue")}
                title={TITLE[theme]}
                subtle={SUBTLE[theme]}
              />
              <Row
                label={t("labelEmail")}
                value={u.email ?? t("noValue")}
                title={TITLE[theme]}
                subtle={SUBTLE[theme]}
              />
              <Row
                label={t("labelEmergency")}
                value={u.emergencyContactPhone ?? t("noValue")}
                title={TITLE[theme]}
                subtle={SUBTLE[theme]}
              />
            </dl>
          </section>

          {/* Specialties + Schedule */}
          <section className={SECTION[theme]}>
            <h2
              className={`font-heading text-lg tracking-tight ${TITLE[theme]}`}
            >
              {t("detailRoleSpec")}
            </h2>
            <p className={`mt-2 text-sm ${TITLE[theme]}`}>
              {allSpecs || t("noValue")}
            </p>

            <h3
              className={`mt-6 text-[10px] font-semibold uppercase tracking-[0.22em] ${SUBTLE[theme]}`}
            >
              {t("detailSchedule")}
            </h3>
            <div className="mt-2 inline-flex gap-1">
              {ALL_WEEKDAYS.map((w) => {
                const isOff = offSet.has(w);
                return (
                  <span
                    key={w}
                    className={`flex h-9 w-9 items-center justify-center rounded-md text-xs font-bold ${
                      isOff ? WEEKDAY_OFF[theme] : WEEKDAY_ON[theme]
                    }`}
                  >
                    {t(`weekday.${w}`)}
                  </span>
                );
              })}
            </div>
          </section>

          {/* Bio + Career */}
          <section className={SECTION[theme]}>
            <h2
              className={`font-heading text-lg tracking-tight ${TITLE[theme]}`}
            >
              {t("detailBio")}
            </h2>
            <p
              className={`mt-3 whitespace-pre-wrap text-sm leading-relaxed ${TITLE[theme]}`}
            >
              {staff.bio || t("noValue")}
            </p>
            <h3
              className={`mt-6 text-[10px] font-semibold uppercase tracking-[0.22em] ${SUBTLE[theme]}`}
            >
              {t("detailCareer")}
            </h3>
            <p
              className={`mt-2 whitespace-pre-wrap text-sm leading-relaxed ${TITLE[theme]}`}
            >
              {staff.career || t("noValue")}
            </p>
          </section>

          {/* Memo */}
          <section className={SECTION[theme]}>
            <h2
              className={`font-heading text-lg tracking-tight ${TITLE[theme]}`}
            >
              {t("detailMemo")}
            </h2>
            <p
              className={`mt-3 whitespace-pre-wrap text-sm leading-relaxed ${TITLE[theme]}`}
            >
              {u.note || t("noValue")}
            </p>
          </section>

          {/* Leaves */}
          <section className={SECTION[theme]}>
            <LeaveManager
              lang={lang}
              slug={slug}
              staffId={staff.id}
              tone={theme}
              leaves={staff.leaves.map((l) => ({
                id: l.id,
                startDate: l.startDate.toISOString().slice(0, 10),
                endDate: l.endDate.toISOString().slice(0, 10),
                reason: l.reason,
              }))}
            />
          </section>
        </div>
      </main>
    </div>
  );
}

function Row({
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
