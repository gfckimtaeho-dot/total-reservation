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

// V7 — Forest Tactical
// 핵심: forest green 베이스 + bronze 액센트. 군용 utility 시계 무드.
// 모서리 코드 라벨, monospace, 두꺼운 분할선, 캘린더는 bronze cap.

export default async function PreviewMeV7({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const cells = buildCalendar();
  const today = TODAY_RES[0];

  return (
    <div className="min-h-screen bg-[#0a1410] text-emerald-50">
      <header className="border-b-2 border-emerald-900">
        <div className="mx-auto flex max-w-3xl items-start justify-between px-6 py-5">
          <div>
            <Link
              href={`/${lang}/preview/me`}
              className="font-mono text-[10px] uppercase tracking-[0.32em] text-emerald-400/70 hover:text-amber-300"
            >
              ← /index
            </Link>
            <div className="mt-2 flex items-center gap-2">
              <span className="h-1.5 w-3 bg-amber-500" />
              <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-amber-300">
                {GYM_NAME}
              </span>
            </div>
            <div className="mt-1 font-heading text-2xl font-bold tracking-tight text-emerald-50">
              {MEMBER_NAME}
            </div>
            <div className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.22em] text-emerald-400/80">
              {TODAY_LABEL}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-emerald-500/70">
              v7 tactical
            </div>
            <div className="mt-1 font-mono text-[10px] text-emerald-600">
              [SECTOR · ME]
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-4 px-6 py-6">
        {/* 오늘 — bronze frame */}
        <section className="relative border-2 border-amber-700/60 bg-[#08110d] p-5">
          {/* 모서리 4개에 corner ticks */}
          <span className="absolute -top-1 -left-1 h-3 w-3 border-t-2 border-l-2 border-amber-500" />
          <span className="absolute -top-1 -right-1 h-3 w-3 border-t-2 border-r-2 border-amber-500" />
          <span className="absolute -bottom-1 -left-1 h-3 w-3 border-b-2 border-l-2 border-amber-500" />
          <span className="absolute -bottom-1 -right-1 h-3 w-3 border-b-2 border-r-2 border-amber-500" />

          <div className="flex items-center justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-amber-400">
              today · primary op
            </div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-emerald-500/70">
              status · CONFIRMED
            </div>
          </div>

          <div className="mt-3 font-mono text-6xl font-bold leading-none tabular-nums text-amber-200">
            {fmtMin(today.startMin)}
          </div>

          <div className="mt-3 grid grid-cols-3 border-t border-emerald-900 pt-3 font-mono text-[11px] uppercase tracking-wider text-emerald-200/90">
            <div>
              <div className="text-[9px] text-emerald-600">end</div>
              <div className="mt-0.5 tabular-nums">{fmtMin(today.endMin)}</div>
            </div>
            <div>
              <div className="text-[9px] text-emerald-600">type</div>
              <div className="mt-0.5">{today.service}</div>
            </div>
            <div>
              <div className="text-[9px] text-emerald-600">coach</div>
              <div className="mt-0.5">{today.trainer}</div>
            </div>
          </div>
        </section>

        {/* QR */}
        <button
          type="button"
          className="flex w-full items-center justify-between border-2 border-amber-700/60 bg-[#08110d] px-6 py-5 text-left text-amber-200 transition hover:border-amber-500"
        >
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-amber-400">
              gate access
            </div>
            <div className="mt-0.5 font-heading text-xl font-bold tracking-tight text-emerald-50">
              출입 QR
            </div>
          </div>
          <div className="border border-amber-600 px-3 py-1.5 font-mono text-2xl text-amber-300">
            ▣
          </div>
        </button>

        {/* 회원권 + 횟수권 grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <section className="border border-emerald-900 bg-[#08110d] p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-emerald-400">
              membership
            </div>
            <ul className="mt-3 space-y-3">
              {MEMBERSHIPS.map((m) => {
                const soon = m.daysLeft <= 7;
                return (
                  <li key={m.id} className="font-mono text-xs">
                    <div className="flex items-baseline justify-between">
                      <div className="text-emerald-100">{m.name}</div>
                      <div
                        className={
                          "text-base font-bold tabular-nums " +
                          (soon ? "text-amber-300" : "text-emerald-200")
                        }
                      >
                        {m.daysLeft}d
                      </div>
                    </div>
                    <div
                      className={
                        "mt-0.5 text-[10px] uppercase " +
                        (soon ? "text-amber-400" : "text-emerald-500/70")
                      }
                    >
                      exp · {m.expiresOn}
                      {soon ? " · warn" : ""}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="border border-emerald-900 bg-[#08110d] p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-emerald-400">
              session pack
            </div>
            <ul className="mt-3 space-y-3">
              {PACKAGES.map((p) => (
                <li key={p.id} className="font-mono text-xs">
                  <div className="flex items-baseline justify-between">
                    <div className="text-emerald-100">{p.service}</div>
                    <div className="text-base font-bold tabular-nums">
                      <span className="text-amber-300">{p.remaining}</span>
                      <span className="text-emerald-700">/{p.total}</span>
                    </div>
                  </div>
                  <div className="mt-0.5 text-[10px] uppercase text-emerald-500/70">
                    coach · {p.trainer}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* 캘린더 — bronze fill */}
        <section className="border border-emerald-900 bg-[#08110d] p-4">
          <div className="flex items-baseline justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-emerald-400">
              schedule · 5w
            </div>
            <div className="flex gap-2 font-mono text-[10px] text-emerald-500">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 bg-amber-500" /> op
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 border border-amber-500" /> grp
              </span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-px bg-emerald-900 text-center">
            {["S", "M", "T", "W", "T", "F", "S"].map((w, i) => (
              <div
                key={i}
                className="bg-[#08110d] py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-600"
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
                    "relative flex h-12 flex-col items-center justify-center font-mono text-sm tabular-nums " +
                    (c.isToday
                      ? "bg-amber-500 text-[#08110d]"
                      : c.hasEvent
                        ? "bg-emerald-950 text-emerald-50"
                        : "bg-[#08110d] " +
                          (dim ? "text-emerald-800" : "text-emerald-300"))
                  }
                >
                  <span>{c.day}</span>
                  {c.hasEvent && !c.isToday && (
                    <span className="absolute bottom-0.5 flex gap-0.5">
                      {c.isPersonalEvent && (
                        <span className="h-1.5 w-1.5 bg-amber-500" />
                      )}
                      {c.isGroupEvent && (
                        <span className="h-1.5 w-1.5 border border-amber-500" />
                      )}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 다가오는 */}
        <section className="border border-emerald-900 bg-[#08110d] p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-emerald-400">
            queued ops
          </div>
          <ul className="mt-3 divide-y divide-emerald-900 font-mono text-xs">
            {UPCOMING.map((r) => (
              <li
                key={r.id}
                className="flex items-baseline justify-between py-2.5"
              >
                <div className="flex items-baseline gap-3">
                  <span className="tabular-nums text-amber-300">
                    {r.dayKey.slice(5)}
                  </span>
                  <span className="tabular-nums text-emerald-100">
                    {fmtMin(r.startMin)}
                  </span>
                  <span className="uppercase tracking-wider text-emerald-200">
                    {r.service}
                  </span>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-emerald-500">
                  {r.trainer}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
