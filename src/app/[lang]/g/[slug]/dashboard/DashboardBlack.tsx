import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { logout } from "@/lib/auth/actions";
import { prisma } from "@/lib/db/client";
import {
  MOCK_ACCESS_LOG,
  MOCK_KPI,
  MOCK_RESERVATIONS_TODAY,
  fmtTime,
  formatManilaMonthLabel,
  getManilaMonthInfo,
  groupByHour,
} from "../../../preview/_mock";
import { SidebarNav } from "./SidebarNav";
import { getKpiExtras, fmtHoursRange, fmtCheckIn } from "./kpi-data";
import { CalendarMonth } from "./CalendarMonth";
import {
  expandSchedulesToMonth,
  type ScheduleInput,
} from "@/lib/booking/schedule-expand";
import type { ReactNode } from "react";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type Props = {
  lang: string;
  slug: string;
  gymId: string;
  businessName: string;
};

export async function DashboardBlack({ lang, slug, gymId, businessName }: Props) {
  const t = await getTranslations("dashboard");
  const tn = await getTranslations("nav");
  const tc = await getTranslations("checkin");
  const th = await getTranslations("hours");
  const ts = await getTranslations("services.schedule");
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
  const monthStart = new Date(Date.UTC(monthInfo.year, monthInfo.month - 1, 1));
  const monthEndExclusive = new Date(
    Date.UTC(monthInfo.year, monthInfo.month, 1),
  );

  const [groupServiceRows, closures] = await Promise.all([
    prisma.service.findMany({
      where: { gymId, capacity: { gte: 2 } },
      include: {
        schedules: {
          where: { active: true },
          orderBy: { startMinute: "asc" },
          include: {
            staff: { include: { user: { select: { name: true } } } },
            reservations: {
              where: {
                status: { in: ["PENDING_PAYMENT", "CONFIRMED"] },
                startAt: { gte: monthStart, lt: monthEndExclusive },
              },
              select: { startAt: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.businessClosure.findMany({
      where: {
        gymId,
        date: { gte: monthStart, lt: monthEndExclusive },
        kind: "CLOSED",
      },
      select: { date: true },
    }),
  ]);

  const allSchedules: ScheduleInput[] = groupServiceRows.flatMap((s) =>
    s.schedules.map((sc) => ({
      id: sc.id,
      serviceId: s.id,
      service: { name: s.name, capacity: s.capacity, durationMin: s.durationMin },
      staff: sc.staff ? { user: { name: sc.staff.user.name } } : null,
      kind: sc.kind,
      weekdays: sc.weekdays,
      specificDate: sc.specificDate,
      startMinute: sc.startMinute,
      validFrom: sc.validFrom,
      validUntil: sc.validUntil,
      note: sc.note,
      reservations: sc.reservations.map((r) => ({ startAt: r.startAt })),
    })),
  );

  const eventsByDayMap = expandSchedulesToMonth(
    allSchedules,
    monthInfo.year,
    monthInfo.month - 1,
  );
  const eventsByDay: Record<number, ReturnType<typeof expandSchedulesToMonth> extends Map<number, infer V> ? V : never> = Object.fromEntries(eventsByDayMap);

  const closedDays = closures.map((c) => c.date.getUTCDate());

  const calendarLabels = {
    closed: t("closed"),
    badgeRecurring: ts("badgeRecurring"),
    badgeOneOff: ts("badgeOneOff"),
    capacityLabel: t("capacityLabel"),
    enrolledLabel: t("enrolledLabel"),
    durationLabel: t("durationLabel"),
    startTimeLabel: t("startTimeLabel"),
    endTimeLabel: t("endTimeLabel"),
    staffLabel: t("staffLabel"),
    staffNone: ts("staffNone"),
    noteLabel: t("noteLabel"),
    noEvents: t("noEventsForDay"),
    unit: { min: t("unitMin"), people: t("unitPeople") },
  };

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-200">
      <aside className="hidden w-60 shrink-0 flex-col bg-black lg:flex">
        <div className="border-b border-white/5 px-6 py-6">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-lime-300/80">
            {tn("studio")}
          </span>
          <div className="mt-1 font-heading text-lg tracking-tight text-white">
            {businessName}
          </div>
          <div className="mt-0.5 text-xs text-zinc-500">/g/{slug}</div>
        </div>
        <SidebarNav tone="black" />
        <div className="border-t border-white/5 px-3 py-4">
          <form action={logout.bind(null, `/${lang}/g/${slug}/login`)}>
            <button className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-zinc-400 hover:bg-white/5">
              {tn("logout")}
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <header className="flex items-center justify-between border-b border-white/5 px-8 py-5">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-lime-300/80">
              {t("eyebrow")}
            </span>
            <h1 className="font-heading text-xl tracking-tight text-white">
              {todayDisplay}
            </h1>
          </div>
          <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-400">
            {t("sampleData")}
          </span>
        </header>

        <div className="grid grid-cols-12 gap-4 p-6">
          <div className="col-span-12 grid grid-cols-2 gap-4 xl:col-span-5">
          <DarkKpi
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
                          ? "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30"
                          : kpi.hours.nowOpen
                            ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30"
                            : "bg-rose-400/15 text-rose-300 ring-1 ring-rose-400/30"
                      }`}
                    >
                      {kpi.hours.onBreak
                        ? th("onBreakNow")
                        : kpi.hours.nowOpen
                          ? th("operatingNow")
                          : th("closedNow")}
                    </span>
                    <span className="font-mono tabular-nums text-zinc-400">
                      {fmtHoursRange(kpi.hours)}
                    </span>
                  </>
                ) : (
                  <span className="rounded-full bg-rose-400/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-300 ring-1 ring-rose-400/30">
                    {th("closedToday")}
                  </span>
                )}
              </div>
            }
          />
          <DarkKpi
            label={t("kpiActiveMembers")}
            value={`${MOCK_KPI.activeMembers}/${MOCK_KPI.totalCustomersEver}`}
            sub={t("unitPeople")}
            cellOnly
          />
          </div>
          <div className="col-span-12 xl:col-span-7">
          <DarkKpi
            label={t("kpiTodayStaff")}
            value={kpi.staff.filter((s) => s.checkInMin != null).length}
            sub={`/${kpi.staff.length}${t("unitPeople")}`}
            cellOnly
            extra={
              kpi.staff.length === 0 ? null : (
                <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 lg:grid-cols-3">
                  {kpi.staff.slice(0, 9).map((s) => (
                    <li key={s.userId} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-zinc-200">{s.name}</span>
                      {s.checkInMin != null ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <span className="font-mono tabular-nums text-zinc-300">
                            {fmtCheckIn(s.checkInMin)}
                          </span>
                          {s.lateMin != null && s.lateMin > 0 && (
                            <span className="rounded-full bg-rose-400/15 px-1 text-[9px] font-bold text-rose-300 ring-1 ring-rose-400/30">
                              {tc("late", { min: s.lateMin })}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="shrink-0 text-[10px] text-zinc-500">{tc("notCheckedIn")}</span>
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

          <section className="col-span-12 rounded-2xl border border-white/5 bg-zinc-900 p-6 xl:col-span-5">
            <SectionHead
              title={t("timelineTitle")}
            />
            <ol className="mt-5 space-y-4">
              {buckets.map((b) => (
                <li
                  key={b.startMin}
                  className="grid grid-cols-[60px_1fr] gap-4"
                >
                  <div className="pt-2 text-sm font-medium tabular-nums text-zinc-500">
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
                          className={`relative rounded-xl p-3 ${
                            isActive
                              ? "bg-lime-300 text-zinc-950 shadow-[0_0_24px_rgba(190,242,100,0.4)]"
                              : isPast
                                ? "bg-zinc-900 text-zinc-600 ring-1 ring-white/5"
                                : isGroup
                                  ? "bg-zinc-800 ring-1 ring-lime-300/40"
                                  : "bg-zinc-800 ring-1 ring-white/5"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`font-medium ${
                                isActive ? "text-zinc-950" : "text-white"
                              }`}
                            >
                              {r.customer}
                            </span>
                            {isActive && (
                              <span className="rounded-full bg-zinc-950 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-lime-300">
                                {t("liveDark")}
                              </span>
                            )}
                            {isGroup && (
                              <span className="rounded-full bg-lime-300 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-950">
                                {t("groupBadge", {
                                  enrolled: r.enrolled ?? 0,
                                  capacity: r.capacity ?? 0,
                                })}
                              </span>
                            )}
                          </div>
                          <div
                            className={`mt-1 text-xs ${
                              isActive ? "text-zinc-800" : "text-zinc-400"
                            }`}
                          >
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

          <section className="col-span-12 rounded-2xl border border-white/5 bg-zinc-900 p-4 xl:col-span-5">
            <SectionHead
              title={t("calendarTitle", { month: monthLabel })}
            />
            <CalendarMonth
              weekdays={weekdays}
              monthInfo={monthInfo}
              eventsByDay={eventsByDay}
              closedDays={closedDays}
              tone="black"
              labels={calendarLabels}
            />
          </section>

          <section className="col-span-12 rounded-2xl border border-white/5 bg-zinc-900 p-4 xl:col-span-2">
            <SectionHead title={t("accessTitle")} />
            <ul className="mt-4 divide-y divide-white/5">
              {MOCK_ACCESS_LOG.filter((e) => e.daysAgo === 0).map((e) => (
                <li key={e.id} className="py-2 first:pt-0 last:pb-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium text-white">
                      {e.name}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-zinc-400">
                      {String(e.hour).padStart(2, "0")}:
                      {String(e.min).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-lime-300/70">
                    {t(`accessRole.${e.role}`)}
                  </div>
                </li>
              ))}
            </ul>
          </section>

        </div>

        <footer className="border-t border-white/5 px-8 py-5 text-xs text-zinc-500">
          예약가즈아 · /g/{slug} ·{" "}
          <Link
            href={`/${lang}/g/${slug}/settings`}
            className="hover:text-lime-300"
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
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-lime-300/80">
          {eyebrow}
        </span>
      )}
      <h2 className="font-heading text-base tracking-tight text-white">
        {title}
      </h2>
    </div>
  );
}

function DarkKpi({
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
    ? "rounded-2xl border border-white/5 bg-zinc-900 p-5"
    : `col-span-12 rounded-2xl border border-white/5 bg-zinc-900 p-5 sm:col-span-6 ${span}`;
  return (
    <div className={wrap}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-lime-300/80">
        {label}
      </span>
      <div className="mt-2 flex items-start justify-between gap-6">
        <div className="flex items-baseline gap-1.5 shrink-0">
          <span className="font-heading text-4xl tabular-nums tracking-tight text-white">
            {value}
          </span>
          <span className="text-sm text-zinc-500">{sub}</span>
        </div>
        {extra && <div className="min-w-0 flex-1 pl-4">{extra}</div>}
      </div>
    </div>
  );
}

