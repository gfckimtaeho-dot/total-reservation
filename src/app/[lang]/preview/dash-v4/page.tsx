// v4 — Calendar-first
// 큰 heatmap이 화면 60% 차지. 우측에 KPI + timeline mini list + 매출.
// 분석/매출 사장님 위주. 월/주 흐름 파악이 우선.

import {
  MOCK_BUSINESS,
  MOCK_KPI,
  MOCK_MONTH,
  MOCK_MONTH_DAYS,
  MOCK_MONTH_LABEL,
  MOCK_MONTH_START_WEEKDAY,
  MOCK_RESERVATIONS_TODAY,
  MOCK_TODAY,
  MOCK_TOTAL_MONTH_BOOKINGS,
  NAV_ITEMS,
  SHADE_BG,
  SHADE_TEXT,
  fmtPeso,
  fmtTime,
  shadeLevel,
} from "../_mock";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export default function DashV4() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-zinc-100 bg-white">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-8 py-5">
          <div className="flex items-center gap-8">
            <span className="font-heading text-xl tracking-tight text-ink">
              {MOCK_BUSINESS.name}
            </span>
            <nav className="hidden gap-6 lg:flex">
              {NAV_ITEMS.map((n) => (
                <a
                  key={n.key}
                  className="text-sm text-zinc-600 transition hover:text-ink"
                >
                  {n.label}
                </a>
              ))}
            </nav>
          </div>
          <div className="text-sm text-zinc-600">김태호 · 로그아웃</div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl px-8 py-8">
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          {/* Big calendar */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-6">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
                  CALENDAR
                </span>
                <h1 className="font-heading mt-1 text-3xl tracking-tight text-ink">
                  {MOCK_MONTH_LABEL} 예약 현황
                </h1>
                <div className="mt-1 text-sm text-zinc-500">
                  총 {MOCK_TOTAL_MONTH_BOOKINGS}건 · 일평균{" "}
                  {(MOCK_TOTAL_MONTH_BOOKINGS / MOCK_MONTH_DAYS).toFixed(1)}건
                </div>
              </div>
              <div className="flex gap-2">
                <button className="rounded border border-zinc-200 px-2.5 py-1 text-xs text-zinc-700">
                  ‹ 이전 달
                </button>
                <button className="rounded border border-zinc-200 px-2.5 py-1 text-xs text-zinc-700">
                  다음 달 ›
                </button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-7 gap-1.5 text-center">
              {WEEKDAYS.map((w) => (
                <span
                  key={w}
                  className="pb-2 text-xs font-medium text-zinc-400"
                >
                  {w}
                </span>
              ))}
              {Array.from({ length: MOCK_MONTH_START_WEEKDAY }).map((_, i) => (
                <div key={`pad-${i}`} />
              ))}
              {MOCK_MONTH.map((d) => {
                const lvl = shadeLevel(d.total);
                if (d.isClosed) {
                  return (
                    <div
                      key={d.day}
                      className="relative flex aspect-[5/4] flex-col rounded-md bg-zinc-50/50 p-2 text-left"
                    >
                      <div className="text-xs text-zinc-300">{d.day}</div>
                      <div className="mt-auto text-[10px] text-zinc-400">
                        휴무
                      </div>
                    </div>
                  );
                }
                return (
                  <div
                    key={d.day}
                    className={`relative flex aspect-[5/4] flex-col rounded-md p-2 text-left ${SHADE_BG[lvl]} ${
                      d.isToday ? "ring-2 ring-ink" : ""
                    }`}
                    title={
                      d.total === 0
                        ? `${d.day}일 — 예약 없음`
                        : `${d.day}일\nPT ${d.pt}건\n그룹 ${d.group}건\n자유 ${d.free}건\n노쇼 ${d.noShow}건`
                    }
                  >
                    <div className="flex items-start justify-between">
                      <span
                        className={`text-sm font-medium ${SHADE_TEXT[lvl]}`}
                      >
                        {d.day}
                      </span>
                      {d.group > 0 && (
                        <span className="h-1.5 w-1.5 rounded-full bg-ink" />
                      )}
                    </div>
                    {d.total > 0 && (
                      <div className="mt-auto">
                        <div
                          className={`font-heading text-lg tabular-nums leading-none ${SHADE_TEXT[lvl]}`}
                        >
                          {d.total}
                        </div>
                        <div className="text-[9px] text-zinc-500">
                          PT {d.pt} · 그룹 {d.group}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex gap-5 text-[10px] text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-zinc-50 ring-1 ring-zinc-200" />
                예약 0건
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-zinc-200" />
                평균 이하
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-zinc-300" />
                성수기
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-ink" />
                단체 수업 있음
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-zinc-50/50" />
                휴무
              </span>
            </div>
          </section>

          {/* Right side */}
          <aside className="space-y-4">
            <section className="rounded-2xl border border-zinc-200 bg-white p-5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink/60">
                TODAY · {MOCK_TODAY.display}
              </span>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <BigKpi label="예약" value={MOCK_KPI.todayBookings} />
                <BigKpi
                  label="활성"
                  value={`${MOCK_KPI.activeMembers}/${MOCK_KPI.totalCustomersEver}`}
                />
                <BigKpi label="트레이너" value={MOCK_KPI.todayShiftStaff} />
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink/60">
                TIMELINE
              </span>
              <h2 className="font-heading text-base tracking-tight text-ink">
                오늘 일정
              </h2>
              <ol className="mt-3 space-y-2 text-sm">
                {MOCK_RESERVATIONS_TODAY.map((r) => {
                  const isActive = r.status === "IN_PROGRESS";
                  const isPast = r.status === "COMPLETED";
                  return (
                    <li
                      key={r.id}
                      className="flex items-center gap-2.5 border-b border-zinc-100 pb-2 last:border-0"
                    >
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          isActive
                            ? "bg-ink"
                            : isPast
                              ? "bg-zinc-300"
                              : "border border-zinc-300 bg-white"
                        }`}
                      />
                      <span className="w-12 shrink-0 tabular-nums text-zinc-500">
                        {fmtTime(r.startMin)}
                      </span>
                      <span className="flex-1 truncate text-ink">
                        {r.customer}
                      </span>
                      {isActive && (
                        <span className="rounded-full bg-ink px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-white">
                          진행중
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink/60">
                REVENUE · 이번 달
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-heading text-3xl tabular-nums tracking-tight text-ink">
                  {fmtPeso(MOCK_KPI.revenueThisMonth)}
                </span>
                <span className="text-xs font-medium text-emerald-700">
                  +{(MOCK_KPI.revenueDelta * 100).toFixed(0)}%
                </span>
              </div>
              <div className="mt-3 flex h-12 items-end gap-1">
                {[40, 55, 38, 62, 71, 48, 80].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-sm bg-zinc-300"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </section>
          </aside>
        </div>
      </main>

      <footer className="border-t border-zinc-100 bg-white">
        <div className="mx-auto flex max-w-screen-2xl flex-col gap-1 px-8 py-6 text-sm text-zinc-600 sm:flex-row sm:justify-between">
          <span>{MOCK_BUSINESS.address}</span>
          <span>{MOCK_BUSINESS.phone}</span>
          <span>{MOCK_BUSINESS.email}</span>
        </div>
      </footer>
    </div>
  );
}

function BigKpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink/60">
        {label}
      </div>
      <div className="font-heading text-2xl tabular-nums tracking-tight text-ink">
        {value}
      </div>
    </div>
  );
}
