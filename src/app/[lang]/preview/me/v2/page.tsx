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

// V2 — Neon Grid
// 핵심: 순흑 + lime/cyan 형광. 모노스페이스 시각, 정확한 grid 박스,
// PT=lime / 단체=cyan 두 점.

export default async function PreviewMeV2({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const cells = buildCalendar();
  const today = TODAY_RES[0];

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <header className="border-b border-zinc-900">
        <div className="mx-auto flex max-w-3xl items-start justify-between px-6 py-5">
          <div>
            <Link
              href={`/${lang}/preview/me`}
              className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 hover:text-lime-300"
            >
              ← /preview/me
            </Link>
            <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.22em] text-lime-400">
              {GYM_NAME}
            </div>
            <div className="mt-1 font-heading text-xl tracking-tight text-white">
              {MEMBER_NAME}
            </div>
            <div className="mt-0.5 font-mono text-xs text-zinc-500">
              [TODAY] {TODAY_LABEL}
            </div>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-600">
            v2 · neon
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-3 px-6 py-6">
        {/* 오늘 — neon border */}
        <section className="relative rounded-md border-2 border-lime-400 bg-black p-6 shadow-[0_0_24px_-6px_rgba(163,230,53,0.55)]">
          <div className="absolute right-4 top-4 font-mono text-[10px] uppercase tracking-[0.22em] text-lime-400">
            ● ACTIVE
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-lime-400/80">
            today_session
          </div>
          <div className="mt-3 font-mono text-6xl font-bold leading-none text-lime-300 tabular-nums">
            {fmtMin(today.startMin)}
          </div>
          <div className="mt-2 font-mono text-sm text-zinc-400 tabular-nums">
            → {fmtMin(today.endMin)} / {today.service.toUpperCase()} /{" "}
            {today.trainer}
          </div>
        </section>

        {/* QR */}
        <button
          type="button"
          className="flex w-full items-center justify-between border-2 border-cyan-400 bg-black px-6 py-5 text-left text-cyan-300 transition hover:bg-cyan-400/5"
        >
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-400/80">
              press_to_scan
            </div>
            <div className="mt-0.5 font-mono text-xl uppercase tracking-wider">
              access_qr
            </div>
          </div>
          <div className="font-mono text-3xl">▣</div>
        </button>

        {/* 회원권 */}
        <section className="border border-zinc-800 bg-zinc-950 p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">
            membership
          </div>
          <ul className="mt-3 divide-y divide-zinc-900">
            {MEMBERSHIPS.map((m) => {
              const soon = m.daysLeft <= 7;
              return (
                <li
                  key={m.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <div className="text-sm text-zinc-100">{m.name}</div>
                    <div
                      className={
                        "mt-0.5 font-mono text-xs " +
                        (soon ? "text-amber-300" : "text-zinc-500")
                      }
                    >
                      EXP {m.expiresOn}
                      {soon ? " · WARN" : ""}
                    </div>
                  </div>
                  <div
                    className={
                      "font-mono text-2xl font-bold tabular-nums " +
                      (soon ? "text-amber-300" : "text-lime-300")
                    }
                  >
                    {m.daysLeft}
                    <span className="ml-1 text-[10px] text-zinc-500">d</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* 횟수권 */}
        <section className="border border-zinc-800 bg-zinc-950 p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">
            packs
          </div>
          <ul className="mt-3 divide-y divide-zinc-900">
            {PACKAGES.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <div className="text-sm text-zinc-100">{p.service}</div>
                  <div className="mt-0.5 font-mono text-xs text-zinc-500">
                    coach: {p.trainer.toUpperCase()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-2xl font-bold tabular-nums text-cyan-300">
                    {p.remaining}
                  </div>
                  <div className="font-mono text-[10px] text-zinc-500">
                    /{p.total}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* 캘린더 — 정확 grid + lime/cyan 두 점 */}
        <section className="border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex items-baseline justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">
              next_5_weeks
            </div>
            <div className="flex gap-3 font-mono text-[10px] text-zinc-500">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 bg-lime-400" /> PT
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 bg-cyan-400" /> GRP
              </span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-0 border-t border-l border-zinc-900 text-center">
            {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((w) => (
              <div
                key={w}
                className="border-b border-r border-zinc-900 bg-zinc-950 py-1 font-mono text-[9px] uppercase tracking-wider text-zinc-600"
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
                    "relative flex h-12 flex-col items-center justify-center border-b border-r border-zinc-900 font-mono text-sm tabular-nums " +
                    (c.isToday
                      ? "bg-lime-400/10 text-lime-300"
                      : c.hasEvent
                        ? "bg-zinc-900 text-zinc-100"
                        : dim
                          ? "text-zinc-700"
                          : "text-zinc-400")
                  }
                >
                  <span>{c.day}</span>
                  {c.hasEvent && (
                    <span className="absolute bottom-1 flex gap-0.5">
                      {c.isPersonalEvent && (
                        <span className="h-1 w-1 bg-lime-400" />
                      )}
                      {c.isGroupEvent && (
                        <span className="h-1 w-1 bg-cyan-400" />
                      )}
                    </span>
                  )}
                  {c.isToday && (
                    <span className="absolute right-0.5 top-0.5 font-mono text-[8px] text-lime-400">
                      ●
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 다가오는 리스트 */}
        <section className="border border-zinc-800 bg-zinc-950 p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">
            upcoming.log
          </div>
          <ul className="mt-3 divide-y divide-zinc-900 font-mono text-xs">
            {UPCOMING.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between py-2"
              >
                <span className="text-zinc-400 tabular-nums">
                  {r.dayKey} {fmtMin(r.startMin)}
                </span>
                <span className={r.isGroup ? "text-cyan-300" : "text-lime-300"}>
                  {r.service} · {r.trainer}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
