// 공유 shell — Normal(라임 사이드바) 디자인 5변형
// 흰색 과다 + 시간/날짜 셀 구분 약함을 푸는 5가지 방향
// 각 시안의 차이는 token 객체로 표현. zebra/grid 같은 구조 변형은 flag로.

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
} from "./_mock";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export type VariantName = "sand" | "zebra" | "grid" | "tinted" | "paper";

type Tokens = {
  label: string;
  gist: string;
  pageBg: string;
  mainHeaderBorder: string;
  eyebrowText: string;
  // KPI
  kpiCard: string;
  kpiBadge: string;
  // Timeline
  timelineWrap: string;
  timelineList: string;        // ol class
  timelineRowGap: string;      // <li> spacing override
  timelineRowZebra: boolean;   // alternating bg per hour bucket
  timelineRowZebraEven: string;
  timelineRowZebraOdd: string;
  timelineHourCol: string;     // 시간 라벨 컬럼 추가 스타일
  timelineDefaultItem: string;
  timelineActiveItem: string;
  timelineGroupItem: string;
  timelinePastItem: string;
  // Calendar
  calendarWrap: string;
  calendarHeader: string;      // weekday header tone
  calendarGridGap: string;     // gap between cells
  calendarCellBase: string;    // base cell bg + border
  calendarCellToday: string;
  calendarCellClosed: string;
  calendarPtBar: string;
  calendarGroupBar: string;
  // Membership
  membershipWrap: string;
  membershipItem: string;
};

export const VARIANTS: Record<VariantName, Tokens> = {
  // v1 — Sand: 따뜻한 회베이지 배경 + 흰 카드. 흰색 overload 해소.
  sand: {
    label: "v1 — Sand",
    gist: "따뜻한 stone-50 배경 + 흰 카드. 시간 row hairline divider, 달력 셀에 진한 stone border. 흰 과다 해결.",
    pageBg: "bg-stone-50",
    mainHeaderBorder: "border-stone-200",
    eyebrowText: "text-ink/60",
    kpiCard: "border border-stone-200 bg-white",
    kpiBadge: "bg-band text-ink",
    timelineWrap: "border border-stone-200 bg-white",
    timelineList: "mt-5 divide-y divide-stone-100",
    timelineRowGap: "py-3 first:pt-0 last:pb-0",
    timelineRowZebra: false,
    timelineRowZebraEven: "",
    timelineRowZebraOdd: "",
    timelineHourCol: "text-ink/70",
    timelineDefaultItem: "border border-stone-200 border-l-zinc-300 bg-white",
    timelineActiveItem: "border-l-ink bg-band",
    timelineGroupItem: "border-l-emerald-500 bg-emerald-50/70",
    timelinePastItem: "border-l-stone-200 bg-stone-100/60 opacity-60",
    calendarWrap: "border border-stone-200 bg-white",
    calendarHeader: "text-stone-500",
    calendarGridGap: "gap-1.5",
    calendarCellBase: "border border-stone-200 bg-white",
    calendarCellToday: "ring-2 ring-ink",
    calendarCellClosed: "bg-stone-300/70 text-stone-600",
    calendarPtBar: "bg-ink",
    calendarGroupBar: "bg-emerald-500",
    membershipWrap: "bg-band/40 ring-1 ring-stone-200",
    membershipItem: "bg-white ring-1 ring-stone-200",
  },

  // v2 — Zebra: 시간 row 짝/홀 stripe + 달력은 평일/주말 미세 톤. 흰 유지 + stripe로 구분.
  zebra: {
    label: "v2 — Zebra",
    gist: "흰 배경 유지 + 시간 row 짝/홀 zebra stripe + 달력 평일·주말 미세 톤 차이. 줄무늬로 구분.",
    pageBg: "bg-white",
    mainHeaderBorder: "border-zinc-200",
    eyebrowText: "text-ink/60",
    kpiCard: "border border-zinc-200 bg-white",
    kpiBadge: "bg-band text-ink",
    timelineWrap: "border border-zinc-200 bg-white",
    timelineList: "mt-5",
    timelineRowGap: "rounded-md px-3 py-3",
    timelineRowZebra: true,
    timelineRowZebraEven: "bg-zinc-50",
    timelineRowZebraOdd: "bg-white",
    timelineHourCol: "text-ink/80",
    timelineDefaultItem: "border border-zinc-200 border-l-zinc-300 bg-white",
    timelineActiveItem: "border-l-ink bg-band shadow-sm",
    timelineGroupItem: "border-l-emerald-500 bg-emerald-50/70",
    timelinePastItem: "border-l-zinc-200 bg-zinc-50 opacity-60",
    calendarWrap: "border border-zinc-200 bg-white",
    calendarHeader: "text-zinc-500",
    calendarGridGap: "gap-1.5",
    calendarCellBase: "border border-zinc-200 bg-white",
    calendarCellToday: "ring-2 ring-ink",
    calendarCellClosed: "bg-zinc-300 text-zinc-600",
    calendarPtBar: "bg-ink",
    calendarGroupBar: "bg-emerald-500",
    membershipWrap: "bg-band/40 ring-1 ring-zinc-200",
    membershipItem: "bg-white ring-1 ring-ink/10",
  },

  // v3 — Heavy Grid: 흰 유지 + 격자 진하게. timeline 진한 divider, 달력 gap-0 격자.
  grid: {
    label: "v3 — Heavy Grid",
    gist: "흰 배경 유지 + 격자선 진하게. 시간 row divide-y zinc-300, 달력 셀 gap-0 + zinc-300 격자. 분명한 grid 느낌.",
    pageBg: "bg-white",
    mainHeaderBorder: "border-zinc-300",
    eyebrowText: "text-ink/60",
    kpiCard: "border border-zinc-300 bg-white",
    kpiBadge: "bg-band text-ink",
    timelineWrap: "border-2 border-zinc-300 bg-white",
    timelineList: "mt-5 divide-y divide-zinc-300",
    timelineRowGap: "py-3 first:pt-0 last:pb-0",
    timelineRowZebra: false,
    timelineRowZebraEven: "",
    timelineRowZebraOdd: "",
    timelineHourCol: "text-ink/80",
    timelineDefaultItem: "border-2 border-zinc-300 border-l-4 border-l-zinc-400 bg-white",
    timelineActiveItem: "border-2 border-ink bg-band",
    timelineGroupItem: "border-2 border-emerald-500 bg-emerald-50/70",
    timelinePastItem: "border-2 border-zinc-200 bg-zinc-50 opacity-60",
    calendarWrap: "border-2 border-zinc-300 bg-white",
    calendarHeader: "text-zinc-600 border-b border-zinc-300 pb-3",
    calendarGridGap: "gap-0",
    calendarCellBase: "border border-zinc-300 bg-white",
    calendarCellToday: "ring-2 ring-ink z-10",
    calendarCellClosed: "bg-zinc-300 text-zinc-700",
    calendarPtBar: "bg-ink",
    calendarGroupBar: "bg-emerald-600",
    membershipWrap: "bg-white border-2 border-band ring-0",
    membershipItem: "bg-band/30 ring-1 ring-ink/15",
  },

  // v4 — Tinted Sections: 메인 약한 zinc tint + 섹션별 다른 tint depth. 카드는 white로 떠 보임.
  tinted: {
    label: "v4 — Tinted",
    gist: "메인 살짝 회색 + 섹션별 다른 tint(라임/회/회). 흰 카드가 위에 떠 보이는 depth 효과.",
    pageBg: "bg-zinc-100/60",
    mainHeaderBorder: "border-zinc-200",
    eyebrowText: "text-ink/70",
    kpiCard: "border border-band/50 bg-band/15",
    kpiBadge: "bg-ink text-white",
    timelineWrap: "ring-1 ring-zinc-200 bg-white",
    timelineList: "mt-5 space-y-1",
    timelineRowGap: "rounded-md bg-zinc-50/70 px-3 py-3",
    timelineRowZebra: false,
    timelineRowZebraEven: "",
    timelineRowZebraOdd: "",
    timelineHourCol: "text-ink/80",
    timelineDefaultItem: "border border-zinc-200 border-l-4 border-l-zinc-400 bg-white",
    timelineActiveItem: "border-l-4 border-l-ink bg-band shadow-sm",
    timelineGroupItem: "border-l-4 border-l-emerald-500 bg-emerald-50/70 ring-1 ring-emerald-200",
    timelinePastItem: "border-l-4 border-l-zinc-200 bg-zinc-50 opacity-60",
    calendarWrap: "ring-1 ring-band/50 bg-band/15",
    calendarHeader: "text-ink/70",
    calendarGridGap: "gap-1.5",
    calendarCellBase: "border border-zinc-200 bg-white",
    calendarCellToday: "ring-2 ring-ink",
    calendarCellClosed: "bg-zinc-300/70 text-zinc-600",
    calendarPtBar: "bg-ink",
    calendarGroupBar: "bg-emerald-500",
    membershipWrap: "bg-band/40 ring-1 ring-band",
    membershipItem: "bg-white ring-1 ring-ink/10",
  },

  // v5 — Paper Cream: 따뜻한 amber-50 종이 배경. 카드는 흰. weekday/시간 컬럼에 amber accent.
  paper: {
    label: "v5 — Paper Cream",
    gist: "amber-50 종이 배경 + 흰 카드. weekday header에 band accent. 따뜻한 인쇄물 느낌.",
    pageBg: "bg-amber-50/50",
    mainHeaderBorder: "border-amber-200/60",
    eyebrowText: "text-ink/60",
    kpiCard: "border border-amber-200/60 bg-white",
    kpiBadge: "bg-band text-ink",
    timelineWrap: "border border-amber-200/60 bg-white",
    timelineList: "mt-5 divide-y divide-amber-100",
    timelineRowGap: "py-3 first:pt-0 last:pb-0",
    timelineRowZebra: false,
    timelineRowZebraEven: "",
    timelineRowZebraOdd: "",
    timelineHourCol: "text-ink/70 border-r border-amber-100 pr-3",
    timelineDefaultItem: "border border-amber-200/60 border-l-zinc-300 bg-white",
    timelineActiveItem: "border-l-ink bg-band",
    timelineGroupItem: "border-l-emerald-500 bg-emerald-50/70",
    timelinePastItem: "border-l-amber-200 bg-amber-50/40 opacity-60",
    calendarWrap: "border border-amber-200/60 bg-white",
    calendarHeader: "text-ink/70 bg-band/40 rounded-t-md py-2",
    calendarGridGap: "gap-1.5",
    calendarCellBase: "border border-amber-200/60 bg-amber-50/30",
    calendarCellToday: "ring-2 ring-ink bg-white",
    calendarCellClosed: "bg-amber-200/60 text-amber-900/70",
    calendarPtBar: "bg-ink",
    calendarGroupBar: "bg-emerald-500",
    membershipWrap: "bg-amber-100/60 ring-1 ring-amber-200/60",
    membershipItem: "bg-white ring-1 ring-amber-200/60",
  },
};

export function NormalVariant({ variant }: { variant: VariantName }) {
  const t = VARIANTS[variant];
  const buckets = groupByHour(MOCK_RESERVATIONS_TODAY);

  return (
    <div className={`flex min-h-screen ${t.pageBg}`}>
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
            <a
              key={n.key}
              className="flex items-center rounded-md px-3 py-2 text-sm text-ink/80 transition hover:bg-white/40"
            >
              {n.label}
            </a>
          ))}
        </nav>
        <div className="border-t border-ink/10 px-3 py-4">
          <a className="flex items-center rounded-md px-3 py-2 text-sm text-ink/80 hover:bg-white/40">
            로그아웃
          </a>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <header
          className={`flex items-center justify-between border-b ${t.mainHeaderBorder} px-8 py-5`}
        >
          <div>
            <span
              className={`text-xs font-semibold uppercase tracking-[0.22em] ${t.eyebrowText}`}
            >
              DASHBOARD
            </span>
            <h1 className="font-heading text-xl tracking-tight text-ink">
              {MOCK_TODAY.display}
            </h1>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="rounded-full bg-ink px-3 py-1 font-semibold uppercase tracking-[0.18em] text-white">
              {t.label}
            </span>
            <span className="hidden text-zinc-600 sm:inline">{t.gist}</span>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-4 p-6">
          <KpiCard
            t={t}
            label="오늘 예약"
            value={MOCK_KPI.todayBookings}
            sub="건"
            badge={`진행중 ${MOCK_KPI.inProgress}`}
          />
          <KpiCard
            t={t}
            label="활성 회원"
            value={`${MOCK_KPI.activeMembers}/${MOCK_KPI.totalCustomersEver}`}
            sub="명"
          />
          <KpiCard
            t={t}
            label="오늘 근무"
            value={MOCK_KPI.todayShiftStaff}
            sub="명"
          />

          <section
            className={`col-span-12 rounded-2xl ${t.timelineWrap} p-6 xl:col-span-5`}
          >
            <SectionHead eyebrow="TIMELINE" title="오늘의 일정" t={t} />
            <ol className={t.timelineList}>
              {buckets.map((b, idx) => {
                const zebraBg = t.timelineRowZebra
                  ? idx % 2 === 0
                    ? t.timelineRowZebraEven
                    : t.timelineRowZebraOdd
                  : "";
                return (
                  <li
                    key={b.startMin}
                    className={`grid grid-cols-[60px_1fr] gap-4 ${t.timelineRowGap} ${zebraBg}`}
                  >
                    <div
                      className={`pt-2 text-sm font-medium tabular-nums ${t.timelineHourCol}`}
                    >
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
                        const itemCls = isActive
                          ? `border-l-4 ${t.timelineActiveItem}`
                          : isPast
                            ? `border-l-4 ${t.timelinePastItem}`
                            : isGroup
                              ? `border-l-4 ${t.timelineGroupItem}`
                              : t.timelineDefaultItem;
                        return (
                          <div
                            key={r.id}
                            className={`relative rounded-xl p-3 ${itemCls}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-ink">
                                {r.customer}
                              </span>
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
                );
              })}
            </ol>
          </section>

          <section
            className={`col-span-12 rounded-2xl ${t.calendarWrap} p-6 xl:col-span-7`}
          >
            <div className="flex items-baseline justify-between">
              <SectionHead
                eyebrow="CALENDAR"
                title={`${MOCK_MONTH_LABEL} 예약 현황`}
                t={t}
              />
              <span className="text-xs text-zinc-500">
                총 {MOCK_TOTAL_MONTH_BOOKINGS}건
              </span>
            </div>
            <CalendarGrid t={t} />
          </section>

          <section className={`col-span-12 rounded-2xl ${t.membershipWrap} p-6`}>
            <SectionHead
              eyebrow="MEMBERSHIP · 7일 내 만료"
              title="갱신 권유 대상"
              t={t}
            />
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {MOCK_EXPIRING.map((m) => (
                <li
                  key={m.name}
                  className={`flex items-center justify-between rounded-lg px-4 py-3 ${t.membershipItem}`}
                >
                  <span className="font-medium text-ink">{m.name}</span>
                  <span className="text-xs text-zinc-600">D-{m.daysLeft}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <footer
          className={`border-t ${t.mainHeaderBorder} px-8 py-5 text-xs text-zinc-500`}
        >
          {MOCK_BUSINESS.address} · {MOCK_BUSINESS.phone} ·{" "}
          {MOCK_BUSINESS.email}
        </footer>
      </main>
    </div>
  );
}

function SectionHead({
  eyebrow,
  title,
  t,
}: {
  eyebrow: string;
  title: string;
  t: Tokens;
}) {
  return (
    <div>
      <span
        className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${t.eyebrowText}`}
      >
        {eyebrow}
      </span>
      <h2 className="font-heading text-base tracking-tight text-ink">
        {title}
      </h2>
    </div>
  );
}

function KpiCard({
  t,
  label,
  value,
  sub,
  badge,
}: {
  t: Tokens;
  label: string;
  value: string | number;
  sub: string;
  badge?: string;
}) {
  return (
    <div
      className={`col-span-12 rounded-2xl ${t.kpiCard} p-5 sm:col-span-6 lg:col-span-4`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${t.eyebrowText}`}
        >
          {label}
        </span>
        {badge && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${t.kpiBadge}`}
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

function CalendarGrid({ t }: { t: Tokens }) {
  return (
    <>
      <div
        className={`mt-5 grid grid-cols-7 ${t.calendarGridGap} text-center`}
      >
        {WEEKDAYS.map((w) => (
          <span
            key={w}
            className={`pb-2 text-[11px] font-medium ${t.calendarHeader}`}
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
                className={`relative min-h-[68px] rounded-md p-2 text-left ${t.calendarCellClosed}`}
              >
                <div className="text-xs font-medium">{d.day}</div>
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium">
                  휴
                </div>
              </div>
            );
          }
          const barTotal = d.pt + d.group;
          return (
            <div
              key={d.day}
              className={`relative min-h-[68px] rounded-md p-2 text-left ${t.calendarCellBase} ${
                d.isToday ? t.calendarCellToday : ""
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
                <div className="font-heading mt-0.5 text-lg leading-none tabular-nums text-ink">
                  {d.total}
                </div>
              )}
              {barTotal > 0 && (
                <div className="absolute inset-x-2 bottom-2 flex h-1 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className={t.calendarPtBar}
                    style={{ width: `${(d.pt / barTotal) * 100}%` }}
                    title={`PT ${d.pt}건`}
                  />
                  <div
                    className={t.calendarGroupBar}
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
          <span className={`h-1.5 w-3 rounded-sm ${t.calendarPtBar}`} />
          PT
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-3 rounded-sm ${t.calendarGroupBar}`} />
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
