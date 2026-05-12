import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { logout } from "@/lib/auth/actions";
import {
  MOCK_ACCESS_LOG,
  MOCK_CLOSED_DAYS,
  MOCK_GROUP_CLASSES_BY_DAY,
  MOCK_KPI,
  MOCK_RESERVATIONS_TODAY,
  fmtTime,
  formatManilaMonthLabel,
  getManilaMonthInfo,
  groupByHour,
} from "../../../preview/_mock";
import { SidebarNav } from "./SidebarNav";
import { getKpiExtras, fmtHoursRange, fmtCheckIn } from "./kpi-data";
import type { ReactNode } from "react";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type Props = {
  lang: string;
  slug: string;
  gymId: string;
  businessName: string;
};

export async function DashboardNormal({ lang, slug, gymId, businessName }: Props) {
  const t = await getTranslations("dashboard");
  const tn = await getTranslations("nav");
  const tc = await getTranslations("checkin");
  const th = await getTranslations("hours");
  const kpi = await getKpiExtras(gymId);
  const buckets = groupByHour(MOCK_RESERVATIONS_TODAY);
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

  return (
    <div className="flex min-h-screen bg-amber-50/50">
      <aside className="hidden w-60 shrink-0 flex-col bg-band lg:flex">
        <div className="border-b border-ink/10 px-6 py-6">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/70">
            {tn("studio")}
          </span>
          <div className="mt-1 font-heading text-lg tracking-tight text-ink">
            {businessName}
          </div>
          <div className="mt-0.5 text-xs text-ink/60">/g/{slug}</div>
        </div>
        <SidebarNav tone="normal" />
        <div className="border-t border-ink/10 px-3 py-4">
          <form action={logout.bind(null, `/${lang}/g/${slug}/login`)}>
            <button className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-ink/80 hover:bg-white/40">
              {tn("logout")}
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <header className="flex items-center justify-between border-b border-amber-200/60 px-8 py-5">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
              {t("eyebrow")}
            </span>
            <h1 className="font-heading text-xl tracking-tight text-ink">
              {todayDisplay}
            </h1>
          </div>
          <span className="rounded-full bg-amber-100/80 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-amber-900/70">
            {t("sampleData")}
          </span>
        </header>

        <div className="grid grid-cols-12 gap-4 p-6">
          <div className="col-span-12 grid grid-cols-2 gap-4 xl:col-span-5">
          <KpiCard
            label={t("kpiTodayBookings")}
            value={MOCK_KPI.todayBookings}
            sub={t("unitCount")}
            cellOnly
            extra={
              <div className="flex flex-col items-end gap-1 text-right text-xs">
                {kpi.hours.state === "OPEN" ? (
                  <>
                    <span
                      className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        kpi.hours.onBreak
                          ? "bg-amber-100 text-amber-800"
                          : kpi.hours.nowOpen
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {kpi.hours.onBreak
                        ? th("onBreakNow")
                        : kpi.hours.nowOpen
                          ? th("operatingNow")
                          : th("closedNow")}
                    </span>
                    <span className="font-mono tabular-nums text-zinc-600">
                      {fmtHoursRange(kpi.hours)}
                    </span>
                  </>
                ) : (
                  <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                    {th("closedToday")}
                  </span>
                )}
              </div>
            }
          />
          <KpiCard
            label={t("kpiActiveMembers")}
            value={`${MOCK_KPI.activeMembers}/${MOCK_KPI.totalCustomersEver}`}
            sub={t("unitPeople")}
            cellOnly
          />
          </div>
          <div className="col-span-12 xl:col-span-7">
          <KpiCard
            label={t("kpiTodayStaff")}
            value={kpi.staff.filter((s) => s.checkInMin != null).length}
            sub={`/${kpi.staff.length}${t("unitPeople")}`}
            cellOnly
            extra={
              kpi.staff.length === 0 ? null : (
                <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 lg:grid-cols-3">
                  {kpi.staff.slice(0, 9).map((s) => (
                    <li key={s.userId} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-ink">{s.name}</span>
                      {s.checkInMin != null ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <span className="font-mono tabular-nums text-zinc-700">
                            {fmtCheckIn(s.checkInMin)}
                          </span>
                          {s.lateMin != null && s.lateMin > 0 && (
                            <span className="rounded-full bg-rose-100 px-1 text-[9px] font-bold text-rose-700">
                              {tc("late", { min: s.lateMin })}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="shrink-0 text-[10px] text-zinc-400">{tc("notCheckedIn")}</span>
                      )}
                    </li>
                  ))}
                  {kpi.staff.length > 9 && (
                    <li className="col-span-2 text-[10px] text-zinc-500 lg:col-span-3">
                      +{kpi.staff.length - 9}
                    </li>
                  )}
                </ul>
              )
            }
          />
          </div>
          <input type="hidden" data-lang={lang} data-slug={slug} />

          <section className="col-span-12 rounded-2xl border border-amber-200/60 bg-white p-6 xl:col-span-5">
            <SectionHead
              title={t("timelineTitle")}
            />
            <ol className="mt-5 divide-y divide-amber-100">
              {buckets.map((b) => (
                <li
                  key={b.startMin}
                  className="grid grid-cols-[60px_1fr] gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="pt-2 text-sm font-medium tabular-nums text-ink/70 border-r border-amber-100 pr-3">
                    {fmtTime(b.startMin)}
                  </div>
                  <div
                    className={`grid gap-2 ${
                      b.items.length > 1 ? "grid-cols-2" : "grid-cols-1"
                    }`}
                  >
                    {b.items.map((r) => {
                      const isActive = r.status === "IN_PROGRESS";
                      const isPast = r.status === "COMPLETED";
                      const isGroup = r.serviceType === "GROUP";
                      return (
                        <div
                          key={r.id}
                          className={`relative rounded-xl border-l-4 p-3 ${
                            isActive
                              ? "border-l-ink bg-band"
                              : isPast
                                ? "border-l-amber-200 bg-amber-50/40 opacity-60"
                                : isGroup
                                  ? "border-l-emerald-500 bg-emerald-50/70"
                                  : "border border-amber-200/60 border-l-zinc-300 bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-ink">
                              {r.customer}
                            </span>
                            {isActive && (
                              <span className="rounded-full bg-ink px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white">
                                {t("live")}
                              </span>
                            )}
                            {isGroup && (
                              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white">
                                {t("groupBadge", {
                                  enrolled: r.enrolled ?? 0,
                                  capacity: r.capacity ?? 0,
                                })}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-zinc-600">
                            {r.service} · {r.staff}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="col-span-12 rounded-2xl border border-amber-200/60 bg-white p-4 xl:col-span-5">
            <SectionHead
              title={t("calendarTitle", { month: monthLabel })}
            />
            <CalendarGrid t={t} weekdays={weekdays} monthInfo={monthInfo} />
          </section>

          <section className="col-span-12 rounded-2xl border border-amber-200/60 bg-white p-4 xl:col-span-2">
            <SectionHead title={t("accessTitle")} />
            <ul className="mt-4 divide-y divide-amber-100">
              {MOCK_ACCESS_LOG.filter((e) => e.daysAgo === 0).map((e) => (
                <li key={e.id} className="py-2 first:pt-0 last:pb-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium text-ink">
                      {e.name}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-zinc-600">
                      {String(e.hour).padStart(2, "0")}:
                      {String(e.min).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/55">
                    {t(`accessRole.${e.role}`)}
                  </div>
                </li>
              ))}
            </ul>
          </section>

        </div>

        <footer className="border-t border-amber-200/60 bg-white/50 px-8 py-5 text-xs text-zinc-500">
          예약가즈아 · /g/{slug} ·{" "}
          <Link
            href={`/${lang}/g/${slug}/settings`}
            className="hover:text-ink"
          >
            {t("themeLink")}
          </Link>
        </footer>
      </main>
    </div>
  );
}

function SectionHead({ eyebrow, title }: { eyebrow?: string; title: string }) {
  return (
    <div>
      {eyebrow && (
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink/60">
          {eyebrow}
        </span>
      )}
      <h2 className="font-heading text-base tracking-tight text-ink">
        {title}
      </h2>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  span = "lg:col-span-4",
  cellOnly,
  extra,
}: {
  label: string;
  value: string | number;
  sub: string;
  span?: string;
  cellOnly?: boolean;
  extra?: ReactNode;
}) {
  const wrap = cellOnly
    ? "rounded-2xl border border-amber-200/60 bg-white p-5"
    : `col-span-12 rounded-2xl border border-amber-200/60 bg-white p-5 sm:col-span-6 ${span}`;
  return (
    <div className={wrap}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink/60">
        {label}
      </span>
      <div className="mt-2 flex items-start justify-between gap-6">
        <div className="flex items-baseline gap-1.5 shrink-0">
          <span className="font-heading text-4xl tabular-nums tracking-tight text-ink">
            {value}
          </span>
          <span className="text-sm text-zinc-500">{sub}</span>
        </div>
        {extra && <div className="min-w-0 flex-1 pl-4">{extra}</div>}
      </div>
    </div>
  );
}

function CalendarGrid({
  t,
  weekdays,
  monthInfo,
}: {
  t: (k: string, v?: Record<string, string | number>) => string;
  weekdays: readonly string[];
  monthInfo: ReturnType<typeof getManilaMonthInfo>;
}) {
  const { daysInMonth, firstWeekday, todayDay } = monthInfo;
  return (
    <div className="mt-4 grid grid-cols-7 gap-1 text-center">
      {weekdays.map((w) => (
        <span
          key={w}
          className="rounded-t-md bg-band/40 py-2 pb-2 text-[11px] font-medium text-ink/70"
        >
          {w}
        </span>
      ))}
      {Array.from({ length: firstWeekday }).map((_, i) => (
        <div key={`pad-${i}`} />
      ))}
      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
        if (MOCK_CLOSED_DAYS.has(day)) {
          return (
            <div
              key={day}
              className="relative min-h-[68px] rounded-md bg-amber-200/60 p-1.5 text-left text-amber-900/70"
            >
              <div className="text-xs font-medium">{day}</div>
              <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium">
                {t("closed")}
              </div>
            </div>
          );
        }
        const classes = MOCK_GROUP_CLASSES_BY_DAY[day] ?? [];
        const isToday = day === todayDay;
        return (
          <div
            key={day}
            className={`min-h-[68px] rounded-md border border-amber-200/60 p-1.5 text-left ${
              isToday ? "bg-white ring-2 ring-ink" : "bg-amber-50/30"
            }`}
          >
            <div className="text-xs font-medium text-ink">{day}</div>
            {classes.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {classes.map((key) => (
                  <li
                    key={key}
                    className="truncate rounded bg-emerald-50 px-1.5 py-0.5 text-center text-[10px] font-medium text-emerald-800 ring-1 ring-emerald-200/70"
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
  );
}
