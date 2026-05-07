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

export default function TrainerV3() {
  const { monthLabel, monthInfo, todayDisplay } = buildSampleProps();

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
        <div>
          <h1 className="font-heading text-lg tracking-tight text-white">
            {SAMPLE_TRAINER_NAME}
          </h1>
          <p className="mt-0.5 text-[11px] text-cyan-300/80">
            v3 · Cyan Studio · {todayDisplay}
          </p>
        </div>
        <Link
          href="/ko/preview/trainer"
          className="text-xs text-slate-400 hover:text-cyan-300"
        >
          ← 시안 목록
        </Link>
      </header>

      <main className="flex-1 space-y-4 p-4">
        <section className="rounded-2xl border border-cyan-500/20 bg-slate-900 p-5 shadow-[0_0_60px_-30px_rgba(34,211,238,0.4)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-heading text-base tracking-tight text-white">
              오늘의 일정
            </h2>
            <span className="rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-xs font-medium text-cyan-300 ring-1 ring-cyan-400/40">
              총 {SAMPLE_RESERVATIONS_TODAY.length}건
            </span>
          </div>
          <ol className="mt-4 space-y-2">
            {SAMPLE_RESERVATIONS_TODAY.map((r) => (
              <li
                key={r.id}
                className={`grid grid-cols-[56px_1fr] gap-3 rounded-xl p-3 ${
                  r.type === "GROUP"
                    ? "bg-cyan-500/10 ring-1 ring-cyan-400/30"
                    : "bg-slate-800/60 ring-1 ring-slate-700"
                }`}
              >
                <div className="pt-1 text-sm font-medium tabular-nums text-cyan-300">
                  {fmtTime(r.startMin)}
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-white">{r.customer}</span>
                    {r.type === "GROUP" && (
                      <span className="rounded-full bg-cyan-400 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-950">
                        그룹 {r.enrolled}/{r.capacity}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">{r.service}</div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-2xl border border-cyan-500/20 bg-slate-900 p-5">
          <h2 className="font-heading text-base tracking-tight text-white">
            {monthLabel} 단체 수업
          </h2>
          <div className="mt-4 grid grid-cols-7 gap-1.5 text-center">
            {WEEKDAYS_KO.map((w) => (
              <span
                key={w}
                className="pb-2 text-[11px] font-bold uppercase tracking-wider text-cyan-300"
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
                      className={`relative h-16 overflow-hidden rounded-md p-1.5 text-left ${
                        isToday
                          ? "bg-slate-800 ring-2 ring-cyan-400 shadow-[0_0_20px_-5px_rgba(34,211,238,0.5)]"
                          : "bg-slate-800/40"
                      }`}
                    >
                      <div
                        className={`text-[11px] font-semibold ${
                          isToday ? "text-cyan-300" : "text-slate-500"
                        }`}
                      >
                        {day}
                      </div>
                      <div className="mt-1 text-[10px] text-slate-500">휴</div>
                    </div>
                  );
                }

                return (
                  <div
                    key={day}
                    className={`relative h-16 overflow-hidden rounded-md p-1.5 text-left ${
                      isToday
                        ? "bg-cyan-500/10 ring-2 ring-cyan-400 shadow-[0_0_20px_-5px_rgba(34,211,238,0.5)]"
                        : "border border-slate-700 bg-slate-800/30"
                    }`}
                  >
                    <div
                      className={`text-[11px] font-semibold ${
                        isToday ? "text-cyan-300" : "text-slate-100"
                      }`}
                    >
                      {day}
                    </div>
                    {classes.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {classes.slice(0, 2).map((name) => (
                          <li
                            key={name}
                            className="truncate text-[9px] font-medium text-cyan-300"
                          >
                            · {name}
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
