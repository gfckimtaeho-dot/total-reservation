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
  MOCK_TODAY,
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

export async function DashboardWhite({ lang, slug, businessName }: Props) {
  const t = await getTranslations("dashboard");
  const tn = await getTranslations("nav");
  const buckets = groupByHour(MOCK_RESERVATIONS_TODAY);
  const weekdays = lang === "en" ? WEEKDAYS_EN : WEEKDAYS;

  return (
    <div className="flex min-h-screen bg-white">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-zinc-100 bg-white lg:flex">
        <div className="border-b border-zinc-100 px-6 py-6">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
            {tn("studio")}
          </span>
          <div className="mt-1 font-heading text-lg tracking-tight text-ink">
            {businessName}
          </div>
          <div className="mt-0.5 text-xs text-zinc-500">/g/{slug}</div>
        </div>
        <SidebarNav
          lang={lang}
          slug={slug}
          activeKey="dashboard"
          tone="white"
        />
        <div className="border-t border-zinc-100 px-3 py-4">
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
              {MOCK_TODAY.display}
            </h1>
          </div>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-600">
            {t("sampleData")}
          </span>
        </header>

        <div className="grid grid-cols-12 gap-4 p-6">
          <PastelKpi
            tone="lime"
            label={t("kpiTodayBookings")}
            value={MOCK_KPI.todayBookings}
            sub={t("unitCount")}
            badge={t("inProgress", { count: MOCK_KPI.inProgress })}
          />
          <PastelKpi
            tone="amber"
            label={t("kpiActiveMembers")}
            value={`${MOCK_KPI.activeMembers}/${MOCK_KPI.totalCustomersEver}`}
            sub={t("unitPeople")}
          />
          <PastelKpi
            tone="sky"
            label={t("kpiTodayStaff")}
            value={MOCK_KPI.todayShiftStaff}
            sub={t("unitPeople")}
          />

          <section className="col-span-12 rounded-2xl bg-lime-50 p-6 ring-1 ring-lime-200/50 xl:col-span-5">
            <SectionHead
              eyebrow={t("timelineEyebrow")}
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
          </section>

          <section className="col-span-12 rounded-2xl bg-sky-50 p-6 ring-1 ring-sky-200/50 xl:col-span-7">
            <div className="flex items-baseline justify-between">
              <SectionHead
                eyebrow={t("calendarEyebrow")}
                title={t("calendarTitle", { month: MOCK_MONTH_LABEL })}
              />
              <span className="text-xs text-zinc-500">
                {t("totalBookings", { count: MOCK_TOTAL_MONTH_BOOKINGS })}
              </span>
            </div>
            <SkyCalendarGrid t={t} weekdays={weekdays} />
          </section>

          <section className="col-span-12 rounded-2xl bg-rose-50 p-6 ring-1 ring-rose-200/50">
            <SectionHead
              eyebrow={t("membershipEyebrow")}
              title={t("membershipTitle")}
            />
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {MOCK_EXPIRING.map((m) => (
                <li
                  key={m.name}
                  className="flex items-center justify-between rounded-lg bg-white px-4 py-3 ring-1 ring-rose-200/50"
                >
                  <span className="font-medium text-ink">{m.name}</span>
                  <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-medium text-white">
                    {t("daysLeft", { days: m.daysLeft })}
                  </span>
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
  badge,
}: {
  tone: "lime" | "amber" | "sky";
  label: string;
  value: string | number;
  sub: string;
  badge?: string;
}) {
  return (
    <div
      className={`col-span-12 rounded-2xl p-5 ring-1 sm:col-span-6 lg:col-span-4 ${TONES[tone]}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink/60">
          {label}
        </span>
        {badge && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TONE_BADGE[tone]}`}
          >
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

function SkyCalendarGrid({
  t,
  weekdays,
}: {
  t: (k: string, v?: Record<string, string | number>) => string;
  weekdays: readonly string[];
}) {
  return (
    <>
      <div className="mt-5 grid grid-cols-7 gap-1.5 text-center">
        {weekdays.map((w) => (
          <span key={w} className="pb-2 text-[11px] font-medium text-zinc-500">
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
                className="relative min-h-[68px] rounded-md bg-zinc-200 p-2 text-left"
              >
                <div className="text-xs font-medium text-zinc-500">{d.day}</div>
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-zinc-500">
                  {t("closed")}
                </div>
              </div>
            );
          }
          const barTotal = d.pt + d.group;
          return (
            <div
              key={d.day}
              className={`relative min-h-[68px] rounded-md border border-sky-100 bg-white p-2 text-left ${
                d.isToday ? "ring-2 ring-sky-700" : ""
              }`}
            >
              <div className="flex items-start justify-between">
                <span className="text-xs font-medium text-ink">{d.day}</span>
                {d.group > 0 && (
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                )}
              </div>
              {d.total > 0 && (
                <div className="font-heading mt-0.5 text-lg leading-none tabular-nums text-ink">
                  {d.total}
                </div>
              )}
              {barTotal > 0 && (
                <div className="absolute inset-x-2 bottom-2 flex h-1 overflow-hidden rounded-full bg-sky-50">
                  <div
                    className="bg-sky-700"
                    style={{ width: `${(d.pt / barTotal) * 100}%` }}
                  />
                  <div
                    className="bg-rose-500"
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
          <span className="h-1.5 w-3 rounded-sm bg-sky-700" />
          {t("legendPt")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-3 rounded-sm bg-rose-500" />
          {t("legendGroup")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          {t("legendHasGroup")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-zinc-200" />
          {t("legendClosed")}
        </span>
      </div>
    </>
  );
}
