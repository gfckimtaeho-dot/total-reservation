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

const accent = {
  border: "border-amber-400/25",
  divide: "divide-amber-400/15",
  ring: "ring-amber-400/30",
  text: "text-amber-300",
  pill: "bg-amber-400/15 text-amber-300 ring-amber-400/40",
  badge: "bg-amber-400 text-zinc-950",
  todayBg: "bg-amber-400/10",
  todayRing: "ring-amber-400",
  cellBorder: "border-amber-400/15",
};

export default function TrainerV7() {
  const { monthLabel, monthInfo, todayDisplay } = buildSampleProps();

  return (
    <div className="flex min-h-screen flex-col bg-black text-zinc-100">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <h1 className="font-heading text-lg tracking-tight text-white">
            {SAMPLE_TRAINER_NAME}
          </h1>
          <p className={`mt-0.5 text-[11px] ${accent.text}`}>
            v7 · Black Amber · {todayDisplay}
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
        <section className={`rounded-2xl border ${accent.border} bg-black p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-heading text-base tracking-tight text-white">
              오늘의 일정
            </h2>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums ring-1 ${accent.pill}`}>
              총 {SAMPLE_RESERVATIONS_TODAY.length}건
            </span>
          </div>
          <ol className={`mt-4 divide-y ${accent.divide}`}>
            {SAMPLE_RESERVATIONS_TODAY.map((r) => (
              <li
                key={r.id}
                className="grid grid-cols-[56px_1fr] gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className={`pt-1 font-mono text-sm font-semibold tabular-nums ${accent.text}`}>
                  {fmtTime(r.startMin)}
                </div>
                <div className={`rounded-xl bg-zinc-900 p-3 ring-1 ${accent.ring}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-white">{r.customer}</span>
                    {r.type === "GROUP" && (
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${accent.badge}`}>
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

        <section className={`rounded-2xl border ${accent.border} bg-black p-5`}>
          <h2 className="font-heading text-base tracking-tight text-white">
            {monthLabel}
          </h2>
          <div className="mt-4 grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS_KO.map((w) => (
              <span
                key={w}
                className={`border-b-2 pb-2 text-[11px] font-bold text-white ${accent.border}`}
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
                      className={`relative h-16 overflow-hidden rounded-md border bg-zinc-900/50 p-1.5 text-left ${
                        isToday ? `ring-2 ${accent.todayRing} ${accent.cellBorder}` : `${accent.cellBorder}`
                      }`}
                    >
                      <div
                        className={`text-[11px] font-bold ${
                          isToday ? accent.text : "text-zinc-500"
                        }`}
                      >
                        {day}
                      </div>
                      <div
                        className={`mt-0.5 text-[9px] uppercase tracking-wider ${
                          isToday ? accent.text : "text-zinc-600"
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
                    className={`relative h-16 overflow-hidden rounded-md border p-1.5 text-left ${
                      isToday
                        ? `${accent.todayBg} ring-2 ${accent.todayRing} ${accent.cellBorder}`
                        : `bg-zinc-900 ${accent.cellBorder}`
                    }`}
                  >
                    <div
                      className={`text-[11px] font-bold ${
                        isToday ? accent.text : "text-zinc-100"
                      }`}
                    >
                      {day}
                    </div>
                    {classes.length > 0 && (
                      <div className={`mt-1 truncate text-[9px] font-medium ${accent.text}`}>
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
