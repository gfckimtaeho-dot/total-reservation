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

export default function TrainerV2() {
  const { monthLabel, monthInfo, todayDisplay } = buildSampleProps();

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <header className="flex items-center justify-between border-b border-white/15 px-5 py-4">
        <div>
          <h1 className="font-heading text-lg tracking-tight">
            {SAMPLE_TRAINER_NAME}
          </h1>
          <p className="mt-0.5 text-[11px] text-zinc-400">
            v2 · Mono Sharp · {todayDisplay}
          </p>
        </div>
        <Link
          href="/ko/preview/trainer"
          className="text-xs text-zinc-300 hover:text-white"
        >
          ← 시안 목록
        </Link>
      </header>

      <main className="flex-1 space-y-4 p-4">
        <section className="rounded-md border border-white/15 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
            <h2 className="font-heading text-base tracking-tight">
              오늘의 일정
            </h2>
            <span className="text-xs tabular-nums text-zinc-300">
              {SAMPLE_RESERVATIONS_TODAY.length}건
            </span>
          </div>
          <ol className="mt-3 space-y-2">
            {SAMPLE_RESERVATIONS_TODAY.map((r) => (
              <li
                key={r.id}
                className="grid grid-cols-[56px_1fr] gap-3 border-l-2 border-white/40 pl-3"
              >
                <div className="text-sm font-mono tabular-nums text-zinc-300">
                  {fmtTime(r.startMin)}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{r.customer}</div>
                    <div className="text-xs text-zinc-400">{r.service}</div>
                  </div>
                  {r.type === "GROUP" && (
                    <span className="rounded-sm border border-white/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                      G {r.enrolled}/{r.capacity}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-md border border-white/15 p-5">
          <h2 className="font-heading text-base tracking-tight">
            {monthLabel}
          </h2>
          <div className="mt-4 grid grid-cols-7 gap-px text-center bg-white/15 rounded overflow-hidden">
            {WEEKDAYS_KO.map((w) => (
              <span
                key={w}
                className="bg-black py-2 text-[11px] font-bold uppercase tracking-wider"
              >
                {w}
              </span>
            ))}
            {Array.from({ length: monthInfo.firstWeekday }).map((_, i) => (
              <div key={`pad-${i}`} className="bg-black h-16" />
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
                      className={`relative h-16 bg-black p-1.5 text-left ${
                        isToday ? "outline outline-2 outline-white -outline-offset-2" : ""
                      }`}
                    >
                      <div className="text-[11px] font-bold text-zinc-500">
                        {day}
                      </div>
                      <span className="absolute bottom-1.5 right-1.5 text-[9px] uppercase tracking-wider text-zinc-500">
                        OFF
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={day}
                    className={`relative h-16 bg-black p-1.5 text-left ${
                      isToday
                        ? "outline outline-2 outline-white -outline-offset-2"
                        : ""
                    }`}
                  >
                    <div
                      className={`text-[11px] font-bold ${
                        isToday ? "text-white" : "text-zinc-200"
                      }`}
                    >
                      {day}
                    </div>
                    {classes.length > 0 && (
                      <div className="mt-1 flex gap-1">
                        {classes.map((_, i) => (
                          <span
                            key={i}
                            className="block h-1.5 w-1.5 rounded-full bg-white"
                          />
                        ))}
                      </div>
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
