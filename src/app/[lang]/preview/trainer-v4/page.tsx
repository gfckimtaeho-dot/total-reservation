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

export default function TrainerV4() {
  const { monthLabel, monthInfo, todayDisplay } = buildSampleProps();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-amber-500/20 px-5 py-4">
        <div>
          <h1 className="font-heading text-lg tracking-tight text-white">
            {SAMPLE_TRAINER_NAME}
          </h1>
          <p className="mt-0.5 text-[11px] text-amber-300/80">
            v4 · Amber Warm · {todayDisplay}
          </p>
        </div>
        <Link
          href="/ko/preview/trainer"
          className="text-xs text-zinc-400 hover:text-amber-300"
        >
          ← 시안 목록
        </Link>
      </header>

      <main className="flex-1 space-y-4 p-4">
        <section className="rounded-2xl border border-amber-500/20 bg-zinc-900 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-heading text-base tracking-tight text-white">
              오늘의 일정
            </h2>
            <span className="rounded-full bg-amber-400/15 px-2.5 py-0.5 text-xs font-medium text-amber-300 ring-1 ring-amber-400/40">
              총 {SAMPLE_RESERVATIONS_TODAY.length}건
            </span>
          </div>
          <ol className="mt-4 divide-y divide-amber-500/10">
            {SAMPLE_RESERVATIONS_TODAY.map((r) => (
              <li
                key={r.id}
                className="grid grid-cols-[56px_1fr] gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="pt-1 text-sm font-medium tabular-nums text-amber-300/80">
                  {fmtTime(r.startMin)}
                </div>
                <div className="rounded-xl bg-zinc-800 p-3 ring-1 ring-amber-500/10">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-white">{r.customer}</span>
                    {r.type === "GROUP" && (
                      <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-950">
                        그룹 {r.enrolled}/{r.capacity}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-zinc-400">{r.service}</div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-2xl border border-amber-500/20 bg-zinc-900 p-5">
          <h2 className="font-heading text-base tracking-tight text-white">
            {monthLabel}
          </h2>
          <div className="mt-4 grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS_KO.map((w) => (
              <span
                key={w}
                className="border-b border-amber-400/40 pb-2 text-[11px] font-bold text-amber-200"
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
                      className={`relative h-14 overflow-hidden rounded-md p-1.5 text-left ${
                        isToday
                          ? "bg-zinc-800 ring-2 ring-amber-400"
                          : "bg-zinc-800/40"
                      }`}
                    >
                      <div
                        className={`text-[11px] font-semibold ${
                          isToday ? "text-amber-300" : "text-zinc-600"
                        }`}
                      >
                        {day}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={day}
                    className={`relative h-14 overflow-hidden rounded-md p-1.5 text-left ${
                      isToday
                        ? "bg-amber-400/10 ring-2 ring-amber-400"
                        : "border border-zinc-700 bg-zinc-800/30"
                    }`}
                  >
                    <div
                      className={`text-[11px] font-semibold ${
                        isToday ? "text-amber-300" : "text-zinc-100"
                      }`}
                    >
                      {day}
                    </div>
                    {classes.length > 0 && (
                      <span className="absolute right-1.5 top-1.5 flex h-1.5 w-1.5 items-center justify-center rounded-full bg-amber-400" />
                    )}
                    {classes.length > 0 && (
                      <div className="absolute bottom-1 left-1.5 right-1.5 truncate text-[9px] font-medium text-amber-200/80">
                        {classes[0]}
                        {classes.length > 1 ? ` +${classes.length - 1}` : ""}
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
