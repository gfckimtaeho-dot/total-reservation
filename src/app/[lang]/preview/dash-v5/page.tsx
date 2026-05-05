// v5 — Tablet-Optimized
// 태블릿 가로(1024~1366px) 우선. 큰 카드, 큰 터치 영역, bottom nav.
// 32" 풀스크린에서도 시원함 유지.

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

export default function DashV5() {
  const inProgress = MOCK_RESERVATIONS_TODAY.filter(
    (r) => r.status === "IN_PROGRESS",
  ).length;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-zinc-100 bg-white">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-8 py-6">
          <div>
            <span className="font-heading text-2xl tracking-tight text-ink">
              {MOCK_BUSINESS.name}
            </span>
            <div className="mt-0.5 text-xs text-zinc-500">
              {MOCK_TODAY.display}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="h-12 rounded-full border border-zinc-200 px-5 text-sm font-medium text-zinc-700">
              + 새 예약
            </button>
            <button className="h-12 w-12 rounded-full border border-zinc-200 text-sm font-medium text-zinc-700">
              김
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-screen-2xl flex-1 px-8 py-8 pb-28">
        {/* Top KPI: 3 large cards */}
        <section className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <BigCard
            eyebrow="오늘 예약"
            value={String(MOCK_KPI.todayBookings)}
            sub="건"
            footer={inProgress > 0 ? `진행중 ${inProgress}건` : "예약 흐름 정상"}
            highlight={inProgress > 0}
          />
          <BigCard
            eyebrow="활성 회원"
            value={String(MOCK_KPI.activeMembers)}
            sub={`/ ${MOCK_KPI.totalCustomersEver}명`}
            footer={`갱신율 ${Math.round((MOCK_KPI.activeMembers / MOCK_KPI.totalCustomersEver) * 100)}%`}
          />
          <BigCard
            eyebrow="오늘 근무 트레이너"
            value={String(MOCK_KPI.todayShiftStaff)}
            sub="명"
            footer="박코치 · 정코치 · 한코치 · 외 3명"
          />
        </section>

        {/* 2x split: timeline + heatmap */}
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <section className="rounded-3xl border border-zinc-200 bg-white p-7">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
                  TIMELINE
                </span>
                <h2 className="font-heading text-2xl tracking-tight text-ink">
                  오늘의 일정
                </h2>
              </div>
            </div>
            <ol className="mt-6 space-y-3">
              {MOCK_RESERVATIONS_TODAY.map((r) => {
                const isActive = r.status === "IN_PROGRESS";
                const isPast = r.status === "COMPLETED";
                return (
                  <li
                    key={r.id}
                    className={`flex items-center gap-4 rounded-2xl border p-4 text-base ${
                      isActive
                        ? "border-ink bg-zinc-50"
                        : isPast
                          ? "border-zinc-100 opacity-60"
                          : "border-zinc-200"
                    }`}
                  >
                    <span
                      className={`h-3 w-3 shrink-0 rounded-full ${
                        isActive
                          ? "bg-ink"
                          : isPast
                            ? "bg-zinc-300"
                            : "border border-zinc-300 bg-white"
                      }`}
                    />
                    <span className="w-16 shrink-0 font-medium tabular-nums text-zinc-500">
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
                      <div className="mt-0.5 text-sm text-zinc-500">
                        {r.service} · {r.staff}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="rounded-3xl border border-zinc-200 bg-white p-7">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
                  CALENDAR
                </span>
                <h2 className="font-heading text-2xl tracking-tight text-ink">
                  {MOCK_MONTH_LABEL}
                </h2>
              </div>
              <span className="text-sm text-zinc-500">
                총 {MOCK_TOTAL_MONTH_BOOKINGS}건
              </span>
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
                      className="relative aspect-square rounded-lg bg-zinc-50/50 p-2 text-left"
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
                    className={`relative aspect-square rounded-lg p-2 text-left ${SHADE_BG[lvl]} ${
                      d.isToday ? "ring-2 ring-ink" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span
                        className={`text-sm font-medium ${SHADE_TEXT[lvl]}`}
                      >
                        {d.day}
                      </span>
                      {d.group > 0 && (
                        <span className="h-2 w-2 rounded-full bg-ink" />
                      )}
                    </div>
                    {d.total > 0 && (
                      <div
                        className={`mt-1 font-heading text-base tabular-nums leading-none ${SHADE_TEXT[lvl]}`}
                      >
                        {d.total}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <footer className="mt-6 rounded-2xl border border-zinc-100 bg-white px-7 py-5 text-sm text-zinc-600">
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
            <span>{MOCK_BUSINESS.address}</span>
            <span>{MOCK_BUSINESS.phone}</span>
            <span>{MOCK_BUSINESS.email}</span>
          </div>
        </footer>
      </main>

      {/* Bottom nav (tablet/mobile primary) */}
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-around px-4 py-2">
          <BottomLink active label="대시보드" />
          {NAV_ITEMS.map((n) => (
            <BottomLink key={n.key} label={n.label} />
          ))}
          <BottomLink label="설정" />
        </div>
      </nav>
    </div>
  );
}

function BigCard({
  eyebrow,
  value,
  sub,
  footer,
  highlight,
}: {
  eyebrow: string;
  value: string;
  sub: string;
  footer: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border p-7 ${highlight ? "border-ink bg-zinc-50" : "border-zinc-200 bg-white"}`}
    >
      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
        {eyebrow}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-heading text-5xl tabular-nums tracking-tight text-ink">
          {value}
        </span>
        <span className="text-base text-zinc-500">{sub}</span>
      </div>
      <div className="mt-4 text-sm text-zinc-500">{footer}</div>
    </div>
  );
}

function BottomLink({ label, active }: { label: string; active?: boolean }) {
  return (
    <a
      className={`flex h-14 min-w-[88px] flex-col items-center justify-center rounded-md text-xs ${
        active ? "font-medium text-ink" : "text-zinc-600"
      }`}
    >
      {label}
    </a>
  );
}
