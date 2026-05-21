import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { logout } from "@/lib/auth/actions";
import { prisma } from "@/lib/db/client";
import {
  fmtTime,
  formatGymMonthLabel,
  getGymMonthInfo,
} from "@/lib/calendar/gymTime";
import { SidebarNav } from "./SidebarNav";
import { getKpiExtras, fmtCheckIn } from "./kpi-data";
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
  timeZone: string;
};

export async function DashboardWhite({
  lang,
  slug,
  gymId,
  businessName,
  timeZone,
}: Props) {
  const t = await getTranslations("dashboard");
  const tn = await getTranslations("nav");
  const tc = await getTranslations("checkin");
  const ts = await getTranslations("services.schedule");
  const kpi = await getKpiExtras(gymId);
  const buckets = kpi.todayBuckets;
  const weekdays = lang === "en" ? WEEKDAYS_EN : WEEKDAYS;
  const today = new Date();
  const todayDisplay = new Intl.DateTimeFormat(
    lang === "en" ? "en-US" : "ko-KR",
    {
      timeZone,
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    },
  ).format(today);
  const monthLabel = formatGymMonthLabel(timeZone, today, lang);
  const monthInfo = getGymMonthInfo(timeZone, today);
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
    <div className="flex min-h-screen bg-white">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-violet-100 bg-violet-50 lg:flex">
        <div className="border-b border-violet-100 px-6 py-6">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
            {tn("studio")}
          </span>
          <div className="mt-1 font-heading text-lg tracking-tight text-ink">
            {businessName}
          </div>
          <div className="mt-0.5 text-xs text-zinc-500">/g/{slug}</div>
        </div>
        <SidebarNav tone="white" />
        <div className="border-t border-violet-100 px-3 py-4">
          <form action={logout.bind(null, `/${lang}/g/${slug}/login`)}>
            <button className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50">
              {tn("logout")}
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <header className="flex items-center justify-between border-b border-zinc-100 px-8 py-5">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
              {t("eyebrow")}
            </span>
            <h1 className="font-heading text-xl tracking-tight text-ink">
              {todayDisplay}
            </h1>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-4 p-6">
          <div className="col-span-12 grid grid-cols-2 gap-4 xl:col-span-5">
          <PastelKpi
            tone="lime"
            label={t("kpiTodayBookings")}
            value={kpi.ptCount + kpi.groupParticipants}
            sub={t("unitCount")}
            cellOnly
            extra={
              <div className="text-right text-xs leading-relaxed text-zinc-600">
                {t("kpiBookingBreakdown", {
                  pt: kpi.ptCount,
                  group: kpi.groupParticipants,
                })}
              </div>
            }
          />
          <PastelKpi
            tone="amber"
            label={t("kpiActiveMembers")}
            value={`${kpi.activeMembers}/${kpi.totalCustomers}`}
            sub={t("unitPeople")}
            cellOnly
          />
          </div>
          <div className="col-span-12 xl:col-span-7">
          <PastelKpi
            tone="sky"
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

          <section className="col-span-12 rounded-2xl bg-lime-50 p-6 ring-1 ring-lime-200/50 xl:col-span-5">
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
                              ? "bg-lime-300 ring-1 ring-lime-500"
                              : isPast
                                ? "bg-white text-zinc-500 opacity-70 ring-1 ring-zinc-100"
                                : isGroup
                                  ? "bg-rose-100 ring-1 ring-rose-200"
                                  : "bg-white ring-1 ring-zinc-200"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-ink">
                              {r.customer}
                            </span>
                            {isActive && (
                              <span className="rounded-full bg-ink px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-lime-300">
                                {t("live")}
                              </span>
                            )}
                            {isGroup && (
                              <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white">
                                {t("groupBadge", {
                                  enrolled: r.enrolled ?? 0,
                                  capacity: r.capacity ?? 0,
                                })}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-zinc-700">
                            {r.service} · {r.staff}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ol>
            {buckets.length === 0 && (
              <p className="mt-3 text-sm text-zinc-500">
                {t("timelineEmpty")}
              </p>
            )}
          </section>

          <section className="col-span-12 rounded-2xl bg-sky-50 p-4 ring-1 ring-sky-200/50 xl:col-span-5">
            <SectionHead
              title={t("calendarTitle", { month: monthLabel })}
            />
            <CalendarMonth
              weekdays={weekdays}
              monthInfo={monthInfo}
              eventsByDay={eventsByDay}
              closedDays={closedDays}
              tone="white"
              labels={calendarLabels}
            />
          </section>

          <section className="col-span-12 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200/60 xl:col-span-2">
            <SectionHead title={t("accessTitle")} />
            <ul className="mt-4 divide-y divide-amber-200/50">
              {kpi.accessToday.map((e) => (
                <li key={e.id} className="py-2 first:pt-0 last:pb-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium text-ink">
                      {e.name}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-zinc-700">
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

        <footer className="border-t border-zinc-100 px-8 py-5 text-xs text-zinc-500">
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

const TONES = {
  lime: "bg-lime-50 ring-lime-200/60",
  amber: "bg-amber-50 ring-amber-200/60",
  sky: "bg-sky-50 ring-sky-200/60",
} as const;
const TONE_BADGE = {
  lime: "bg-lime-300 text-ink",
  amber: "bg-amber-300 text-ink",
  sky: "bg-sky-300 text-ink",
} as const;

function PastelKpi({
  tone,
  label,
  value,
  sub,
  span = "lg:col-span-4",
  cellOnly,
  extra,
}: {
  tone: "lime" | "amber" | "sky";
  label: string;
  value: string | number;
  sub: string;
  span?: string;
  cellOnly?: boolean;
  extra?: ReactNode;
}) {
  const wrap = cellOnly
    ? `rounded-2xl p-5 ring-1 ${TONES[tone]}`
    : `col-span-12 rounded-2xl p-5 ring-1 sm:col-span-6 ${span} ${TONES[tone]}`;
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

