import Link from "next/link";
import {
  TRAINER_NAME,
  GYM_NAME,
  TODAY_LABEL,
  SLOT_AXIS,
  DAYS,
  WD_KO,
  fmtMin,
  getTodaySessions,
} from "../_mock";

// V2 — Neon Grid (트레이너)

export default async function PreviewTrainerV2({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const todays = getTodaySessions();

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <header className="border-b border-zinc-900 px-5 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <Link
              href={`/${lang}/preview/trainer`}
              className="font-mono text-[10px] uppercase tracking-[0.32em] text-zinc-600 hover:text-lime-300"
            >
              ← /index
            </Link>
            <h1 className="mt-1 font-heading text-xl tracking-tight text-white">
              {TRAINER_NAME}
            </h1>
            <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-lime-400">
              {GYM_NAME} · {TODAY_LABEL}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="border border-lime-400/60 bg-black px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-lime-300 hover:bg-lime-400/10">
              showcase
            </button>
            <button className="border border-cyan-400/60 bg-black px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-cyan-300 hover:bg-cyan-400/10">
              intake
            </button>
            <button className="border border-amber-400/60 bg-black px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-amber-300 hover:bg-amber-400/10">
              perf
            </button>
            <button className="border border-zinc-700 bg-black px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-zinc-500 hover:text-lime-300">
              logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-3 p-5">
        {/* 오늘 요약 */}
        <section className="border-2 border-lime-400 bg-black p-5 shadow-[0_0_28px_-8px_rgba(163,230,53,0.5)]">
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.32em]">
            <span className="text-lime-400">today.log · {todays.length}</span>
            <span className="text-zinc-600">{TODAY_LABEL}</span>
          </div>
          <ul className="mt-3 divide-y divide-zinc-900 font-mono text-sm">
            {todays.map((s, i) => (
              <li
                key={i}
                className="flex items-center justify-between py-2"
              >
                <div className="flex items-baseline gap-3">
                  <span
                    className={
                      "text-base font-bold tabular-nums " +
                      (s.completed ? "text-emerald-300" : "text-lime-300")
                    }
                  >
                    {fmtMin(s.slotMin)}
                  </span>
                  <span className="font-sans text-zinc-100">{s.name}</span>
                  <span className="text-xs uppercase tracking-wider text-zinc-500">
                    {s.service}
                  </span>
                </div>
                {s.completed && (
                  <span className="font-mono text-xs text-emerald-400">
                    ● done
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* 슬롯 그리드 */}
        <section className="border border-zinc-800 bg-zinc-950 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-sm uppercase tracking-wider text-lime-300">
              schedule · 5/20 [TUE]
            </h2>
            <div className="flex gap-1 font-mono text-xs">
              <button className="h-7 w-7 border border-zinc-700 text-zinc-400 hover:border-lime-400">
                ‹
              </button>
              <button className="h-7 border border-zinc-700 px-2 text-zinc-400 hover:border-lime-400">
                NOW
              </button>
              <button className="h-7 w-7 border border-zinc-700 text-zinc-400 hover:border-lime-400">
                ›
              </button>
            </div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <div className="flex min-w-max">
              <div className="sticky left-0 z-10 flex w-14 flex-col bg-zinc-950">
                <div className="h-10 border-b border-zinc-800" />
                {SLOT_AXIS.map((s) => (
                  <div
                    key={s}
                    className="flex h-10 items-start justify-end pr-2 pt-1 font-mono text-[10px] tabular-nums text-zinc-600"
                  >
                    {fmtMin(s)}
                  </div>
                ))}
              </div>
              {DAYS.map((d, di) => (
                <div
                  key={di}
                  className="flex w-24 shrink-0 flex-col border-l border-zinc-800"
                >
                  <div
                    className={
                      "flex h-10 flex-col items-center justify-center border-b font-mono text-[11px] tabular-nums " +
                      (d.isToday
                        ? "border-lime-400/50 bg-lime-400/10 text-lime-300"
                        : "border-zinc-800 text-zinc-500")
                    }
                  >
                    <span>
                      {d.month}/{d.day}
                    </span>
                    <span className="text-[9px] opacity-70">
                      [{WD_KO[d.weekdayIdx].toUpperCase()}]
                    </span>
                  </div>
                  {d.cells.map((c, ci) => {
                    if (c.kind === "unavail") {
                      return (
                        <div
                          key={ci}
                          className="h-10 border-b border-zinc-900 bg-black"
                        />
                      );
                    }
                    if (c.kind === "free") {
                      return (
                        <div
                          key={ci}
                          className="flex h-10 items-center justify-center border-b border-zinc-900 bg-zinc-950 font-mono text-xs text-zinc-700 hover:bg-lime-400/5 hover:text-lime-400"
                        >
                          +
                        </div>
                      );
                    }
                    return (
                      <div
                        key={ci}
                        className={
                          "flex h-10 flex-col justify-center overflow-hidden border-b border-zinc-900 px-1.5 font-mono text-[10px] " +
                          (c.completed
                            ? "border-l-2 border-l-emerald-400 bg-emerald-500/10 text-emerald-300"
                            : "border-l-2 border-l-lime-400 bg-lime-400/10 text-lime-200")
                        }
                      >
                        <span className="truncate font-sans">
                          {c.completed && "✓ "}
                          {c.customerName}
                        </span>
                        <span className="truncate text-[8px] uppercase opacity-70">
                          {c.service}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
