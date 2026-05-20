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

// V9 — Health App Dark (트레이너)

export default async function PreviewTrainerV9({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const todays = getTodaySessions();

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <header className="px-5 pt-5">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between">
            <Link
              href={`/${lang}/preview/trainer`}
              className="text-sm text-zinc-500 hover:text-zinc-100"
            >
              ←
            </Link>
            <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-600">
              v9 health
            </div>
          </div>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-zinc-500">
                {GYM_NAME}
              </div>
              <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight text-white">
                {TRAINER_NAME}
              </h1>
              <div className="mt-0.5 text-sm text-zinc-400">{TODAY_LABEL}</div>
            </div>
            <div className="flex items-center gap-2">
              <button className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-100 ring-1 ring-zinc-800 hover:bg-zinc-800">
                내 프로필
              </button>
              <button className="rounded-full bg-red-500 px-4 py-2 text-xs font-bold text-white shadow-[0_4px_18px_-4px_rgba(239,68,68,0.4)] hover:bg-red-400">
                발급
              </button>
              <button className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-zinc-800">
                실적
              </button>
              <button className="rounded-full bg-zinc-900 px-4 py-2 text-xs text-zinc-400 ring-1 ring-zinc-800 hover:text-white">
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-3 p-5">
        {/* 오늘 — red 활동 카드 */}
        <section className="relative overflow-hidden rounded-[2rem] bg-zinc-900 p-6 ring-1 ring-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-red-400">
                오늘 {todays.length}건
              </span>
            </div>
            <div className="text-[10px] text-zinc-500">{TODAY_LABEL}</div>
          </div>
          <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {todays.map((s, i) => (
              <li
                key={i}
                className={
                  "relative overflow-hidden rounded-2xl bg-zinc-950 p-4 ring-1 " +
                  (s.completed ? "ring-emerald-500/30" : "ring-red-500/30")
                }
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={
                      "h-1.5 w-1.5 rounded-full " +
                      (s.completed ? "bg-emerald-400" : "bg-red-400")
                    }
                  />
                  <span
                    className={
                      "text-[10px] font-semibold uppercase tracking-wider " +
                      (s.completed ? "text-emerald-300" : "text-red-300")
                    }
                  >
                    {s.completed ? "완료" : "예정"}
                  </span>
                </div>
                <div className="mt-2 font-heading text-2xl font-bold tabular-nums text-white">
                  {fmtMin(s.slotMin)}
                </div>
                <div className="mt-1 text-sm font-medium text-zinc-100">
                  {s.name}
                </div>
                <div className="text-xs text-zinc-500">{s.service}</div>
              </li>
            ))}
          </ul>
        </section>

        {/* 슬롯 그리드 — 부드러운 큰 라운드 */}
        <section className="rounded-[2rem] bg-zinc-900 p-5 ring-1 ring-zinc-800">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base font-bold tracking-tight text-white">
              5/20 (화) 일정
            </h2>
            <div className="flex gap-1">
              <button className="h-8 w-8 rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700">
                ‹
              </button>
              <button className="h-8 rounded-full bg-zinc-800 px-3 text-xs font-semibold text-zinc-200 hover:bg-zinc-700">
                오늘
              </button>
              <button className="h-8 w-8 rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700">
                ›
              </button>
            </div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <div className="flex min-w-max">
              <div className="sticky left-0 z-10 flex w-14 flex-col bg-zinc-900">
                <div className="h-10 border-b border-zinc-800" />
                {SLOT_AXIS.map((s) => (
                  <div
                    key={s}
                    className="flex h-10 items-start justify-end pr-2 pt-1 font-mono text-[10px] font-semibold tabular-nums text-zinc-500"
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
                      "flex h-10 flex-col items-center justify-center border-b text-[11px] font-bold " +
                      (d.isToday
                        ? "border-zinc-700 bg-white text-black"
                        : "border-zinc-800 text-zinc-300")
                    }
                  >
                    <span className="tabular-nums">
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
                          className="h-10 border-b border-zinc-900 bg-zinc-950/60"
                        />
                      );
                    }
                    if (c.kind === "free") {
                      return (
                        <div
                          key={ci}
                          className="flex h-10 items-center justify-center border-b border-zinc-900 bg-zinc-950 text-xs text-zinc-600 hover:bg-red-500/10 hover:text-red-300"
                        >
                          +
                        </div>
                      );
                    }
                    return (
                      <div
                        key={ci}
                        className={
                          "flex h-10 flex-col justify-center overflow-hidden border-b border-zinc-900 px-1.5 text-[10px] font-semibold ring-2 ring-inset " +
                          (c.completed
                            ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/40"
                            : "bg-red-500/20 text-red-100 ring-red-500/50")
                        }
                      >
                        <span className="truncate">
                          {c.completed && "✓ "}
                          {c.customerName}
                        </span>
                        <span className="truncate text-[8px] font-normal opacity-70">
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
