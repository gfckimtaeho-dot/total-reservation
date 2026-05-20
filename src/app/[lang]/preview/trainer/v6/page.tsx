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

// V6 — Cinema Noir (트레이너)

export default async function PreviewTrainerV6({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const todays = getTodaySessions();

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:3px_3px]" />

      <header className="relative border-b border-zinc-800 px-5 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <Link
              href={`/${lang}/preview/trainer`}
              className="font-mono text-[10px] uppercase tracking-[0.32em] text-zinc-500 hover:text-orange-300"
            >
              ← reel.index
            </Link>
            <h1 className="mt-1 font-heading text-2xl tracking-tight text-white [font-variant:small-caps]">
              {TRAINER_NAME}
            </h1>
            <div className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.22em] text-orange-300">
              {GYM_NAME} · {TODAY_LABEL}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-md border border-orange-400/50 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-orange-200 hover:bg-orange-500/10">
              showcase
            </button>
            <button className="rounded-md border border-orange-500 bg-orange-500/15 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-orange-200 hover:bg-orange-500/25">
              intake
            </button>
            <button className="rounded-md border border-orange-400/50 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-orange-200 hover:bg-orange-500/10">
              perf
            </button>
            <button className="rounded-md border border-zinc-700 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-zinc-500 hover:text-orange-300">
              logout
            </button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl space-y-4 p-5">
        {/* 오늘 — spotlight */}
        <section className="relative overflow-hidden rounded-md border border-zinc-800 bg-black p-5">
          <div className="pointer-events-none absolute -right-10 -top-10 h-60 w-60 rounded-full bg-orange-500/30 blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-orange-400" />
                <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-orange-300">
                  now showing · {todays.length}
                </span>
              </div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                {TODAY_LABEL}
              </div>
            </div>
            <ul className="mt-3 divide-y divide-zinc-900 font-mono">
              {todays.map((s, i) => (
                <li
                  key={i}
                  className="flex items-baseline justify-between py-2"
                >
                  <div className="flex items-baseline gap-3">
                    <span className="text-[10px] text-zinc-600 tabular-nums">
                      {String(i + 1).padStart(2, "0")}.
                    </span>
                    <span
                      className={
                        "text-xl tabular-nums " +
                        (s.completed ? "text-zinc-500" : "text-orange-200 drop-shadow-[0_0_12px_rgba(251,146,60,0.5)]")
                      }
                    >
                      {fmtMin(s.slotMin)}
                    </span>
                    <span className="font-sans text-sm text-zinc-100">
                      {s.name}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                      {s.service}
                    </span>
                  </div>
                  {s.completed && (
                    <span className="text-[10px] uppercase tracking-[0.22em] text-zinc-600">
                      end
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 슬롯 그리드 */}
        <section className="rounded-md border border-zinc-800 bg-zinc-950 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-sm uppercase tracking-wider text-orange-300">
              schedule · 5/20 [TUE]
            </h2>
            <div className="flex gap-1 font-mono text-xs">
              <button className="h-7 w-7 rounded-md border border-zinc-700 text-zinc-400 hover:border-orange-400">
                ‹
              </button>
              <button className="h-7 rounded-md border border-zinc-700 px-2 text-zinc-400 hover:border-orange-400">
                today
              </button>
              <button className="h-7 w-7 rounded-md border border-zinc-700 text-zinc-400 hover:border-orange-400">
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
                        ? "border-orange-400/50 bg-orange-500/15 text-orange-200 ring-1 ring-inset ring-orange-400/60"
                        : "border-zinc-800 text-zinc-500")
                    }
                  >
                    <span>
                      {d.month}/{d.day}
                    </span>
                    <span className="text-[9px] opacity-70">
                      {WD_KO[d.weekdayIdx]}
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
                          className="flex h-10 items-center justify-center border-b border-zinc-900 bg-zinc-950 font-mono text-xs text-zinc-700 hover:bg-orange-500/10 hover:text-orange-300"
                        >
                          +
                        </div>
                      );
                    }
                    return (
                      <div
                        key={ci}
                        className={
                          "flex h-10 flex-col justify-center overflow-hidden border-b border-zinc-900 px-1.5 text-[10px] " +
                          (c.completed
                            ? "bg-zinc-900 text-zinc-500"
                            : "bg-orange-500/15 text-orange-100 ring-1 ring-inset ring-orange-400/40")
                        }
                      >
                        <span className="truncate font-medium">
                          {c.completed && "✓ "}
                          {c.customerName}
                        </span>
                        <span className="truncate font-mono text-[8px] uppercase opacity-70">
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
