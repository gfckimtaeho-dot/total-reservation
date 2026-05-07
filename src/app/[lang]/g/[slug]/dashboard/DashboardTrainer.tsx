import Link from "next/link";
import QRCode from "qrcode";
import { getTranslations } from "next-intl/server";
import { logout } from "@/lib/auth/actions";
import {
  formatManilaMonthLabel,
  getManilaMonthInfo,
} from "../../../preview/_mock";
import { TrainerCalendarSchedule } from "./TrainerCalendarSchedule";

type Weekday = "SUN" | "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";

type Props = {
  lang: string;
  slug: string;
  businessName: string;
  trainerName: string;
  accessToken: string;
  selectedDay: number;
  weeklyOffDays: Weekday[];
};

export async function DashboardTrainer({
  lang,
  slug,
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

  // 출입 QR — accessToken이 바뀌지 않는 한 매 페이지 진입마다 동일.
  // 추후 캐싱(react cache) 가능하지만 client navigation을 안 쓰므로 충분.
  const qrDataUrl = await QRCode.toDataURL(accessToken, {
    width: 320,
    margin: 1,
    color: { dark: "#0a0a0a", light: "#ffffff" },
  });

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-200">
      <header className="flex items-center justify-between border-b border-white/5 px-5 py-4">
        <div>
          <h1 className="font-heading text-lg tracking-tight text-white">
            {trainerName}
          </h1>
          <div className="mt-0.5 text-[11px] text-zinc-500">
            {businessName} · {todayDisplay}
          </div>
        </div>
        <form action={logout.bind(null, `/${lang}/g/${slug}/login`)}>
          <button className="rounded-md border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-lime-300 hover:text-lime-300">
            {tn("logout")}
          </button>
        </form>
      </header>

      <main className="flex-1 space-y-4 p-4">
        {/* QR — 핸드폰만 (md 이상은 섹션 자체 숨김) */}
        <section className="flex flex-col items-center rounded-2xl border border-white/10 bg-zinc-900 p-5 md:hidden">
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
          <p className="mt-3 whitespace-pre-line text-center text-[11px] leading-relaxed text-zinc-500">
            {t("trainerQrHint")}
          </p>
        </section>

        {/* 일정 + 캘린더 — 클라이언트 상태로 즉시 반응 */}
        <TrainerCalendarSchedule
          lang={lang}
          trainerName={trainerName}
          weeklyOffDays={weeklyOffDays}
          monthLabel={monthLabel}
          monthInfo={monthInfo}
          initialSelectedDay={safeSelectedDay}
        />
      </main>

      <footer className="border-t border-white/5 px-5 py-4 text-center text-[11px] text-zinc-500">
        예약가즈아 · /g/{slug} ·{" "}
        <Link
          href={`/${lang}/g/${slug}/me`}
          className="underline-offset-2 hover:text-lime-300 hover:underline"
        >
          {t("trainerProfileLink")}
        </Link>
      </footer>
    </div>
  );
}
