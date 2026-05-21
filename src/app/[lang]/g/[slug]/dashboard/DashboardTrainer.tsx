import Link from "next/link";
import QRCode from "qrcode";
import { getTranslations } from "next-intl/server";
import { logout } from "@/lib/auth/actions";
import { loadTrainerCalendar } from "@/lib/calendar/trainerCalendarPro";
import { TrainerCalendarPro } from "@/components/calendar/TrainerCalendarPro";
import { TrainerQrButton } from "./TrainerQrButton";

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
  timeZone: string;
  selectedDay: number;
  weeklyOffDays: Weekday[];
};

// V8 Sunset Gradient 적용 — purple → sunset orange 라디얼 backdrop +
// 그라데 ring 카드 + 액션 4개 중 발급만 솔리드 그라데.
export async function DashboardTrainer({
  lang,
  slug,
  gymId,
  staffId,
  businessName,
  trainerName,
  accessToken,
  timeZone,
}: Props) {
  const t = await getTranslations("dashboard");
  const tn = await getTranslations("nav");

  const calendar = await loadTrainerCalendar(
    gymId,
    staffId,
    trainerName,
    timeZone,
  );

  const qrDataUrl = await QRCode.toDataURL(accessToken, {
    width: 320,
    margin: 1,
    color: { dark: "#0a0a0a", light: "#ffffff" },
  });

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-x-0 -top-20 h-[40rem] bg-gradient-to-b from-purple-700/30 via-pink-500/15 to-transparent" />
      <div className="pointer-events-none absolute -right-40 top-1/4 h-[28rem] w-[28rem] rounded-full bg-orange-500/25 blur-3xl" />
      <div className="pointer-events-none absolute -left-32 bottom-0 h-[26rem] w-[26rem] rounded-full bg-fuchsia-600/20 blur-3xl" />

      <header className="relative flex items-center justify-between border-b border-white/5 px-5 py-4">
        <div>
          {/* 1줄: 매장명·역할은 기존 그라데, 트레이너명은 흰색 — 색은 유지하고
              2줄→1줄이 된 만큼 크기만 키움. */}
          <h1 className="font-heading text-xl tracking-tight">
            <span className="mr-3 bg-gradient-to-r from-orange-300 to-pink-300 bg-clip-text text-transparent">
              {businessName}
            </span>
            <span className="text-white">{trainerName}</span>{" "}
            <span className="bg-gradient-to-r from-orange-300 to-pink-300 bg-clip-text text-transparent">
              {t("trainerRole")}
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <TrainerQrButton
            qrDataUrl={qrDataUrl}
            trainerName={trainerName}
          />
          <Link
            href={`/${lang}/g/${slug}/showcase`}
            className="rounded-full bg-gradient-to-r from-orange-500/20 to-pink-500/20 px-3 py-1.5 text-xs font-semibold text-orange-100 ring-1 ring-orange-400/40 transition hover:from-orange-500/30 hover:to-pink-500/30"
          >
            {t("trainerShowcaseBtn")}
          </Link>
          <Link
            href={`/${lang}/g/${slug}/intake`}
            className="rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-3 py-1.5 text-xs font-bold text-white shadow-[0_4px_18px_-6px_rgba(251,146,60,0.6)] transition hover:brightness-110"
          >
            {t("trainerIntakeBtn")}
          </Link>
          <Link
            href={`/${lang}/g/${slug}/performance`}
            className="rounded-full bg-gradient-to-r from-pink-500/20 to-purple-500/20 px-3 py-1.5 text-xs font-semibold text-pink-100 ring-1 ring-pink-400/40 transition hover:from-pink-500/30 hover:to-purple-500/30"
          >
            {t("trainerPerfBtn")}
          </Link>
          <form action={logout.bind(null, `/${lang}/g/${slug}/login`)}>
            <button className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-zinc-400 ring-1 ring-white/10 transition hover:text-white">
              {tn("logout")}
            </button>
          </form>
        </div>
      </header>

      <main className="relative flex-1 space-y-4 p-4">
        {/* 출입 QR 은 헤더의 TrainerQrButton(핸드폰 전용 버튼 → 모달)로 이동.
            태블릿 관리 화면엔 노출하지 않는다. */}
        <TrainerCalendarPro data={calendar} slug={slug} lang={lang} />
      </main>

      <footer className="relative border-t border-white/5 px-5 py-4 text-center text-[11px] text-zinc-500">
        예약가즈아 · /g/{slug}
      </footer>
    </div>
  );
}
