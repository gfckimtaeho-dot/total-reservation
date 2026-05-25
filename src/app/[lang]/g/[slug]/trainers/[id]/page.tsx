import Link from "next/link";
import { notFound } from "next/navigation";
import { differenceInYears } from "date-fns";
import QRCode from "qrcode";
import { getTranslations } from "next-intl/server";
import { logout } from "@/lib/auth/actions";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { ensureAccessToken } from "@/lib/auth/accessToken";
import { SidebarNav } from "../../dashboard/SidebarNav";
import { RegenerateQrButton } from "./RegenerateQrButton";
import { LeaveManager } from "./LeaveManager";

const TK = {
  section: "rounded-2xl bg-white ring-1 ring-violet-100 p-6",
  title: "text-ink",
  subtle: "text-zinc-600",
  pillTrainer: "bg-violet-100 text-violet-800",
  pillManager: "bg-amber-100 text-amber-800",
  weekdayOn: "bg-violet-600 text-white",
  weekdayOff: "bg-zinc-200 text-zinc-500",
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
          locale: true,
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
    <div className="flex min-h-screen bg-violet-50/40">
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
            <h1 className={`font-heading text-xl tracking-tight ${TK.title}`}>
              {u.name}{" "}
              <span
                className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium align-middle ${
                  staff.role === "MANAGER" ? TK.pillManager : TK.pillTrainer
                }`}
              >
                {t(staff.role === "MANAGER" ? "roleManager" : "roleTrainer")}
              </span>
            </h1>
          </div>
          <Link
            href={`/${lang}/g/${slug}/trainers`}
            className="text-sm transition text-zinc-600 hover:text-ink"
          >
            {t("detailBack")}
          </Link>
        </header>

        <div className="mx-auto w-full max-w-5xl space-y-5 p-6">
          {/* Access QR */}
          <section className={TK.section}>
            <h2 className={`font-heading text-lg tracking-tight ${TK.title}`}>
              {t("detailQr")}
            </h2>
            <p className={`mt-1 text-xs ${TK.subtle}`}>{t("detailQrHint")}</p>
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
                <code className="break-all rounded-md px-2 py-1.5 font-mono text-[11px] bg-zinc-50 text-zinc-600">
                  {accessToken}
                </code>
                <RegenerateQrButton
                  slug={slug}
                  staffId={staff.id}
                  tone="white"
                />
              </div>
            </div>
          </section>

          {/* Photos */}
          <section className={TK.section}>
            <h2 className={`font-heading text-lg tracking-tight ${TK.title}`}>
              {t("detailPhotos")}
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-5">
              {staff.images.length === 0 ? (
                <div className={`text-sm ${TK.subtle}`}>{t("noValue")}</div>
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
          <section className={TK.section}>
            <h2 className={`font-heading text-lg tracking-tight ${TK.title}`}>
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
              />
              <Row
                label={t("labelAge")}
                value={age != null ? t("ageUnit", { age }) : t("noValue")}
              />
              <Row label={t("labelDob")} value={dobStr ?? t("noValue")} />
              <Row label={t("labelPhone")} value={u.phone ?? t("noValue")} />
              <Row label={t("labelEmail")} value={u.email ?? t("noValue")} />
              <Row
                label={t("labelEmergency")}
                value={u.emergencyContactPhone ?? t("noValue")}
              />
              <Row
                label={t("labelLanguage")}
                value={
                  u.locale === "en" ? t("langEnglish") : t("langKorean")
                }
              />
              <Row
                label={t("detailSalary")}
                value={`₱${staff.monthlyBaseSalaryPhp.toLocaleString()}`}
              />
            </dl>
          </section>

          {/* Specialties + Schedule */}
          <section className={TK.section}>
            <h2 className={`font-heading text-lg tracking-tight ${TK.title}`}>
              {t("detailRoleSpec")}
            </h2>
            <p className={`mt-2 text-sm ${TK.title}`}>
              {allSpecs || t("noValue")}
            </p>

            <h3
              className={`mt-6 text-[10px] font-semibold uppercase tracking-[0.22em] ${TK.subtle}`}
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
                      isOff ? TK.weekdayOff : TK.weekdayOn
                    }`}
                  >
                    {t(`weekday.${w}`)}
                  </span>
                );
              })}
            </div>

            <h3
              className={`mt-6 text-[10px] font-semibold uppercase tracking-[0.22em] ${TK.subtle}`}
            >
              {t("detailWorkTime")}
            </h3>
            <p className={`mt-1 text-sm tabular-nums ${TK.title}`}>
              {((m: number | null) =>
                m == null
                  ? "—"
                  : `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(
                      m % 60,
                    ).padStart(2, "0")}`)(staff.workStartMin)}
              {" ~ "}
              {((m: number | null) =>
                m == null
                  ? "—"
                  : `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(
                      m % 60,
                    ).padStart(2, "0")}`)(staff.workEndMin)}
            </p>

            <h3
              className={`mt-6 text-[10px] font-semibold uppercase tracking-[0.22em] ${TK.subtle}`}
            >
              {t("detailBreakTime")}
            </h3>
            <p className={`mt-1 text-sm tabular-nums ${TK.title}`}>
              {staff.breakStartMin != null && staff.breakEndMin != null
                ? `${String(Math.floor(staff.breakStartMin / 60)).padStart(
                    2,
                    "0",
                  )}:${String(staff.breakStartMin % 60).padStart(2, "0")} ~ ${String(
                    Math.floor(staff.breakEndMin / 60),
                  ).padStart(2, "0")}:${String(staff.breakEndMin % 60).padStart(
                    2,
                    "0",
                  )}`
                : t("detailBreakNone")}
            </p>
          </section>

          {/* Bio + Career */}
          <section className={TK.section}>
            <h2 className={`font-heading text-lg tracking-tight ${TK.title}`}>
              {t("detailBio")}
            </h2>
            <p className={`mt-3 whitespace-pre-wrap text-sm leading-relaxed ${TK.title}`}>
              {staff.bio || t("noValue")}
            </p>
            <h3
              className={`mt-6 text-[10px] font-semibold uppercase tracking-[0.22em] ${TK.subtle}`}
            >
              {t("detailCareer")}
            </h3>
            <p className={`mt-2 whitespace-pre-wrap text-sm leading-relaxed ${TK.title}`}>
              {staff.career || t("noValue")}
            </p>
          </section>

          {/* Memo */}
          <section className={TK.section}>
            <h2 className={`font-heading text-lg tracking-tight ${TK.title}`}>
              {t("detailMemo")}
            </h2>
            <p className={`mt-3 whitespace-pre-wrap text-sm leading-relaxed ${TK.title}`}>
              {u.note || t("noValue")}
            </p>
          </section>

          {/* Leaves */}
          <section className={TK.section}>
            <LeaveManager
              lang={lang}
              slug={slug}
              staffId={staff.id}
              tone="white"
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt
        className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${TK.subtle}`}
      >
        {label}
      </dt>
      <dd className={`mt-0.5 ${TK.title}`}>{value}</dd>
    </div>
  );
}
