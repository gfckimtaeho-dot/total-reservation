// v3 — Timeline-first
// 가로형 타임라인이 화면 60%. 시간축이 가로(06:00~24:00), reservation 블록이 그 위에 펼쳐짐.
// 우측 좁은 사이드에 KPI + 미니 heatmap. 운영 위주 사장님.

import {
  MOCK_BUSINESS,
  MOCK_KPI,
  MOCK_MONTH,
  MOCK_MONTH_LABEL,
  MOCK_MONTH_START_WEEKDAY,
  MOCK_RESERVATIONS_TODAY,
  MOCK_TODAY,
  NAV_ITEMS,
  SHADE_BG,
  fmtTime,
  shadeLevel,
} from "../_mock";

const DAY_START = 6 * 60;
const DAY_END = 24 * 60;
const TOTAL_MIN = DAY_END - DAY_START;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export default function DashV3() {
  const inProgress = MOCK_RESERVATIONS_TODAY.filter(
    (r) => r.status === "IN_PROGRESS",
  ).length;
  const nowPct = Math.max(
    0,
    Math.min(100, ((MOCK_TODAY.nowMin - DAY_START) / TOTAL_MIN) * 100),
  );

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
        <div className="mb-2 flex items-baseline justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
              TIMELINE · {MOCK_TODAY.display}
            </span>
            <h1 className="font-heading mt-1 text-3xl tracking-tight text-ink">
              오늘의 일정
            </h1>
          </div>
          {inProgress > 0 && (
            <span className="rounded-full bg-ink px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-white">
              진행중 {inProgress}건
            </span>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          {/* Horizontal timeline */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-6">
            {/* hour gutter */}
            <div className="relative h-8">
              {[6, 9, 12, 15, 18, 21, 24].map((h) => {
                const pct = ((h * 60 - DAY_START) / TOTAL_MIN) * 100;
                return (
                  <span
                    key={h}
                    className="absolute -translate-x-1/2 text-[10px] font-medium text-zinc-400"
                    style={{ left: `${pct}%` }}
                  >
                    {String(h).padStart(2, "0")}:00
                  </span>
                );
              })}
            </div>

            {/* timeline rows */}
            <div className="relative space-y-2 border-t border-zinc-200 pt-3">
              {/* now indicator */}
              <span
                className="pointer-events-none absolute top-0 h-full w-px bg-ink"
                style={{ left: `${nowPct}%` }}
              />
              <span
                className="pointer-events-none absolute top-0 -translate-x-1/2 -translate-y-3 rounded-sm bg-ink px-1 text-[9px] font-medium uppercase tracking-[0.12em] text-white"
                style={{ left: `${nowPct}%` }}
              >
                NOW
              </span>

              {MOCK_RESERVATIONS_TODAY.map((r) => {
                const leftPct =
                  ((r.startMin - DAY_START) / TOTAL_MIN) * 100;
                const widthPct =
                  ((r.endMin - r.startMin) / TOTAL_MIN) * 100;
                const isActive = r.status === "IN_PROGRESS";
                const isPast = r.status === "COMPLETED";
                return (
                  <div
                    key={r.id}
                    className="relative h-12 rounded bg-zinc-50/30"
                  >
                    <div
                      className={`absolute top-1 h-10 rounded-md px-2.5 py-1 text-xs ${
                        isActive
                          ? "bg-ink text-white"
                          : isPast
                            ? "bg-zinc-100 text-zinc-500"
                            : "border border-zinc-200 bg-white text-ink"
                      }`}
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    >
                      <div className="truncate font-medium">
                        {r.customer}
                      </div>
                      <div className="truncate text-[10px] opacity-70">
                        {r.service} · {r.staff}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex gap-4 text-[10px] text-zinc-500">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-zinc-100" /> 완료
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-ink" /> 진행중
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm border border-zinc-300 bg-white" /> 예정
              </span>
            </div>
          </section>

          {/* Right side: KPI + mini heatmap + revenue */}
          <aside className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <SideKpi label="오늘 예약" value={MOCK_KPI.todayBookings} sub="건" />
              <SideKpi
                label="활성 회원"
                value={`${MOCK_KPI.activeMembers}/${MOCK_KPI.totalCustomersEver}`}
              />
              <SideKpi
                label="근무 트레이너"
                value={MOCK_KPI.todayShiftStaff}
                sub="명"
              />
            </div>

            <section className="rounded-2xl border border-zinc-200 bg-white p-4">
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink/60">
                MINI HEATMAP · {MOCK_MONTH_LABEL}
              </span>
              <div className="mt-3 grid grid-cols-7 gap-0.5">
                {WEEKDAYS.map((w) => (
                  <span
                    key={w}
                    className="pb-1 text-center text-[9px] font-medium text-zinc-400"
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
                        className="aspect-square rounded-sm bg-zinc-50/50"
                      />
                    );
                  }
                  return (
                    <div
                      key={d.day}
                      className={`relative aspect-square rounded-sm ${SHADE_BG[lvl]} ${d.isToday ? "ring-1 ring-ink" : ""}`}
                      title={
                        d.total === 0
                          ? `${d.day}일`
                          : `${d.day}일 — ${d.total}건`
                      }
                    >
                      {d.group > 0 && (
                        <span className="absolute right-0.5 top-0.5 h-0.5 w-0.5 rounded-full bg-ink" />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-4">
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink/60">
                REVENUE · 7일
              </span>
              <div className="mt-3 flex h-14 items-end gap-1">
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

function SideKpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink/60">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="font-heading text-2xl tabular-nums tracking-tight text-ink">
          {value}
        </span>
        {sub && <span className="text-xs text-zinc-500">{sub}</span>}
      </div>
    </div>
  );
}
