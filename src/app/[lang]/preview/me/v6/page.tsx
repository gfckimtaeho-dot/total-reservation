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

// V6 — Cinema Noir
// 핵심: 흑백 베이스 + tungsten orange spotlight 한 점.
// 오늘 카드에 원형 라디얼 spotlight, 캘린더는 굵은 분리선 + 일정 orange 막대.

export default async function PreviewMeV6({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const cells = buildCalendar();
  const today = TODAY_RES[0];

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      {/* 영화관 필름 grain — 가벼운 noise */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:3px_3px]" />

      <header className="relative border-b border-zinc-800">
        <div className="mx-auto flex max-w-3xl items-start justify-between px-6 py-5">
          <div>
            <Link
              href={`/${lang}/preview/me`}
              className="font-mono text-[10px] uppercase tracking-[0.32em] text-zinc-500 hover:text-orange-300"
            >
              ← reel.index
            </Link>
            <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.32em] text-orange-400">
              {GYM_NAME} · feature
            </div>
            <div className="mt-1 font-heading text-3xl tracking-tight text-white [font-variant:small-caps]">
              {MEMBER_NAME}
            </div>
            <div className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
              {TODAY_LABEL}
            </div>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-zinc-600">
            v6 noir
          </div>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-3xl space-y-5 px-6 py-6">
        {/* 오늘 — spotlight */}
        <section className="relative overflow-hidden rounded-md border border-zinc-800 bg-black p-8">
          <div className="pointer-events-none absolute -right-10 -top-10 h-72 w-72 rounded-full bg-orange-500/30 blur-3xl" />
          <div className="pointer-events-none absolute -right-2 -top-2 h-40 w-40 rounded-full bg-orange-400/15 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-orange-400" />
              <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-orange-300">
                now showing
              </span>
            </div>
            <div className="mt-4 font-heading text-6xl tracking-tight tabular-nums text-orange-200 drop-shadow-[0_0_28px_rgba(251,146,60,0.55)]">
              {fmtMin(today.startMin)}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-4 border-t border-zinc-800 pt-3 font-mono text-[11px] uppercase tracking-wider text-zinc-400">
              <div>
                <div className="text-[9px] text-zinc-600">runtime</div>
                <div className="mt-0.5 text-zinc-200">
                  {today.endMin - today.startMin}m
                </div>
              </div>
              <div>
                <div className="text-[9px] text-zinc-600">feature</div>
                <div className="mt-0.5 text-zinc-200">{today.service}</div>
              </div>
              <div>
                <div className="text-[9px] text-zinc-600">cast</div>
                <div className="mt-0.5 text-zinc-200">{today.trainer}</div>
              </div>
            </div>
          </div>
        </section>

        {/* QR */}
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md border border-orange-500/50 bg-zinc-950 px-6 py-5 text-left text-orange-200 transition hover:bg-orange-500/5"
        >
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-orange-400">
              admit one
            </div>
            <div className="mt-0.5 font-heading text-xl tracking-tight text-white">
              출입 QR
            </div>
          </div>
          <div className="text-3xl text-orange-300">▦</div>
        </button>

        {/* 회원권 — 티켓 stub 느낌 */}
        <section className="rounded-md border border-zinc-800 bg-zinc-950 p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-zinc-500">
            season pass
          </div>
          <ul className="mt-3 space-y-2">
            {MEMBERSHIPS.map((m) => {
              const soon = m.daysLeft <= 7;
              return (
                <li
                  key={m.id}
                  className="flex items-center justify-between border-l-2 border-zinc-700 pl-3 py-2"
                  style={
                    soon
                      ? { borderColor: "rgb(251,146,60)" }
                      : undefined
                  }
                >
                  <div>
                    <div className="text-sm font-medium text-zinc-100">
                      {m.name}
                    </div>
                    <div
                      className={
                        "mt-0.5 font-mono text-[10px] uppercase tracking-wider " +
                        (soon ? "text-orange-300" : "text-zinc-500")
                      }
                    >
                      exp {m.expiresOn}
                      {soon ? " · final week" : ""}
                    </div>
                  </div>
                  <div
                    className={
                      "font-heading text-2xl tabular-nums " +
                      (soon ? "text-orange-300" : "text-zinc-100")
                    }
                  >
                    {m.daysLeft}
                    <span className="ml-0.5 font-mono text-[10px] text-zinc-500">
                      d
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* 횟수권 */}
        <section className="rounded-md border border-zinc-800 bg-zinc-950 p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-zinc-500">
            ticket book
          </div>
          <ul className="mt-3 space-y-2">
            {PACKAGES.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between border-l-2 border-zinc-700 pl-3 py-2"
              >
                <div>
                  <div className="text-sm font-medium text-zinc-100">
                    {p.service}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                    coach · {p.trainer}
                  </div>
                </div>
                <div className="font-heading text-2xl text-orange-200 tabular-nums">
                  {p.remaining}
                  <span className="ml-0.5 font-mono text-[10px] text-zinc-600">
                    /{p.total}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* 캘린더 */}
        <section className="rounded-md border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex items-baseline justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-zinc-500">
              show schedule · 5 wk
            </div>
            <div className="flex gap-3 font-mono text-[10px] text-zinc-500">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-2 bg-orange-400" /> session
              </span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-0 border-t border-l border-zinc-800 text-center">
            {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((w) => (
              <div
                key={w}
                className="border-b border-r border-zinc-800 py-1.5 font-mono text-[9px] uppercase tracking-[0.22em] text-zinc-600"
              >
                {w}
              </div>
            ))}
            {cells.map((c) => {
              const dim = !c.isCurrentMonth || c.isPast;
              return (
                <div
                  key={c.dayKey}
                  className={
                    "relative flex h-12 flex-col items-center justify-center border-b border-r border-zinc-800 font-heading text-sm tabular-nums " +
                    (c.isToday
                      ? "bg-orange-500/15 text-orange-100 ring-1 ring-inset ring-orange-400/60"
                      : c.hasEvent
                        ? "bg-zinc-900 text-zinc-100"
                        : dim
                          ? "text-zinc-700"
                          : "text-zinc-400")
                  }
                >
                  <span>{c.day}</span>
                  {c.hasEvent && !c.isToday && (
                    <span className="absolute bottom-1 h-0.5 w-5 bg-orange-400" />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 다가오는 — numbered scenes */}
        <section className="rounded-md border border-zinc-800 bg-zinc-950 p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-zinc-500">
            upcoming reels
          </div>
          <ul className="mt-3 divide-y divide-zinc-900">
            {UPCOMING.map((r, i) => (
              <li
                key={r.id}
                className="flex items-baseline justify-between py-3"
              >
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-[10px] text-zinc-600 tabular-nums">
                    {String(i + 1).padStart(2, "0")}.
                  </span>
                  <div>
                    <div className="font-heading text-base text-zinc-100 tabular-nums">
                      {fmtMin(r.startMin)}
                      <span className="ml-2 text-sm font-normal text-zinc-400">
                        {r.service}
                      </span>
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                      {r.dayKey} · {r.trainer}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
