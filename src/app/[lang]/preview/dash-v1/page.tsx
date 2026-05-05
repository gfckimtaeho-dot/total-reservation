// v1 — Editorial Calm
// mainpage.png Mindbody 톤 가장 충실. 큰 여백, serif numerals, 카드 경계 옅음.
// 사용자 의견 1~4 레이아웃 그대로: top nav → KPI 3카드 → 좌 timeline + 우 heatmap → footer.

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
  fmtTime,
  shadeLevel,
} from "../_mock";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export default function DashV1() {
  const inProgress = MOCK_RESERVATIONS_TODAY.filter(
    (r) => r.status === "IN_PROGRESS",
  ).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* 1. Top bar */}
      <header className="border-b border-zinc-100 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-6">
          <span className="font-heading text-2xl tracking-tight text-ink">
            {MOCK_BUSINESS.name}
          </span>
          <nav className="hidden gap-8 lg:flex">
            {NAV_ITEMS.map((n) => (
              <a
                key={n.key}
                className="text-sm text-zinc-700 transition hover:text-ink"
              >
                {n.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
              OWNER
            </span>
            <span className="text-zinc-700">김태호</span>
            <a className="text-zinc-700 transition hover:text-ink">로그아웃</a>
          </div>
        </div>
      </header>

      {/* 2. KPI strip */}
      <section className="border-b border-zinc-100 bg-white">
        <div className="mx-auto max-w-7xl px-8 py-12">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
            TODAY · {MOCK_TODAY.display}
          </span>
          <div className="mt-6 grid grid-cols-1 gap-10 sm:grid-cols-3">
            <Kpi label="오늘 예약" value={String(MOCK_KPI.todayBookings)} sub="건" />
            <Kpi
              label="활성 회원"
              value={`${MOCK_KPI.activeMembers}/${MOCK_KPI.totalCustomersEver}`}
              sub="명"
            />
            <Kpi
              label="오늘 근무 트레이너"
              value={String(MOCK_KPI.todayShiftStaff)}
              sub="명"
            />
          </div>
        </div>
      </section>

      {/* 3. Main grid: timeline + heatmap */}
      <main className="mx-auto max-w-7xl px-8 py-12">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.1fr]">
          {/* Timeline */}
          <section>
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
                  TIMELINE
                </span>
                <h2 className="font-heading mt-1 text-2xl tracking-tight text-ink">
                  오늘의 일정
                </h2>
              </div>
              {inProgress > 0 && (
                <span className="rounded-full bg-ink px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-white">
                  진행중 {inProgress}건
                </span>
              )}
            </div>

            <ol className="mt-8 space-y-4">
              {MOCK_RESERVATIONS_TODAY.map((r) => {
                const isActive = r.status === "IN_PROGRESS";
                const isPast = r.status === "COMPLETED";
                return (
                  <li
                    key={r.id}
                    className="flex items-start gap-5 border-l border-zinc-100 pl-6 relative"
                  >
                    <span
                      className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ${
                        isActive
                          ? "bg-ink"
                          : isPast
                            ? "bg-zinc-300"
                            : "border border-zinc-300 bg-white"
                      }`}
                    />
                    <span className="w-14 shrink-0 pt-0.5 text-sm tabular-nums text-zinc-500">
                      {fmtTime(r.startMin)}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink">
                          {r.customer}
                        </span>
                        {isActive && (
                          <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-white">
                            진행중
                          </span>
                        )}
                        {r.serviceType === "GROUP" && (
                          <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] text-zinc-600">
                            그룹 {r.enrolled}/{r.capacity}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500">
                        {r.service} · {r.staff}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Heatmap */}
          <section>
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
                  CALENDAR
                </span>
                <h2 className="font-heading mt-1 text-2xl tracking-tight text-ink">
                  {MOCK_MONTH_LABEL} 예약 현황
                </h2>
              </div>
              <span className="text-sm text-zinc-500">
                총 {MOCK_TOTAL_MONTH_BOOKINGS}건
              </span>
            </div>

            <div className="mt-8">
              <div className="grid grid-cols-7 gap-1.5 text-center">
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
                  const hasGroup = d.group > 0 && !d.isClosed;
                  if (d.isClosed) {
                    return (
                      <div
                        key={d.day}
                        className="relative aspect-square rounded-md bg-zinc-50/50 p-1.5 text-left"
                      >
                        <div className="text-xs text-zinc-300">{d.day}</div>
                        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-zinc-400">
                          휴
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={d.day}
                      className={`relative aspect-square rounded-md p-1.5 text-left ${SHADE_BG[lvl]} ${
                        d.isToday ? "ring-1 ring-ink" : ""
                      }`}
                      title={
                        d.total === 0
                          ? `${d.day}일 — 예약 없음`
                          : `${d.day}일\nPT ${d.pt}건\n그룹 ${d.group}건\n자유 ${d.free}건\n노쇼 ${d.noShow}건`
                      }
                    >
                      <div className="flex items-start justify-between">
                        <span className={`text-xs font-medium ${SHADE_TEXT[lvl]}`}>
                          {d.day}
                        </span>
                        {hasGroup && (
                          <span className="h-1.5 w-1.5 rounded-full bg-ink" />
                        )}
                      </div>
                      {d.total > 0 && (
                        <div
                          className={`mt-1 text-[11px] tabular-nums ${SHADE_TEXT[lvl]}`}
                        >
                          {d.total}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-xs text-zinc-500">
                농도 = 일별 예약 총수 · 점 = 단체 수업 있는 날 · 회색 = 휴무
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* 4. Footer */}
      <footer className="border-t border-zinc-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-8 py-8 text-sm text-zinc-600 sm:flex-row sm:justify-between">
          <span>{MOCK_BUSINESS.address}</span>
          <span>{MOCK_BUSINESS.phone}</span>
          <span>{MOCK_BUSINESS.email}</span>
        </div>
      </footer>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-ink/60">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-heading text-5xl tabular-nums tracking-tight text-ink">
          {value}
        </span>
        <span className="text-sm text-zinc-500">{sub}</span>
      </div>
    </div>
  );
}
