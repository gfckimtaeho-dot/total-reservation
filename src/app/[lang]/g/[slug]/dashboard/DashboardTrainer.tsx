import Link from "next/link";
import QRCode from "qrcode";
import { getTranslations } from "next-intl/server";
import { logout } from "@/lib/auth/actions";
import {
  formatManilaMonthLabel,
  getManilaMonthInfo,
} from "../../../preview/_mock";
import { TrainerCalendarSchedule } from "./TrainerCalendarSchedule";
import { HoursStatusCard } from "./HoursStatusCard";
import { MyCheckInCard } from "./MyCheckInCard";

type Weekday = "SUN" | "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";

type Props = {
  lang: string;
  slug: string;
  gymId: string;
  userId: string;
  staffId: string | null;
  businessName: string;
  trainerName: string;
  accessToken: string;
  selectedDay: number;
  weeklyOffDays: Weekday[];
};

export async function DashboardTrainer({
  lang,
  slug,
  gymId,
  userId,
  staffId,
  businessName,
  trainerName,
  accessToken,
  selectedDay,
  weeklyOffDays,
}: Props) {
  const t = await getTranslations("dashboard");
  const tn = await getTranslations("nav");
  const today = new Date();
  const todayDisplay = new Intl.DateTimeFormat(
    lang === "en" ? "en-US" : "ko-KR",
    {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    },
  ).format(today);
  const monthLabel = formatManilaMonthLabel(today, lang);
  const monthInfo = getManilaMonthInfo(today);
  const safeSelectedDay =
    selectedDay >= 1 && selectedDay <= monthInfo.daysInMonth
      ? selectedDay
      : monthInfo.todayDay;

  const qrDataUrl = await QRCode.toDataURL(accessToken, {
    width: 320,
    margin: 1,
    color: { dark: "#0a0a0a", light: "#ffffff" },
  });

  return (
    <div className="flex min-h-screen flex-col bg-black text-zinc-100">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <h1 className="font-heading text-lg tracking-tight text-white">
            {trainerName}
          </h1>
          <div className="mt-0.5 text-[11px] text-amber-300/70">
            {businessName} · {todayDisplay}
          </div>
        </div>
        <form action={logout.bind(null, `/${lang}/g/${slug}/login`)}>
          <button className="rounded-md border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-amber-400 hover:text-amber-300">
            {tn("logout")}
          </button>
        </form>
      </header>

      <main className="flex-1 space-y-4 p-4">
        {/* QR — 핸드폰만 */}
        <section className="flex flex-col items-center rounded-2xl border border-amber-400/25 bg-black p-5 md:hidden">
          <h2 className="font-heading text-base tracking-tight text-white">
            {t("trainerQrTitle")}
          </h2>
          <div className="mt-3 rounded-xl bg-white p-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="Access QR"
              className="block h-36 w-36"
            />
          </div>
          <p className="mt-3 whitespace-pre-line text-center text-[11px] leading-relaxed text-zinc-400">
            {t("trainerQrHint")}
          </p>
        </section>

        <MyCheckInCard gymId={gymId} userId={userId} staffId={staffId} />

        <HoursStatusCard
          gymId={gymId}
          lang={lang}
          slug={slug}
          tone="trainer"
          canEdit={false}
        />

        <TrainerCalendarSchedule
          lang={lang}
          trainerName={trainerName}
          weeklyOffDays={weeklyOffDays}
          monthLabel={monthLabel}
          monthInfo={monthInfo}
          initialSelectedDay={safeSelectedDay}
        />
      </main>

      <footer className="border-t border-white/10 px-5 py-4 text-center text-[11px] text-zinc-500">
        예약가즈아 · /g/{slug} ·{" "}
        <Link
          href={`/${lang}/g/${slug}/me`}
          className="underline-offset-2 hover:text-amber-300 hover:underline"
        >
          {t("trainerProfileLink")}
        </Link>
      </footer>
    </div>
  );
}
