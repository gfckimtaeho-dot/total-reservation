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
  type MockReservation,
} from "../../../preview/_mock";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const WEEKDAY_BY_INDEX = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
] as const;

type Weekday = (typeof WEEKDAY_BY_INDEX)[number];

type Props = {
  lang: string;
  slug: string;
  businessName: string;
  trainerName: string;
  accessToken: string;
  selectedDay: number;
  weeklyOffDays: Weekday[];
};

// 비-오늘 날짜에 단체수업이 있을 때 합성. 실제 schema 연동 전 데모용.
function synthesizeReservations(
  day: number,
  trainerName: string,
  translateClass: (key: string) => string,
): MockReservation[] {
  const keys = MOCK_GROUP_CLASSES_BY_DAY[day] ?? [];
  return keys.map((key, i) => ({
    id: `${day}-${key}-${i}`,
    startMin: (10 + i * 2) * 60,
    endMin: (11 + i * 2) * 60,
    customer: translateClass(key),
    staff: trainerName,
    service: translateClass(key),
    serviceType: "GROUP",
    capacity: 12,
    enrolled: 6 + (day % 5),
    status: "CONFIRMED",
  }));
}

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
  const safeSelectedDay =
    selectedDay >= 1 && selectedDay <= monthInfo.daysInMonth
      ? selectedDay
      : monthInfo.todayDay;

  const offSet = new Set(weeklyOffDays);
  function weekdayOf(day: number): Weekday {
    const idx = (monthInfo.firstWeekday + (day - 1)) % 7;
    return WEEKDAY_BY_INDEX[idx];
  }
  function isTrainerOff(day: number): boolean {
    return MOCK_CLOSED_DAYS.has(day) || offSet.has(weekdayOf(day));
  }

  // 휴무일 클릭 시에도 reservations는 계산하지만 보통 비어있음.
  const reservations: MockReservation[] = isTrainerOff(safeSelectedDay)
    ? []
    : safeSelectedDay === monthInfo.todayDay
      ? MOCK_RESERVATIONS_TODAY.filter((r) => r.staff === trainerName)
      : synthesizeReservations(safeSelectedDay, trainerName, (key) =>
          t(`sampleGroupClass.${key}`),
        );
  const buckets = groupByHour(reservations);

  // 선택일 라벨 (날짜 + 요일)
  const selectedDate = new Date(
    Date.UTC(monthInfo.year, monthInfo.month - 1, safeSelectedDay, 4, 0, 0),
  );
  const selectedDateLabel = new Intl.DateTimeFormat(
    lang === "en" ? "en-US" : "ko-KR",
    {
      timeZone: "Asia/Manila",
      month: "long",
      day: "numeric",
      weekday: "short",
    },
  ).format(selectedDate);

  // 출입 QR
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
          <div className="mt-3 rounded-xl bg-white p-3">
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

        {/* 일정 — 제목+카운트 한 줄에 합쳐서 (KPI 별도 섹션 제거) */}
        <section className="rounded-2xl border border-white/10 bg-zinc-900 p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-heading text-base tracking-tight text-white">
              {safeSelectedDay === monthInfo.todayDay
                ? t("timelineTitle")
                : t("timelineTitleForDate", { date: selectedDateLabel })}
            </h2>
            <span className="shrink-0 rounded-full bg-lime-300/15 px-2.5 py-0.5 text-xs font-medium tabular-nums text-lime-300 ring-1 ring-lime-300/40">
              {t("trainerScheduleCount", { count: reservations.length })}
            </span>
          </div>
          {buckets.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">
              {isTrainerOff(safeSelectedDay)
                ? t("trainerOffDay")
                : t("trainerNoBookings")}
            </p>
          ) : (
            <ol className="mt-5 divide-y divide-white/10">
              {buckets.map((b) => (
                <li
                  key={b.startMin}
                  className="grid grid-cols-[56px_1fr] gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="pt-2 text-sm font-medium tabular-nums text-zinc-400">
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
                              : "bg-zinc-800 ring-white/10"
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

        {/* 월별 캘린더 — 일자 클릭 시 selectedDay 변경 */}
        <section className="rounded-2xl border border-white/10 bg-zinc-900 p-5">
          <h2 className="font-heading text-base tracking-tight text-white">
            {t("calendarTitle", { month: monthLabel })}
          </h2>
          <p className="mt-1 text-[11px] text-zinc-500">
            {t("trainerCalendarHint")}
          </p>
          <div className="mt-4 grid grid-cols-7 gap-1 text-center">
            {weekdays.map((w) => (
              <span
                key={w}
                className="border-b border-white/10 pb-2 text-[10px] font-medium text-zinc-400"
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
              const isToday = day === monthInfo.todayDay;
              const isSelected = day === safeSelectedDay;
              const off = isTrainerOff(day);
              const classes = MOCK_GROUP_CLASSES_BY_DAY[day] ?? [];

              const baseCell =
                "relative block min-h-[60px] rounded-md p-1.5 text-left transition";

              if (off) {
                // 게이트 휴관 + 트레이너 정기 휴무 + (향후) 개인 휴무 모두 동일 회색
                return (
                  <Link
                    key={day}
                    href={`/${lang}/g/${slug}/dashboard?day=${day}`}
                    className={`${baseCell} bg-zinc-700/70 hover:bg-zinc-600 ${
                      isSelected ? "ring-2 ring-lime-300" : ""
                    }`}
                  >
                    <div className="text-[10px] font-medium text-zinc-300">
                      {day}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center text-[9px] font-medium text-zinc-300">
                      {t("closed")}
                    </div>
                  </Link>
                );
              }

              const ring = isSelected
                ? "ring-2 ring-lime-300"
                : isToday
                  ? "ring-1 ring-lime-300/40"
                  : "border border-white/10";
              const bg = isSelected ? "bg-zinc-800" : "bg-zinc-800/60";

              return (
                <Link
                  key={day}
                  href={`/${lang}/g/${slug}/dashboard?day=${day}`}
                  className={`${baseCell} ${bg} ${ring} hover:bg-zinc-700`}
                >
                  <div
                    className={`text-[11px] font-semibold ${
                      isToday ? "text-lime-300" : "text-zinc-100"
                    }`}
                  >
                    {day}
                  </div>
                  {classes.length > 0 && (
                    <ul className="mt-0.5 space-y-0.5">
                      {classes.map((key) => (
                        <li
                          key={key}
                          className="truncate rounded bg-lime-300/15 px-1 py-0.5 text-[9px] font-medium text-lime-300 ring-1 ring-lime-300/40"
                        >
                          {t(`sampleGroupClass.${key}`)}
                        </li>
                      ))}
                    </ul>
                  )}
                </Link>
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
