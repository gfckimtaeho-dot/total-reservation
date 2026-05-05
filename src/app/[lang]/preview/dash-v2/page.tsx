// v2 — Mint Sidebar (mainpage 컨셉 #2)
// 사이드바 통째 bg-band 페일 라임 + 흰 메인. v1보다 라임 비중 ↑.

import {
  MOCK_BUSINESS,
  MOCK_EXPIRING,
  MOCK_KPI,
  MOCK_MONTH,
  MOCK_MONTH_LABEL,
  MOCK_MONTH_START_WEEKDAY,
  MOCK_RESERVATIONS_TODAY,
  MOCK_TODAY,
  MOCK_TOTAL_MONTH_BOOKINGS,
  NAV_ITEMS,
  fmtTime,
  groupByHour,
  shadeLevel,
} from "../_mock";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
const SHADE_BG = ["bg-zinc-50", "bg-band/40", "bg-band/70", "bg-band"] as const;
const SHADE_TEXT = ["text-zinc-300", "text-ink/60", "text-ink/80", "text-ink"] as const;

export default function DashV2() {
  const buckets = groupByHour(MOCK_RESERVATIONS_TODAY);

  return (
    <div className="flex min-h-screen bg-white">
      <aside className="hidden w-60 shrink-0 flex-col bg-band lg:flex">
        <div className="border-b border-ink/10 px-6 py-6">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/70">
            STUDIO
          </span>
          <div className="mt-1 font-heading text-lg tracking-tight text-ink">
            {MOCK_BUSINESS.name}
          </div>
          <div className="mt-0.5 text-xs text-ink/60">/g/{MOCK_BUSINESS.slug}</div>
        </div>
        <nav className="flex-1 px-3 py-4">
          <a className="flex items-center rounded-md bg-ink px-3 py-2 text-sm font-medium text-white">
            대시보드
          </a>
          {NAV_ITEMS.map((n) => (
            <a key={n.key} className="flex items-center rounded-md px-3 py-2 text-sm text-ink/80 transition hover:bg-white/40">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="border-t border-ink/10 px-3 py-4">
          <a className="flex items-center rounded-md px-3 py-2 text-sm text-ink/80 hover:bg-white/40">로그아웃</a>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <header className="border-b border-zinc-100 px-8 py-5">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
            DASHBOARD
          </span>
          <h1 className="font-heading text-xl tracking-tight text-ink">
            {MOCK_TODAY.display}
          </h1>
        </header>

        <div className="grid grid-cols-12 gap-4 p-6">
          <KpiCard label="오늘 예약" value={MOCK_KPI.todayBookings} sub="건" badge={`진행중 ${MOCK_KPI.inProgress}`} />
          <KpiCard label="활성 회원" value={`${MOCK_KPI.activeMembers}/${MOCK_KPI.totalCustomersEver}`} sub="명" />
          <KpiCard label="오늘 근무" value={MOCK_KPI.todayShiftStaff} sub="명" />

          <section className="col-span-12 rounded-2xl border border-zinc-200 bg-white p-6 xl:col-span-5">
            <SectionHead eyebrow="TIMELINE" title="오늘의 일정" />
            <ol className="mt-5 space-y-4">
              {buckets.map((b) => (
                <li key={b.startMin} className="grid grid-cols-[60px_1fr] gap-4">
                  <div className="pt-2 text-sm tabular-nums font-medium text-zinc-500">
                    {fmtTime(b.startMin)}
                  </div>
                  <div className={`grid gap-2 ${b.items.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                    {b.items.map((r) => {
                      const isActive = r.status === "IN_PROGRESS";
                      const isPast = r.status === "COMPLETED";
                      const isGroup = r.serviceType === "GROUP";
                      return (
                        <div
                          key={r.id}
                          className={`relative rounded-xl border-l-4 p-3 ${
                            isActive
                              ? "border-l-ink bg-band shadow-sm"
                              : isPast
                                ? "border-l-zinc-200 bg-zinc-50/60 opacity-60"
                                : isGroup
                                  ? "border-l-emerald-400 bg-emerald-50/50"
                                  : "border-l-zinc-300 bg-white border border-zinc-100"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-ink">{r.customer}</span>
                            {isActive && (
                              <span className="rounded-full bg-ink px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white">
                                진행중
                              </span>
                            )}
                            {isGroup && (
                              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white">
                                그룹 {r.enrolled}/{r.capacity}
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

          <section className="col-span-12 rounded-2xl border border-zinc-200 bg-white p-6 xl:col-span-7">
            <div className="flex items-baseline justify-between">
              <SectionHead eyebrow="CALENDAR" title={`${MOCK_MONTH_LABEL} 예약 현황`} />
              <span className="text-xs text-zinc-500">총 {MOCK_TOTAL_MONTH_BOOKINGS}건</span>
            </div>
            <CalendarGrid />
          </section>

          <section className="col-span-12 rounded-2xl bg-band/40 p-6">
            <SectionHead eyebrow="MEMBERSHIP · 7일 내 만료" title="갱신 권유 대상" />
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {MOCK_EXPIRING.map((m) => (
                <li
                  key={m.name}
                  className="flex items-center justify-between rounded-lg bg-white px-4 py-3 ring-1 ring-ink/10"
                >
                  <span className="font-medium text-ink">{m.name}</span>
                  <span className="text-xs text-zinc-600">D-{m.daysLeft}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <footer className="border-t border-zinc-100 bg-white px-8 py-5 text-xs text-zinc-500">
          {MOCK_BUSINESS.address} · {MOCK_BUSINESS.phone} · {MOCK_BUSINESS.email}
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
      <h2 className="font-heading text-base tracking-tight text-ink">{title}</h2>
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
    <div className="col-span-12 rounded-2xl border border-zinc-200 bg-white p-5 sm:col-span-6 lg:col-span-4">
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

function CalendarGrid() {
  return (
    <>
      <div className="mt-5 grid grid-cols-7 gap-1.5 text-center">
        {WEEKDAYS.map((w) => (
          <span key={w} className="pb-2 text-[11px] font-medium text-zinc-400">
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
                  휴
                </div>
              </div>
            );
          }
          const barTotal = d.pt + d.group;
          return (
            <div
              key={d.day}
              className={`relative min-h-[68px] rounded-md border border-zinc-100 bg-white p-2 text-left ${
                d.isToday ? "ring-2 ring-ink" : ""
              }`}
              title={
                d.total === 0
                  ? `${d.day}일 — 예약 없음`
                  : `${d.day}일\nPT ${d.pt}건\n그룹 ${d.group}건\n자유 ${d.free}건\n노쇼 ${d.noShow}건`
              }
            >
              <div className="flex items-start justify-between">
                <span className="text-xs font-medium text-ink">{d.day}</span>
                {d.group > 0 && (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                )}
              </div>
              {d.total > 0 && (
                <div className="font-heading mt-0.5 text-lg tabular-nums leading-none text-ink">
                  {d.total}
                </div>
              )}
              {barTotal > 0 && (
                <div className="absolute inset-x-2 bottom-2 flex h-1 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="bg-ink"
                    style={{ width: `${(d.pt / barTotal) * 100}%` }}
                    title={`PT ${d.pt}건`}
                  />
                  <div
                    className="bg-emerald-500"
                    style={{ width: `${(d.group / barTotal) * 100}%` }}
                    title={`그룹 ${d.group}건`}
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
          PT
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-3 rounded-sm bg-emerald-500" />
          그룹 수업
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
          단체 수업 있음
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-zinc-200" />
          휴무
        </span>
      </div>
    </>
  );
}
