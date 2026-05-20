import Link from "next/link";
import {
  TODAY_RES,
  UPCOMING,
  MEMBERSHIPS,
  PACKAGES,
  GYM_NAME,
  MEMBER_NAME,
  TODAY_LABEL,
  buildCalendar,
  fmtMin,
} from "../_mock";

// V9 — Health App Dark
// 핵심: pure black + 큰 라운드 카드. Apple Health 식 다색 활동 chip.
// PT=red, group=green, membership=blue, packages=orange. 일정 있는 날 = 활동 ring chip.

export default async function PreviewMeV9({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const cells = buildCalendar();
  const today = TODAY_RES[0];

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <header className="px-6 pt-6">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between">
            <Link
              href={`/${lang}/preview/me`}
              className="text-sm text-zinc-500 hover:text-zinc-100"
            >
              ←
            </Link>
            <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-600">
              v9 health
            </div>
          </div>
          <div className="mt-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500">
              {GYM_NAME}
            </div>
            <div className="mt-1 font-heading text-3xl font-bold tracking-tight text-white">
              {TODAY_LABEL}
            </div>
            <div className="mt-1 text-base text-zinc-400">
              {MEMBER_NAME} 님, 오늘도 화이팅
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-3 px-6 py-6">
        {/* 오늘 — red 활동 카드 */}
        <section className="relative overflow-hidden rounded-[2rem] bg-zinc-900 p-6 ring-1 ring-zinc-800">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-red-400">
              오늘의 일정
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-3">
            <div>
              <div className="font-heading text-5xl font-bold tracking-tight tabular-nums text-white">
                {fmtMin(today.startMin)}
              </div>
              <div className="mt-1 text-sm text-zinc-400 tabular-nums">
                — {fmtMin(today.endMin)}
              </div>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-300 ring-1 ring-red-500/30">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                {today.service}
              </div>
              <div className="mt-1.5 text-sm text-zinc-300">
                {today.trainer} 트레이너
              </div>
            </div>
          </div>
        </section>

        {/* QR 큰 카드 */}
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-[2rem] bg-white px-6 py-5 text-left text-black transition hover:bg-zinc-100"
        >
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              tap to open
            </div>
            <div className="mt-0.5 font-heading text-xl font-bold tracking-tight">
              출입 QR
            </div>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-2xl text-white">
            ▦
          </div>
        </button>

        {/* 회원권 / 횟수권 — 다색 chips 1열 grid */}
        <section className="rounded-[2rem] bg-zinc-900 p-6 ring-1 ring-zinc-800">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            나의 활성 권
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {MEMBERSHIPS.map((m) => {
              const soon = m.daysLeft <= 7;
              return (
                <div
                  key={m.id}
                  className={
                    "relative overflow-hidden rounded-2xl bg-zinc-950 p-4 ring-1 " +
                    (soon ? "ring-amber-500/40" : "ring-zinc-800")
                  }
                >
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-300">
                      회원권
                    </span>
                  </div>
                  <div className="mt-2 text-sm font-medium text-zinc-100">
                    {m.name}
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span
                      className={
                        "font-heading text-3xl font-bold tabular-nums " +
                        (soon ? "text-amber-300" : "text-white")
                      }
                    >
                      {m.daysLeft}
                    </span>
                    <span className="text-xs text-zinc-500">일</span>
                  </div>
                  <div
                    className={
                      "mt-1 text-[10px] " +
                      (soon ? "text-amber-300/80" : "text-zinc-500")
                    }
                  >
                    {m.expiresOn} 만료
                  </div>
                </div>
              );
            })}
            {PACKAGES.map((p) => {
              const tone = p.service === "PT"
                ? { dot: "bg-red-400", text: "text-red-300", ring: "ring-red-500/30" }
                : { dot: "bg-emerald-400", text: "text-emerald-300", ring: "ring-emerald-500/30" };
              return (
                <div
                  key={p.id}
                  className="relative overflow-hidden rounded-2xl bg-zinc-950 p-4 ring-1 ring-zinc-800"
                >
                  <div className="flex items-center gap-1.5">
                    <span className={"h-1.5 w-1.5 rounded-full " + tone.dot} />
                    <span
                      className={
                        "text-[10px] font-semibold uppercase tracking-wider " +
                        tone.text
                      }
                    >
                      {p.service}
                    </span>
                  </div>
                  <div className="mt-2 text-sm font-medium text-zinc-100">
                    {p.service} 횟수권
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="font-heading text-3xl font-bold text-white tabular-nums">
                      {p.remaining}
                    </span>
                    <span className="text-xs text-zinc-500">/{p.total}</span>
                  </div>
                  <div className="mt-1 text-[10px] text-zinc-500">
                    담당 {p.trainer}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 캘린더 — 활동 ring 식 */}
        <section className="rounded-[2rem] bg-zinc-900 p-6 ring-1 ring-zinc-800">
          <div className="flex items-baseline justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              앞으로 5주
            </div>
            <div className="flex gap-3 text-[10px]">
              <span className="flex items-center gap-1 text-red-300">
                <span className="h-2 w-2 rounded-full bg-red-500" /> PT
              </span>
              <span className="flex items-center gap-1 text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> 단체
              </span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-[10px] text-zinc-500">
            {["일", "월", "화", "수", "목", "금", "토"].map((w) => (
              <div key={w} className="pb-1">
                {w}
              </div>
            ))}
            {cells.map((c) => {
              const dim = !c.isCurrentMonth || c.isPast;
              return (
                <div
                  key={c.dayKey}
                  className="relative flex h-12 items-center justify-center"
                >
                  {c.isToday && (
                    <span className="absolute inset-0 rounded-full bg-white shadow-[0_0_0_2px_rgba(255,255,255,0.15)]" />
                  )}
                  {c.hasEvent && !c.isToday && (
                    <>
                      {c.isPersonalEvent && c.isGroupEvent ? (
                        <span className="absolute inset-1 rounded-full bg-gradient-to-br from-red-500/30 to-emerald-500/30 ring-2 ring-red-400/60" />
                      ) : c.isPersonalEvent ? (
                        <span className="absolute inset-1.5 rounded-full ring-2 ring-red-500" />
                      ) : (
                        <span className="absolute inset-1.5 rounded-full ring-2 ring-emerald-500" />
                      )}
                    </>
                  )}
                  <span
                    className={
                      "relative font-heading text-sm font-semibold tabular-nums " +
                      (c.isToday
                        ? "text-black"
                        : c.hasEvent
                          ? "text-white"
                          : dim
                            ? "text-zinc-700"
                            : "text-zinc-300")
                    }
                  >
                    {c.day}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* 다가오는 */}
        <section className="rounded-[2rem] bg-zinc-900 p-6 ring-1 ring-zinc-800">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            다가오는 예약
          </div>
          <ul className="mt-4 space-y-2.5">
            {UPCOMING.map((r) => {
              const tone = r.isGroup
                ? { bg: "bg-emerald-500/15", text: "text-emerald-300", ring: "ring-emerald-500/30" }
                : { bg: "bg-red-500/15", text: "text-red-300", ring: "ring-red-500/30" };
              return (
                <li
                  key={r.id}
                  className="flex items-center gap-3 rounded-2xl bg-zinc-950 p-3 ring-1 ring-zinc-800"
                >
                  <div
                    className={
                      "flex h-12 w-12 flex-col items-center justify-center rounded-xl text-xs font-bold " +
                      tone.bg + " " + tone.text
                    }
                  >
                    <span className="text-[10px] uppercase">
                      {r.dayKey.slice(5, 7)}
                    </span>
                    <span className="font-heading text-base tabular-nums">
                      {r.dayKey.slice(8)}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="font-heading text-base font-semibold text-white tabular-nums">
                      {fmtMin(r.startMin)}
                      <span className="ml-2 text-sm font-normal text-zinc-300">
                        {r.service}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-400">
                      {r.trainer} 트레이너
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </div>
  );
}
