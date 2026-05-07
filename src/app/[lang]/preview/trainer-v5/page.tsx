import Link from "next/link";
import {
  SAMPLE_RESERVATIONS_TODAY,
  SAMPLE_CLASSES_BY_DAY,
  SAMPLE_TRAINER_NAME,
  WEEKDAYS_KO,
  buildSampleProps,
  fmtTime,
  isOffDay,
} from "../_trainerSample";

export default function TrainerV5() {
  const { monthLabel, monthInfo, todayDisplay } = buildSampleProps();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-emerald-500/20 px-5 py-4">
        <div>
          <h1 className="font-heading text-lg tracking-tight text-white">
            {SAMPLE_TRAINER_NAME}
          </h1>
          <p className="mt-0.5 text-[11px] text-emerald-400/80">
            v5 · Emerald Premium · {todayDisplay}
          </p>
        </div>
        <Link
          href="/ko/preview/trainer"
          className="text-xs text-zinc-400 hover:text-emerald-400"
        >
          ← 시안 목록
        </Link>
      </header>

      <main className="flex-1 space-y-5 p-4">
        <section className="rounded-3xl bg-gradient-to-b from-zinc-900 to-zinc-900/60 p-6 ring-1 ring-emerald-500/15">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-heading text-lg tracking-tight text-white">
              오늘의 일정
            </h2>
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-400/40">
              총 {SAMPLE_RESERVATIONS_TODAY.length}건
            </span>
          </div>
          <ol className="mt-5 space-y-3">
            {SAMPLE_RESERVATIONS_TODAY.map((r) => (
              <li
                key={r.id}
                className="grid grid-cols-[64px_1fr] items-center gap-3 rounded-2xl bg-zinc-800/50 p-3.5 ring-1 ring-white/5"
              >
                <div className="text-center">
                  <div className="font-mono text-base font-bold tabular-nums text-emerald-400">
                    {fmtTime(r.startMin)}
                  </div>
                  <div className="mt-0.5 text-[9px] uppercase tracking-wider text-zinc-500">
                    {r.type === "GROUP" ? "그룹" : "PT"}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-white">
                      {r.customer}
                    </span>
                    {r.type === "GROUP" && (
                      <span className="rounded-full bg-emerald-400 px-2 py-0.5 text-[9px] font-bold tabular-nums text-zinc-950">
                        {r.enrolled}/{r.capacity}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-400">{r.service}</div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-3xl bg-gradient-to-b from-zinc-900 to-zinc-900/60 p-6 ring-1 ring-emerald-500/15">
          <h2 className="font-heading text-lg tracking-tight text-white">
            {monthLabel}
          </h2>
          <div className="mt-5 grid grid-cols-7 gap-1.5 text-center">
            {WEEKDAYS_KO.map((w) => (
              <span
                key={w}
                className="rounded-md bg-zinc-800/60 py-2 text-[11px] font-bold uppercase tracking-wider text-emerald-200"
              >
                {w}
              </span>
            ))}
            {Array.from({ length: monthInfo.firstWeekday }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {Array.from({ length: monthInfo.daysInMonth }, (_, i) => i + 1).map(
              (day) => {
                const off = isOffDay(day, monthInfo);
                const isToday = day === monthInfo.todayDay;
                const classes = SAMPLE_CLASSES_BY_DAY[day] ?? [];

                if (off) {
                  return (
                    <div
                      key={day}
                      className={`relative h-20 overflow-hidden rounded-xl p-2 text-left ${
                        isToday
                          ? "bg-zinc-800 ring-2 ring-emerald-400"
                          : "bg-zinc-900/40"
                      }`}
                    >
                      <div
                        className={`text-xs font-bold ${
                          isToday ? "text-emerald-300" : "text-zinc-600"
                        }`}
                      >
                        {day}
                      </div>
                      <div
                        className={`mt-1 text-[10px] uppercase tracking-wider ${
                          isToday ? "text-emerald-400" : "text-zinc-600"
                        }`}
                      >
                        OFF
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={day}
                    className={`relative h-20 overflow-hidden rounded-xl p-2 text-left ${
                      isToday
                        ? "bg-gradient-to-br from-emerald-500/25 to-emerald-500/10 ring-2 ring-emerald-400 shadow-[0_0_24px_-8px_rgba(52,211,153,0.6)]"
                        : "bg-zinc-800/50 ring-1 ring-white/5"
                    }`}
                  >
                    <div
                      className={`text-xs font-bold ${
                        isToday ? "text-emerald-300" : "text-zinc-100"
                      }`}
                    >
                      {day}
                    </div>
                    {classes.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {classes.slice(0, 2).map((name) => (
                          <li
                            key={name}
                            className="truncate text-[10px] font-medium text-emerald-300"
                          >
                            {name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              },
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
