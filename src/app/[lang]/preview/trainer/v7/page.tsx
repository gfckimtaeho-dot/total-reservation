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

// V7 — Forest Tactical (트레이너)

export default async function PreviewTrainerV7({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const todays = getTodaySessions();

  return (
    <div className="min-h-screen bg-[#0a1410] text-emerald-50">
      <header className="border-b-2 border-emerald-900 px-5 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <Link
              href={`/${lang}/preview/trainer`}
              className="font-mono text-[10px] uppercase tracking-[0.32em] text-emerald-400/70 hover:text-amber-300"
            >
              ← /index
            </Link>
            <div className="mt-1 flex items-center gap-2">
              <span className="h-1.5 w-3 bg-amber-500" />
              <h1 className="font-heading text-xl font-bold tracking-tight text-emerald-50">
                {TRAINER_NAME}
              </h1>
            </div>
            <div className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.22em] text-amber-300">
              {GYM_NAME} · {TODAY_LABEL}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="border border-emerald-800 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-emerald-200 hover:border-amber-500 hover:text-amber-300">
              showcase
            </button>
            <button className="border-2 border-amber-700 bg-amber-700/20 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-amber-200 hover:bg-amber-700/30">
              intake
            </button>
            <button className="border border-emerald-800 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-emerald-200 hover:border-amber-500 hover:text-amber-300">
              perf
            </button>
            <button className="border border-emerald-900 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-emerald-500 hover:text-emerald-200">
              logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 p-5">
        {/* 오늘 — bronze frame */}
        <section className="relative border-2 border-amber-700/60 bg-[#08110d] p-5">
          <span className="absolute -top-1 -left-1 h-3 w-3 border-t-2 border-l-2 border-amber-500" />
          <span className="absolute -top-1 -right-1 h-3 w-3 border-t-2 border-r-2 border-amber-500" />
          <span className="absolute -bottom-1 -left-1 h-3 w-3 border-b-2 border-l-2 border-amber-500" />
          <span className="absolute -bottom-1 -right-1 h-3 w-3 border-b-2 border-r-2 border-amber-500" />

          <div className="flex items-center justify-between font-mono">
            <div className="text-[10px] uppercase tracking-[0.32em] text-amber-400">
              today · ops · {todays.length}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-emerald-500/70">
              status · CONFIRMED
            </div>
          </div>
          <ul className="mt-3 divide-y divide-emerald-900 font-mono">
            {todays.map((s, i) => (
              <li
                key={i}
                className="flex items-baseline justify-between py-2"
              >
                <div className="flex items-baseline gap-3">
                  <span
                    className={
                      "text-lg font-bold tabular-nums " +
                      (s.completed ? "text-emerald-400" : "text-amber-200")
                    }
                  >
                    {fmtMin(s.slotMin)}
                  </span>
                  <span className="font-sans text-sm text-emerald-50">
                    {s.name}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-emerald-500/70">
                    {s.service}
                  </span>
                </div>
                {s.completed && (
                  <span className="text-[10px] uppercase tracking-wider text-emerald-400">
                    ● done
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* 슬롯 그리드 */}
        <section className="border border-emerald-900 bg-[#08110d] p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-sm uppercase tracking-wider text-amber-300">
              schedule · 5/20 [TUE]
            </h2>
            <div className="flex gap-1 font-mono text-xs">
              <button className="h-7 w-7 border border-emerald-800 text-emerald-200 hover:border-amber-500">
                ‹
              </button>
              <button className="h-7 border border-emerald-800 px-2 text-emerald-200 hover:border-amber-500">
                today
              </button>
              <button className="h-7 w-7 border border-emerald-800 text-emerald-200 hover:border-amber-500">
                ›
              </button>
            </div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <div className="flex min-w-max">
              <div className="sticky left-0 z-10 flex w-14 flex-col bg-[#08110d]">
                <div className="h-10 border-b border-emerald-900" />
                {SLOT_AXIS.map((s) => (
                  <div
                    key={s}
                    className="flex h-10 items-start justify-end pr-2 pt-1 font-mono text-[10px] tabular-nums text-emerald-600"
                  >
                    {fmtMin(s)}
                  </div>
                ))}
              </div>
              {DAYS.map((d, di) => (
                <div
                  key={di}
                  className="flex w-24 shrink-0 flex-col border-l border-emerald-900"
                >
                  <div
                    className={
                      "flex h-10 flex-col items-center justify-center border-b font-mono text-[11px] tabular-nums " +
                      (d.isToday
                        ? "border-amber-500 bg-amber-500 text-[#08110d]"
                        : "border-emerald-900 text-emerald-300")
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
                          className="h-10 border-b border-emerald-900 bg-black"
                        />
                      );
                    }
                    if (c.kind === "free") {
                      return (
                        <div
                          key={ci}
                          className="flex h-10 items-center justify-center border-b border-emerald-900 bg-emerald-950/30 font-mono text-xs text-emerald-700 hover:bg-amber-700/15 hover:text-amber-300"
                        >
                          +
                        </div>
                      );
                    }
                    return (
                      <div
                        key={ci}
                        className={
                          "flex h-10 flex-col justify-center overflow-hidden border-b border-emerald-900 px-1.5 font-mono text-[10px] " +
                          (c.completed
                            ? "border-l-2 border-l-emerald-500 bg-emerald-950 text-emerald-200"
                            : "border-l-2 border-l-amber-500 bg-amber-700/20 text-amber-100")
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
