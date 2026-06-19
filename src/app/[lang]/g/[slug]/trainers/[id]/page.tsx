import Link from "next/link";
import { notFound } from "next/navigation";
import { differenceInYears } from "date-fns";
import QRCode from "qrcode";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { ensureAccessToken } from "@/lib/auth/accessToken";
import { PasswordResetButton } from "@/components/PasswordResetButton";
import { copyTrainerPasswordResetUrl } from "../actions";
import { OwnerShell } from "../../OwnerShell";
import { RegenerateQrButton } from "./RegenerateQrButton";
import { LeaveManager } from "./LeaveManager";

const TK = {
  section: "rounded-2xl border border-zinc-200 bg-white p-6",
  title: "text-zinc-900",
  subtle: "text-zinc-500",
  pillTrainer: "bg-indigo-100 text-indigo-800",
  pillManager: "bg-amber-100 text-amber-800",
  weekdayOn: "bg-indigo-600 text-white",
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
  const tc = await getTranslations("trainerCal");

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
    <OwnerShell
      lang={lang}
      slug={slug}
      businessName={business.name}
      subtitle={
        <span className="inline-flex items-center gap-2">
          <span className="font-semibold text-zinc-900">{u.name}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              staff.role === "MANAGER" ? TK.pillManager : TK.pillTrainer
            }`}
          >
            {t(staff.role === "MANAGER" ? "roleManager" : "roleTrainer")}
          </span>
        </span>
      }
      action={
        <>
          {u.status === "ACTIVE" && (
            <PasswordResetButton
              slug={slug}
              id={staff.id}
              idField="staffId"
              action={copyTrainerPasswordResetUrl}
              label={tc("passwordResetBtn")}
              copyLabel={tc("passwordResetCopy")}
              copiedLabel={tc("passwordResetCopied")}
              hint={tc("passwordResetHint")}
              sentLabel={tc("passwordResetSent")}
            />
          )}
          <Link
            href={`/${lang}/g/${slug}/trainers`}
            className="inline-flex items-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50"
          >
            {t("detailBack")}
          </Link>
        </>
      }
    >
        <div className="mx-auto w-full max-w-5xl space-y-5 p-6">
          {/* Access QR */}
          <section className={TK.section}>
            <h2 className={`text-lg font-semibold tracking-tight ${TK.title}`}>
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
                  tone="indigo"
                />
              </div>
            </div>
          </section>

          {/* Photos */}
          <section className={TK.section}>
            <h2 className={`text-lg font-semibold tracking-tight ${TK.title}`}>
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
            <h2 className={`text-lg font-semibold tracking-tight ${TK.title}`}>
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
            <h2 className={`text-lg font-semibold tracking-tight ${TK.title}`}>
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
            <h2 className={`text-lg font-semibold tracking-tight ${TK.title}`}>
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
            <h2 className={`text-lg font-semibold tracking-tight ${TK.title}`}>
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
              tone="indigo"
              leaves={staff.leaves.map((l) => ({
                id: l.id,
                startDate: l.startDate.toISOString().slice(0, 10),
                endDate: l.endDate.toISOString().slice(0, 10),
                reason: l.reason,
              }))}
            />
          </section>
        </div>
    </OwnerShell>
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
