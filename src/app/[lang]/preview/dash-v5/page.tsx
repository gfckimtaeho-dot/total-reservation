// v5 — Editorial Bold (다른 컨셉 #3)
// 큰 serif typography + 노란 highlighter accent. 잡지 편집 디자인.

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
const SHADE_BG = ["bg-zinc-50", "bg-yellow-100", "bg-yellow-200", "bg-yellow-300"] as const;
const SHADE_TEXT = ["text-zinc-300", "text-ink/70", "text-ink/85", "text-ink"] as const;

export default function DashV5() {
  const buckets = groupByHour(MOCK_RESERVATIONS_TODAY);

  return (
    <div className="flex min-h-screen bg-white">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-ink lg:flex">
        <div className="border-b border-ink px-6 py-6">
          <div className="font-heading text-2xl italic tracking-tight text-ink">
            {MOCK_BUSINESS.name}
          </div>
          <div className="mt-0.5 text-xs text-zinc-500">/g/{MOCK_BUSINESS.slug}</div>
        </div>
        <nav className="flex-1 px-3 py-4">
          <a className="flex items-center rounded-none border-l-4 border-yellow-400 bg-yellow-50 px-3 py-2 text-sm font-medium text-ink">
            대시보드
          </a>
          {NAV_ITEMS.map((n) => (
            <a key={n.key} className="flex items-center px-3 py-2 text-sm text-zinc-700 transition hover:bg-yellow-50 hover:text-ink">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="border-t border-ink/10 px-3 py-4">
          <a className="flex items-center px-3 py-2 text-sm text-zinc-700 hover:text-ink">로그아웃</a>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <header className="border-b border-ink px-8 py-7">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
            DASHBOARD · {MOCK_TODAY.display}
          </span>
          <h1 className="font-heading mt-2 text-4xl tracking-tight text-ink">
            <span className="bg-yellow-300 px-1 italic">스트롱 헬스</span>의 하루
          </h1>
        </header>

        <div className="grid grid-cols-12 gap-6 p-8">
          <BoldKpi label="오늘 예약" value={MOCK_KPI.todayBookings} sub="건" highlight={MOCK_KPI.inProgress > 0 ? `진행중 ${MOCK_KPI.inProgress}` : undefined} />
          <BoldKpi label="활성 회원" value={`${MOCK_KPI.activeMembers}/${MOCK_KPI.totalCustomersEver}`} sub="명" />
          <BoldKpi label="오늘 근무" value={MOCK_KPI.todayShiftStaff} sub="명" />

          <section className="col-span-12 border-t-2 border-ink pt-6 xl:col-span-5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink/60">
              TIMELINE
            </span>
            <h2 className="font-heading mt-1 text-2xl tracking-tight text-ink">
              오늘의 <span className="italic">일정</span>
            </h2>
            <ol className="mt-5 space-y-4">
              {buckets.map((b) => (
                <li key={b.startMin} className="grid grid-cols-[64px_1fr] gap-4 border-b border-zinc-100 pb-4 last:border-0">
                  <div className="font-heading pt-1 text-lg tabular-nums tracking-tight text-ink">
                    {fmtTime(b.startMin)}
                  </div>
                  <div className={`grid gap-2 ${b.items.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                    {b.items.map((r) => {
                      const isActive = r.status === "IN_PROGRESS";
                      const isPast = r.status === "COMPLETED";
                      const isGroup = r.serviceType === "GROUP";
                      return (
                        <div key={r.id} className={isPast ? "opacity-50" : ""}>
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-heading text-lg tracking-tight ${
                                isActive
                                  ? "bg-yellow-300 px-1 italic text-ink"
                                  : "text-ink"
                              }`}
                            >
                              {r.customer}
                            </span>
                            {isActive && (
                              <span className="rounded-none bg-ink px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-yellow-300">
                                LIVE
                              </span>
                            )}
                            {isGroup && (
                              <span className="rounded-none border border-ink px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-ink">
                                그룹 {r.enrolled}/{r.capacity}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-sm text-zinc-600">
                            {r.service} · <span className="italic">{r.staff}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="col-span-12 border-t-2 border-ink pt-6 xl:col-span-7">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink/60">
                  CALENDAR
                </span>
                <h2 className="font-heading mt-1 text-2xl tracking-tight text-ink">
                  {MOCK_MONTH_LABEL} <span className="italic">예약 현황</span>
                </h2>
              </div>
              <span className="font-heading text-2xl italic text-ink/60">
                {MOCK_TOTAL_MONTH_BOOKINGS}
              </span>
            </div>
            <YellowCalendarGrid />
          </section>

          <section className="col-span-12 border-t-2 border-ink pt-6">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink/60">
              MEMBERSHIP · 7일 내 만료
            </span>
            <h2 className="font-heading mt-1 text-2xl tracking-tight text-ink">
              <span className="bg-yellow-300 px-1 italic">갱신 권유</span> 대상
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {MOCK_EXPIRING.map((m) => (
                <li
                  key={m.name}
                  className="flex items-baseline justify-between border-b border-ink/30 pb-2"
                >
                  <span className="font-heading text-lg tracking-tight text-ink">
                    {m.name}
                  </span>
                  <span className="text-xs text-zinc-600">D-{m.daysLeft}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <footer className="border-t-2 border-ink px-8 py-6 text-xs text-zinc-500">
          {MOCK_BUSINESS.address} · {MOCK_BUSINESS.phone} · {MOCK_BUSINESS.email}
        </footer>
      </main>
    </div>
  );
}

function BoldKpi({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string | number;
  sub: string;
  highlight?: string;
}) {
  return (
    <div className="col-span-12 sm:col-span-6 lg:col-span-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink/60">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-heading text-6xl tabular-nums italic tracking-tight text-ink">
          {value}
        </span>
        <span className="text-sm text-zinc-500">{sub}</span>
      </div>
      {highlight && (
        <div className="mt-2 inline-block bg-yellow-300 px-2 py-0.5 text-xs font-medium text-ink">
          {highlight}
        </div>
      )}
    </div>
  );
}

function YellowCalendarGrid() {
  return (
    <div className="mt-5 grid grid-cols-7 gap-1.5 text-center">
      {WEEKDAYS.map((w) => (
        <span key={w} className="pb-2 text-[11px] font-medium text-zinc-500">
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
            <div key={d.day} className="relative aspect-square bg-zinc-50 p-1.5 text-left">
              <div className="text-xs text-zinc-300">{d.day}</div>
              <div className="absolute inset-0 flex items-center justify-center text-[10px] text-zinc-400">휴</div>
            </div>
          );
        }
        return (
          <div
            key={d.day}
            className={`relative aspect-square p-1.5 text-left ${SHADE_BG[lvl]} ${d.isToday ? "ring-2 ring-ink" : ""}`}
            title={d.total === 0 ? `${d.day}일 — 예약 없음` : `${d.day}일\nPT ${d.pt}건\n그룹 ${d.group}건\n자유 ${d.free}건\n노쇼 ${d.noShow}건`}
          >
            <div className="flex items-start justify-between">
              <span className={`font-heading text-sm italic ${SHADE_TEXT[lvl]}`}>{d.day}</span>
              {d.group > 0 && <span className="h-1.5 w-1.5 rounded-full bg-ink" />}
            </div>
            {d.total > 0 && (
              <div className={`font-heading mt-0.5 text-base tabular-nums italic ${SHADE_TEXT[lvl]}`}>
                {d.total}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
