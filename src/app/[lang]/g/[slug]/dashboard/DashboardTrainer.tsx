import Link from "next/link";
import QRCode from "qrcode";
import { getTranslations } from "next-intl/server";
import { logout } from "@/lib/auth/actions";
import {
  MOCK_CLOSED_DAYS,
  MOCK_GROUP_CLASSES_BY_DAY,
  MOCK_RESERVATIONS_TODAY,
  fmtTime,
  formatManilaMonthLabel,
  getManilaMonthInfo,
  groupByHour,
} from "../../../preview/_mock";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type Props = {
  lang: string;
  slug: string;
  businessName: string;
  trainerName: string;
  accessToken: string;
};

export async function DashboardTrainer({
  lang,
  slug,
  businessName,
  trainerName,
  accessToken,
}: Props) {
  const t = await getTranslations("dashboard");
  const tn = await getTranslations("nav");
  // 모바일 우선 — 본인이 staff인 reservation만 필터.
  // schema 연결 전이라 mock의 staff 이름이 매칭하지 않으면 빈 배열.
  const myReservations = MOCK_RESERVATIONS_TODAY.filter(
    (r) => r.staff === trainerName,
  );
  const buckets = groupByHour(myReservations);
  const weekdays = lang === "en" ? WEEKDAYS_EN : WEEKDAYS;
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

  // 출입 QR — 영구 토큰을 그대로 인코딩. 단말 스캐너가 이 값을 verify.
  const qrDataUrl = await QRCode.toDataURL(accessToken, {
    width: 320,
    margin: 1,
    color: { dark: "#0a0a0a", light: "#ffffff" },
  });

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-200">
      <header className="flex items-center justify-between border-b border-white/5 px-5 py-4">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-lime-300/80">
            {tn("dashboard")}
          </span>
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
        {/* QR — 항시 노출, 1탭 출입 */}
        <section className="flex flex-col items-center rounded-2xl border border-white/5 bg-zinc-900 p-5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-lime-300/80">
            {t("trainerQrEyebrow")}
          </span>
          <h2 className="mt-1 font-heading text-base tracking-tight text-white">
            {t("trainerQrTitle")}
          </h2>
          <div className="mt-4 rounded-xl bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="Access QR"
              className="block h-56 w-56"
            />
          </div>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-zinc-500">
            {t("trainerQrHint")}
          </p>
        </section>

        {/* KPI — 오늘 본인 예약 */}
        <section className="rounded-2xl border border-white/5 bg-zinc-900 p-5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-lime-300/80">
              {t("trainerTodayBookingsLabel")}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-heading text-4xl tabular-nums tracking-tight text-white">
              {myReservations.length}
            </span>
            <span className="text-sm text-zinc-500">{t("unitCount")}</span>
          </div>
        </section>

        {/* 오늘의 일정 — 본인 PT/그룹 수업만 */}
        <section className="rounded-2xl border border-white/5 bg-zinc-900 p-5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-lime-300/80">
            {t("timelineEyebrow")}
          </span>
          <h2 className="mt-1 font-heading text-base tracking-tight text-white">
            {t("timelineTitle")}
          </h2>
          {buckets.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">
              {t("trainerNoBookings")}
            </p>
          ) : (
            <ol className="mt-5 space-y-3">
              {buckets.map((b) => (
                <li
                  key={b.startMin}
                  className="grid grid-cols-[56px_1fr] gap-3"
                >
                  <div className="pt-2 text-sm font-medium tabular-nums text-zinc-500">
                    {fmtTime(b.startMin)}
                  </div>
                  <div className="grid gap-2">
                    {b.items.map((r) => {
                      const isGroup = r.serviceType === "GROUP";
                      return (
                        <div
                          key={r.id}
                          className={`rounded-xl p-3 ring-1 ${
                            isGroup
                              ? "bg-zinc-800 ring-lime-300/40"
                              : "bg-zinc-800 ring-white/5"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-white">
                              {r.customer}
                            </span>
                            {isGroup && (
                              <span className="rounded-full bg-lime-300 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-950">
                                {t("groupBadge", {
                                  enrolled: r.enrolled ?? 0,
                                  capacity: r.capacity ?? 0,
                                })}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-zinc-400">
                            {r.service}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* 월별 — 본인 단체수업/PT만 (현재 mock에 staff 매핑 없어 샘플) */}
        <section className="rounded-2xl border border-white/5 bg-zinc-900 p-5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-lime-300/80">
            {t("calendarEyebrow")}
          </span>
          <h2 className="mt-1 font-heading text-base tracking-tight text-white">
            {t("calendarTitle", { month: monthLabel })}
          </h2>
          <div className="mt-4 grid grid-cols-7 gap-1 text-center">
            {weekdays.map((w) => (
              <span
                key={w}
                className="pb-1 text-[10px] font-medium text-zinc-500"
              >
                {w}
              </span>
            ))}
            {Array.from({ length: monthInfo.firstWeekday }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {Array.from(
              { length: monthInfo.daysInMonth },
              (_, i) => i + 1,
            ).map((day) => {
              if (MOCK_CLOSED_DAYS.has(day)) {
                return (
                  <div
                    key={day}
                    className="relative min-h-[56px] rounded-md bg-zinc-700 p-1.5 text-left"
                  >
                    <div className="text-[10px] font-medium text-zinc-400">
                      {day}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center text-[9px] font-medium text-zinc-400">
                      {t("closed")}
                    </div>
                  </div>
                );
              }
              const classes = MOCK_GROUP_CLASSES_BY_DAY[day] ?? [];
              const isToday = day === monthInfo.todayDay;
              return (
                <div
                  key={day}
                  className={`min-h-[56px] rounded-md border border-white/5 bg-zinc-900 p-1.5 text-left ${
                    isToday ? "ring-2 ring-lime-300" : ""
                  }`}
                >
                  <div className="text-[10px] font-medium text-zinc-200">
                    {day}
                  </div>
                  {classes.length > 0 && (
                    <ul className="mt-0.5 space-y-0.5">
                      {classes.map((key) => (
                        <li
                          key={key}
                          className="truncate rounded bg-lime-300/10 px-1 py-0.5 text-[9px] font-medium text-lime-300 ring-1 ring-lime-300/30"
                        >
                          {t(`sampleGroupClass.${key}`)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </section>
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
