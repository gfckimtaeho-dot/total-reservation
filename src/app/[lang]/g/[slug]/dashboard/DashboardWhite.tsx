import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { logout } from "@/lib/auth/actions";
import { prisma } from "@/lib/db/client";
import { verifySession } from "@/lib/auth/dal";
import {
  fmtTime,
  formatGymMonthLabel,
  getGymMonthInfo,
} from "@/lib/calendar/gymTime";
import { SidebarNav } from "./SidebarNav";
import { RefreshButton } from "./RefreshButton";
import { getKpiExtras } from "./kpi-data";
import { getPendingRefundCount } from "../refunds/actions";
import { unreadForViewer, type ChatViewer } from "@/lib/chat/queries";
import { CalendarMonth } from "./CalendarMonth";
import {
  expandSchedulesToMonth,
  type ScheduleInput,
} from "@/lib/booking/schedule-expand";

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
  const [kpi, pendingRefunds, viewerSession] = await Promise.all([
    getKpiExtras(gymId),
    getPendingRefundCount(slug),
    verifySession(),
  ]);
  let chatUnread = 0;
  if (viewerSession && viewerSession.gymId) {
    const viewer: ChatViewer = {
      id: viewerSession.id,
      gymId: viewerSession.gymId,
      role: viewerSession.role,
    };
    const data = await unreadForViewer(viewer);
    chatUnread = data.total;
  }
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
      where: { gymId, active: true, capacity: { gte: 2 } },
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
              select: {
                startAt: true,
                customer: { select: { name: true } },
              },
              orderBy: { createdAt: "asc" },
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
      reservations: sc.reservations.map((r) => ({
        startAt: r.startAt,
        customerName: r.customer.name,
      })),
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
    sessionCustomersEmpty: t("sessionCustomersEmpty"),
  };

  return (
    <div className="min-h-screen bg-white">
      {/* 상단 바: 매장명 + 가로 메뉴 + 새로고침/로그아웃 (좌측 사이드바 폐지) */}
      <header className="border-b border-zinc-200 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <span className="text-lg font-semibold tracking-tight text-zinc-900">
              {businessName}
            </span>
            <span className="text-sm text-zinc-500">{todayDisplay}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <RefreshButton label={t("refresh")} />
            <form action={logout.bind(null, `/${lang}/g/${slug}/login`)}>
              <button className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50">
                {tn("logout")}
              </button>
            </form>
          </div>
        </div>
        <div className="mt-3">
          <SidebarNav orientation="top" />
        </div>
      </header>

      <main className="overflow-x-hidden">
        <div className="grid grid-cols-12 gap-4 p-6">
          <div className="col-span-6 flex flex-col rounded-2xl border border-zinc-200 p-3 xl:col-span-3">
            <span className="mb-2 w-fit rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
              {t("kpiTodayBookings")}
            </span>
            <div className="flex flex-1 items-baseline justify-center gap-1.5">
              <span className="text-4xl font-bold tabular-nums tracking-tight text-emerald-600">
                {kpi.ptCount + kpi.groupParticipants}
              </span>
              <span className="text-base text-zinc-400">{t("unitCount")}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-zinc-500">
              {kpi.ptCount > 0 && (
                <span>{t("kpiBreakdownPt", { pt: kpi.ptCount })}</span>
              )}
              {kpi.groupParticipants > 0 && (
                <span>{t("kpiBreakdownGroup", { group: kpi.groupParticipants })}</span>
              )}
            </div>
          </div>
          <div className="col-span-6 flex flex-col rounded-2xl border border-zinc-200 p-3 xl:col-span-3">
            <span className="mb-2 w-fit rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700">
              {t("kpiActiveMembers")}
            </span>
            <div className="flex flex-1 items-baseline justify-center gap-1.5">
              <span className="text-4xl font-bold tabular-nums tracking-tight text-indigo-600">
                {kpi.activeMembers}/{kpi.totalCustomers}
              </span>
              <span className="text-base text-zinc-400">{t("unitPeople")}</span>
            </div>
            <div className="mt-1 text-xs text-zinc-500">{t("kpiActiveMembersSub")}</div>
          </div>
          <TodoCard
            tone="orange"
            label={t("todoRefundsLabel")}
            count={pendingRefunds}
            unit={t("unitCount")}
            sub={t("todoRefundsSub")}
            href={`/${lang}/g/${slug}/refunds`}
          />
          <TodoCard
            tone="rose"
            label={t("todoChatLabel")}
            count={chatUnread}
            unit={t("unitCount")}
            sub={t("todoChatSub")}
            href={`/${lang}/g/${slug}/chat`}
          />
          {/* 오늘의 일정 — 오늘 예약 카드 아래 */}
          <section className="col-span-12 rounded-2xl border border-zinc-200 p-5 xl:col-span-3">
            <SectionHead dot="bg-emerald-500" title={t("timelineTitle")} />
            <ol className="mt-5 space-y-4">
              {buckets.map((b) => (
                <li
                  key={b.startMin}
                  className="grid grid-cols-[64px_1fr] gap-3"
                >
                  <div className="pt-2 text-lg font-semibold tabular-nums text-zinc-700">
                    {fmtTime(b.startMin)}
                  </div>
                  <div className="grid gap-2 grid-cols-1">
                    {b.items.map((r) => {
                      const isActive = r.status === "IN_PROGRESS";
                      const isPast = r.status === "COMPLETED";
                      const isGroup = r.serviceType === "GROUP";
                      return (
                        <div
                          key={r.id}
                          className={`relative overflow-hidden rounded-lg border py-2 pl-4 pr-3 ${
                            isActive
                              ? "border-amber-200 bg-amber-50"
                              : isPast
                                ? "border-emerald-200 bg-emerald-50"
                                : "border-zinc-200 bg-white"
                          }`}
                        >
                          <span
                            className={`absolute left-0 top-0 h-full w-1.5 ${
                              isGroup ? "bg-rose-500" : "bg-indigo-500"
                            }`}
                          />
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 flex-col">
                              <span className="truncate text-sm font-semibold text-zinc-900">
                                {r.customer}
                              </span>
                              <span className="truncate text-xs text-zinc-600">
                                {isGroup
                                  ? t("instructorLabel", { name: r.staff })
                                  : `${r.service} · ${r.staff}`}
                              </span>
                            </div>
                            {isActive && (
                              <span className="shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                                {t("live")}
                              </span>
                            )}
                            {isPast && (
                              <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                                {t("completedBadge")}
                              </span>
                            )}
                            {isGroup && (
                              <span className="shrink-0 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                                {t("groupBadge", {
                                  enrolled: r.enrolled ?? 0,
                                  capacity: r.capacity ?? 0,
                                })}
                              </span>
                            )}
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

          <input type="hidden" data-lang={lang} data-slug={slug} />

          {/* 달력 — 가운데 */}
          <section className="col-span-12 rounded-2xl border border-zinc-200 p-4 xl:col-span-6">
            <SectionHead dot="bg-sky-500" title={t("calendarTitle", { month: monthLabel })} />
            <CalendarMonth
              weekdays={weekdays}
              monthInfo={monthInfo}
              eventsByDay={eventsByDay}
              closedDays={closedDays}
              labels={calendarLabels}
            />
          </section>

          {/* 출입 현황 — 고객 메시지 카드 아래 */}
          <section className="col-span-12 flex flex-col rounded-2xl border border-zinc-200 p-4 xl:col-span-3">
            <SectionHead dot="bg-amber-500" title={t("accessTitle")} />
            <ul className="mt-3 max-h-72 divide-y divide-zinc-100 overflow-y-auto">
              {kpi.accessToday.map((e) => (
                <li key={e.id} className="flex items-center gap-2 py-2 first:pt-0">
                  <span className="w-11 shrink-0 text-xs tabular-nums text-zinc-400">
                    {String(e.hour).padStart(2, "0")}:
                    {String(e.min).padStart(2, "0")}
                  </span>
                  <span className="flex-1 truncate text-sm font-medium text-zinc-900">
                    {e.name}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      e.role === "CUSTOMER"
                        ? "bg-zinc-100 text-zinc-600"
                        : "bg-indigo-100 text-indigo-700"
                    }`}
                  >
                    {t(`accessRole.${e.role}`)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

        </div>

        <footer className="border-t border-zinc-200 px-6 py-4 text-xs text-zinc-400">
          예약가즈아 · /g/{slug} ·{" "}
          <Link
            href={`/${lang}/g/${slug}/settings`}
            className="hover:text-zinc-900"
          >
            {t("themeLink")}
          </Link>
        </footer>
      </main>
    </div>
  );
}

function SectionHead({ dot = "bg-zinc-400", title }: { dot?: string; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
      <h2 className="text-base font-semibold tracking-tight text-zinc-900">{title}</h2>
    </div>
  );
}

function TodoCard({
  tone,
  label,
  count,
  unit,
  sub,
  href,
}: {
  tone: "orange" | "rose";
  label: string;
  count: number;
  unit: string;
  sub: string;
  href: string;
}) {
  const has = count > 0;
  const c =
    tone === "orange"
      ? { chip: "bg-amber-100 text-amber-700", num: "text-amber-600" }
      : { chip: "bg-rose-100 text-rose-700", num: "text-rose-600" };
  return (
    <Link
      href={href}
      className="col-span-6 flex flex-col rounded-2xl border border-zinc-200 p-3 transition hover:border-zinc-300 xl:col-span-3"
    >
      <span className={`mb-2 w-fit rounded-md px-2 py-0.5 text-xs font-bold ${c.chip}`}>
        {label}
      </span>
      <div className="flex flex-1 items-baseline justify-center gap-1.5">
        <span className={`text-4xl font-bold tabular-nums tracking-tight ${c.num}`}>
          {count}
        </span>
        <span className="text-base text-zinc-400">{unit}</span>
      </div>
      <div className="mt-1 text-xs text-zinc-500">{has ? sub : " "}</div>
    </Link>
  );
}


