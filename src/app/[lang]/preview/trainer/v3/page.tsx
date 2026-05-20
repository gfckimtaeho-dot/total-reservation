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

// V3 — Calm Slate (트레이너)

export default async function PreviewTrainerV3({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const todays = getTodaySessions();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-800 px-5 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <Link
              href={`/${lang}/preview/trainer`}
              className="text-xs text-slate-400 hover:text-slate-100"
            >
              ← 시안 목록
            </Link>
            <h1 className="mt-1 font-heading text-xl tracking-tight text-white">
              {TRAINER_NAME}
            </h1>
            <div className="mt-0.5 text-[11px] text-slate-400">
              {GYM_NAME} · {TODAY_LABEL}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 hover:bg-slate-700">
              내 프로필
            </button>
            <button className="rounded-md bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-amber-300">
              발급
            </button>
            <button className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-100 ring-1 ring-slate-700 hover:bg-slate-700">
              실적
            </button>
            <button className="rounded-md bg-slate-800 px-3 py-1.5 text-xs text-slate-400 ring-1 ring-slate-700 hover:text-white">
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 p-5">
        {/* 오늘 요약 */}
        <section className="relative flex overflow-hidden rounded-2xl bg-slate-800 ring-1 ring-slate-700">
          <div className="w-1.5 bg-amber-400" />
          <div className="flex-1 p-5">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-300">
                오늘 {todays.length}건
              </div>
              <div className="text-[10px] text-slate-400">{TODAY_LABEL}</div>
            </div>
            <ul className="mt-3 space-y-2">
              {todays.map((s, i) => (
                <li
                  key={i}
                  className={
                    "flex items-center gap-3 rounded-lg px-3 py-2 " +
                    (s.completed
                      ? "bg-slate-700/40 text-slate-200"
                      : "bg-amber-400/15 text-amber-100 ring-1 ring-amber-400/30")
                  }
                >
                  <span
                    className={
                      "font-heading text-lg tabular-nums " +
                      (s.completed ? "text-slate-100" : "text-amber-200")
                    }
                  >
                    {fmtMin(s.slotMin)}
                  </span>
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-slate-300">{s.service}</span>
                  {s.completed && (
                    <span className="ml-auto text-xs text-slate-300">완료</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 슬롯 그리드 */}
        <section className="overflow-hidden rounded-2xl bg-slate-800 p-4 ring-1 ring-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base tracking-tight text-white">
              5/20 (화) 일정
            </h2>
            <div className="flex gap-1">
              <button className="h-7 w-7 rounded-md ring-1 ring-slate-700 text-slate-300 hover:bg-slate-700">
                ‹
              </button>
              <button className="h-7 rounded-md px-2 text-xs ring-1 ring-slate-700 text-slate-300">
                오늘
              </button>
              <button className="h-7 w-7 rounded-md ring-1 ring-slate-700 text-slate-300 hover:bg-slate-700">
                ›
              </button>
            </div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <div className="flex min-w-max">
              <div className="sticky left-0 z-10 flex w-14 flex-col bg-slate-800">
                <div className="h-10 border-b border-slate-700" />
                {SLOT_AXIS.map((s) => (
                  <div
                    key={s}
                    className="flex h-10 items-start justify-end pr-2 pt-1 font-mono text-[10px] tabular-nums text-slate-500"
                  >
                    {fmtMin(s)}
                  </div>
                ))}
              </div>
              {DAYS.map((d, di) => (
                <div
                  key={di}
                  className="flex w-24 shrink-0 flex-col border-l border-slate-700"
                >
                  <div
                    className={
                      "flex h-10 flex-col items-center justify-center border-b text-[11px] font-bold " +
                      (d.isToday
                        ? "border-amber-400/40 bg-amber-400 text-slate-900"
                        : "border-slate-700 text-slate-300")
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
                          className="h-10 border-b border-slate-700/50 bg-slate-900"
                        />
                      );
                    }
                    if (c.kind === "free") {
                      return (
                        <div
                          key={ci}
                          className="flex h-10 items-center justify-center border-b border-slate-700/50 bg-slate-700/30 text-xs text-slate-500 hover:bg-amber-400/15 hover:text-amber-200"
                        >
                          +
                        </div>
                      );
                    }
                    return (
                      <div
                        key={ci}
                        className={
                          "flex h-10 flex-col justify-center overflow-hidden border-b border-slate-700/50 px-1.5 text-[10px] font-medium " +
                          (c.completed
                            ? "bg-slate-700/60 text-slate-200"
                            : "bg-amber-400/20 text-amber-100 ring-1 ring-inset ring-amber-400/40")
                        }
                      >
                        <span className="truncate">
                          {c.completed && "✓ "}
                          {c.customerName}
                        </span>
                        <span className="truncate text-[8px] opacity-70">
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
