// v2 — 32" Dense Grid
// 좌 sticky sidebar nav + 우 4-zone main. 정보 밀도 최대화. 32인치에서 스크롤 0.

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

export default function DashV2() {
  const inProgress = MOCK_RESERVATIONS_TODAY.filter(
    (r) => r.status === "IN_PROGRESS",
  ).length;

  return (
    <div className="flex min-h-screen bg-zinc-50">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-zinc-200 bg-white lg:flex lg:flex-col">
        <div className="border-b border-zinc-100 px-6 py-6">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
            STUDIO
          </span>
          <div className="mt-1 font-heading text-lg tracking-tight text-ink">
            {MOCK_BUSINESS.name}
          </div>
          <div className="mt-0.5 text-xs text-zinc-500">
            /g/{MOCK_BUSINESS.slug}
          </div>
        </div>
        <nav className="flex-1 px-3 py-4">
          <a className="flex items-center rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium text-ink">
            대시보드
          </a>
          {NAV_ITEMS.map((n) => (
            <a
              key={n.key}
              className="flex items-center rounded-md px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50 hover:text-ink"
            >
              {n.label}
            </a>
          ))}
        </nav>
        <div className="border-t border-zinc-100 px-3 py-4">
          <a className="flex items-center rounded-md px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50 hover:text-ink">
            설정
          </a>
          <a className="flex items-center rounded-md px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50 hover:text-ink">
            로그아웃
          </a>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-x-hidden">
        <header className="border-b border-zinc-200 bg-white px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
                DASHBOARD
              </span>
              <h1 className="font-heading mt-0.5 text-xl tracking-tight text-ink">
                {MOCK_TODAY.display}
              </h1>
            </div>
            <div className="flex gap-2">
              <button className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700">
                + 직원
              </button>
              <button className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700">
                + 회원
              </button>
              <button className="rounded-md bg-ink px-3 py-1.5 text-xs text-white">
                + 새 예약
              </button>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-4 p-6">
          {/* KPI strip — 4 columns */}
          <DenseKpi label="오늘 예약" value={MOCK_KPI.todayBookings} sub="건" />
          <DenseKpi
            label="활성 회원"
            value={`${MOCK_KPI.activeMembers}/${MOCK_KPI.totalCustomersEver}`}
          />
          <DenseKpi
            label="근무 트레이너"
            value={MOCK_KPI.todayShiftStaff}
            sub="명"
          />
          <DenseKpi label="월 매출" value={fmtPeso(MOCK_KPI.revenueThisMonth)} delta={`+${(MOCK_KPI.revenueDelta * 100).toFixed(0)}%`} />

          {/* Timeline — col-span 5 */}
          <section className="col-span-12 rounded-xl border border-zinc-200 bg-white p-5 xl:col-span-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink/60">
                  TIMELINE
                </span>
                <h2 className="font-heading text-base tracking-tight text-ink">
                  오늘의 일정
                </h2>
              </div>
              {inProgress > 0 && (
                <span className="rounded-full bg-ink px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-white">
                  진행중 {inProgress}
                </span>
              )}
            </div>
            <ol className="mt-4 space-y-2">
              {MOCK_RESERVATIONS_TODAY.map((r) => {
                const isActive = r.status === "IN_PROGRESS";
                const isPast = r.status === "COMPLETED";
                return (
                  <li
                    key={r.id}
                    className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                      isActive
                        ? "border-ink bg-zinc-50"
                        : "border-zinc-100"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        isActive ? "bg-ink" : isPast ? "bg-zinc-300" : "border border-zinc-300 bg-white"
                      }`}
                    />
                    <span className="w-12 shrink-0 tabular-nums text-zinc-500">
                      {fmtTime(r.startMin)}
                    </span>
                    <span className="flex-1 font-medium text-ink">
                      {r.customer}
                    </span>
                    <span className="text-xs text-zinc-500">{r.staff}</span>
                    {r.serviceType === "GROUP" && (
                      <span className="rounded-full border border-zinc-200 px-1.5 py-0.5 text-[9px] text-zinc-600">
                        {r.enrolled}/{r.capacity}
                      </span>
                    )}
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

          {/* Heatmap — col-span 7 */}
          <section className="col-span-12 rounded-xl border border-zinc-200 bg-white p-5 xl:col-span-7">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink/60">
                  CALENDAR
                </span>
                <h2 className="font-heading text-base tracking-tight text-ink">
                  {MOCK_MONTH_LABEL} · 총 {MOCK_TOTAL_MONTH_BOOKINGS}건
                </h2>
              </div>
              <div className="flex gap-1">
                <button className="rounded border border-zinc-200 px-2 py-0.5 text-xs">‹</button>
                <button className="rounded border border-zinc-200 px-2 py-0.5 text-xs">›</button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS.map((w) => (
                <span
                  key={w}
                  className="pb-1 text-[10px] font-medium text-zinc-400"
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
                      className="relative aspect-square rounded-sm bg-zinc-50/50 p-1 text-left"
                    >
                      <div className="text-[10px] text-zinc-300">{d.day}</div>
                      <div className="absolute inset-0 flex items-center justify-center text-[9px] text-zinc-400">
                        휴
                      </div>
                    </div>
                  );
                }
                return (
                  <div
                    key={d.day}
                    className={`relative aspect-square rounded-sm p-1 text-left ${SHADE_BG[lvl]} ${
                      d.isToday ? "ring-1 ring-ink" : ""
                    }`}
                    title={
                      d.total === 0
                        ? `${d.day}일 — 예약 없음`
                        : `${d.day}일\nPT ${d.pt}건\n그룹 ${d.group}건\n자유 ${d.free}건\n노쇼 ${d.noShow}건`
                    }
                  >
                    <div className="flex items-start justify-between">
                      <span className={`text-[10px] font-medium ${SHADE_TEXT[lvl]}`}>
                        {d.day}
                      </span>
                      {d.group > 0 && (
                        <span className="h-1 w-1 rounded-full bg-ink" />
                      )}
                    </div>
                    {d.total > 0 && (
                      <div
                        className={`text-[10px] tabular-nums ${SHADE_TEXT[lvl]}`}
                      >
                        {d.total}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Aux: 매출 sparkline mock — col-span 6 */}
          <section className="col-span-12 rounded-xl border border-zinc-200 bg-white p-5 xl:col-span-6">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink/60">
              REVENUE · 7일
            </span>
            <h2 className="font-heading text-base tracking-tight text-ink">
              매출 추이
            </h2>
            <div className="mt-4 flex h-20 items-end gap-1.5">
              {[40, 55, 38, 62, 71, 48, 80].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm bg-zinc-200"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </section>

          {/* Aux: 멤버십 만료 임박 — col-span 6 */}
          <section className="col-span-12 rounded-xl border border-zinc-200 bg-white p-5 xl:col-span-6">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink/60">
              MEMBERSHIP · 7일 내 만료
            </span>
            <h2 className="font-heading text-base tracking-tight text-ink">
              갱신 권유 대상
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm">
              {[
                { name: "이서연", until: "2026-05-08" },
                { name: "박지훈", until: "2026-05-09" },
                { name: "최유진", until: "2026-05-11" },
              ].map((m) => (
                <li
                  key={m.name}
                  className="flex items-center justify-between rounded border border-zinc-100 px-3 py-1.5"
                >
                  <span className="text-ink">{m.name}</span>
                  <span className="text-xs text-zinc-500">~ {m.until}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <footer className="border-t border-zinc-100 bg-white px-8 py-4 text-xs text-zinc-500">
          {MOCK_BUSINESS.address} · {MOCK_BUSINESS.phone} ·{" "}
          {MOCK_BUSINESS.email}
        </footer>
      </main>
    </div>
  );
}

function DenseKpi({
  label,
  value,
  sub,
  delta,
}: {
  label: string;
  value: string | number;
  sub?: string;
  delta?: string;
}) {
  return (
    <div className="col-span-6 rounded-xl border border-zinc-200 bg-white p-4 lg:col-span-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink/60">
          {label}
        </span>
        {delta && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
            {delta}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-heading text-3xl tabular-nums tracking-tight text-ink">
          {value}
        </span>
        {sub && <span className="text-xs text-zinc-500">{sub}</span>}
      </div>
    </div>
  );
}
