import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { logout } from "@/lib/auth/actions";
import {
  MOCK_EXPIRING,
  MOCK_KPI,
  MOCK_MONTH,
  MOCK_MONTH_LABEL,
  MOCK_MONTH_START_WEEKDAY,
  MOCK_RESERVATIONS_TODAY,
  MOCK_TOTAL_MONTH_BOOKINGS,
  fmtTime,
  groupByHour,
} from "../../../preview/_mock";
import { SidebarNav } from "./SidebarNav";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type Props = {
  lang: string;
  slug: string;
  businessName: string;
};

export async function DashboardNormal({ lang, slug, businessName }: Props) {
  const t = await getTranslations("dashboard");
  const tn = await getTranslations("nav");
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
  const todayDay = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      day: "numeric",
    }).format(today),
    10,
  );

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
        <SidebarNav
          lang={lang}
          slug={slug}
          activeKey="dashboard"
          tone="normal"
        />
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
          <KpiCard
            label={t("kpiTodayBookings")}
            value={MOCK_KPI.todayBookings}
            sub={t("unitCount")}
            badge={t("inProgress", { count: MOCK_KPI.inProgress })}
          />
          <KpiCard
            label={t("kpiActiveMembers")}
            value={`${MOCK_KPI.activeMembers}/${MOCK_KPI.totalCustomersEver}`}
            sub={t("unitPeople")}
          />
          <KpiCard
            label={t("kpiTodayStaff")}
            value={MOCK_KPI.todayShiftStaff}
            sub={t("unitPeople")}
          />

          <section className="col-span-12 rounded-2xl border border-amber-200/60 bg-white p-6 xl:col-span-5">
            <SectionHead
              eyebrow={t("timelineEyebrow")}
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

          <section className="col-span-12 rounded-2xl border border-amber-200/60 bg-white p-6 xl:col-span-7">
            <div className="flex items-baseline justify-between">
              <SectionHead
                eyebrow={t("calendarEyebrow")}
                title={t("calendarTitle", { month: MOCK_MONTH_LABEL })}
              />
              <span className="text-xs text-zinc-500">
                {t("totalBookings", { count: MOCK_TOTAL_MONTH_BOOKINGS })}
              </span>
            </div>
            <CalendarGrid t={t} weekdays={weekdays} todayDay={todayDay} />
          </section>

          <section className="col-span-12 rounded-2xl bg-amber-100/60 p-6 ring-1 ring-amber-200/60">
            <SectionHead
              eyebrow={t("membershipEyebrow")}
              title={t("membershipTitle")}
            />
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {MOCK_EXPIRING.map((m) => (
                <li
                  key={m.name}
                  className="flex items-center justify-between rounded-lg bg-white px-4 py-3 ring-1 ring-amber-200/60"
                >
                  <span className="font-medium text-ink">{m.name}</span>
                  <span className="text-xs text-zinc-600">
                    {t("daysLeft", { days: m.daysLeft })}
                  </span>
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

function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink/60">
        {eyebrow}
      </span>
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
  badge,
}: {
  label: string;
  value: string | number;
  sub: string;
  badge?: string;
}) {
  return (
    <div className="col-span-12 rounded-2xl border border-amber-200/60 bg-white p-5 sm:col-span-6 lg:col-span-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink/60">
          {label}
        </span>
        {badge && (
          <span className="rounded-full bg-band px-2 py-0.5 text-[10px] font-medium text-ink">
            {badge}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-heading text-4xl tabular-nums tracking-tight text-ink">
          {value}
        </span>
        <span className="text-sm text-zinc-500">{sub}</span>
      </div>
    </div>
  );
}

function CalendarGrid({
  t,
  weekdays,
  todayDay,
}: {
  t: (k: string, v?: Record<string, string | number>) => string;
  weekdays: readonly string[];
  todayDay: number;
}) {
  return (
    <>
      <div className="mt-5 grid grid-cols-7 gap-1.5 text-center">
        {weekdays.map((w) => (
          <span
            key={w}
            className="rounded-t-md bg-band/40 py-2 pb-2 text-[11px] font-medium text-ink/70"
          >
            {w}
          </span>
        ))}
        {Array.from({ length: MOCK_MONTH_START_WEEKDAY }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {MOCK_MONTH.map((d) => {
          if (d.isClosed) {
            return (
              <div
                key={d.day}
                className="relative min-h-[68px] rounded-md bg-amber-200/60 p-2 text-left text-amber-900/70"
              >
                <div className="text-xs font-medium">{d.day}</div>
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium">
                  {t("closed")}
                </div>
              </div>
            );
          }
          const barTotal = d.pt + d.group;
          const isToday = d.day === todayDay;
          return (
            <div
              key={d.day}
              className={`relative min-h-[68px] rounded-md border border-amber-200/60 p-2 text-left ${
                isToday ? "bg-white ring-2 ring-ink" : "bg-amber-50/30"
              }`}
            >
              <div className="flex items-start justify-between">
                <span className="text-xs font-medium text-ink">{d.day}</span>
                {d.group > 0 && (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                )}
              </div>
              {d.total > 0 && (
                <div className="font-heading mt-0.5 text-lg leading-none tabular-nums text-ink">
                  {d.total}
                </div>
              )}
              {barTotal > 0 && (
                <div className="absolute inset-x-2 bottom-2 flex h-1 overflow-hidden rounded-full bg-amber-100">
                  <div
                    className="bg-ink"
                    style={{ width: `${(d.pt / barTotal) * 100}%` }}
                  />
                  <div
                    className="bg-emerald-500"
                    style={{ width: `${(d.group / barTotal) * 100}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-3 rounded-sm bg-ink" />
          {t("legendPt")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-3 rounded-sm bg-emerald-500" />
          {t("legendGroup")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
          {t("legendHasGroup")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-200/60" />
          {t("legendClosed")}
        </span>
      </div>
    </>
  );
}
