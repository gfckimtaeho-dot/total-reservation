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

// V5 — Pastel Glass (트레이너)

export default async function PreviewTrainerV5({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const todays = getTodaySessions();

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute -top-32 left-1/4 h-[28rem] w-[28rem] rounded-full bg-rose-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 top-1/3 h-[24rem] w-[24rem] rounded-full bg-emerald-400/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 left-0 h-[24rem] w-[28rem] rounded-full bg-sky-400/15 blur-3xl" />

      <header className="relative border-b border-white/5 px-5 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <Link
              href={`/${lang}/preview/trainer`}
              className="text-xs text-zinc-400 hover:text-rose-200"
            >
              ← 시안 목록
            </Link>
            <h1 className="mt-1 font-heading text-xl tracking-tight text-white">
              {TRAINER_NAME}
            </h1>
            <div className="mt-0.5 text-[11px] text-zinc-300/80">
              {GYM_NAME} · {TODAY_LABEL}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-full border border-rose-200/30 bg-white/5 px-3 py-1.5 text-xs font-semibold text-rose-100 backdrop-blur hover:bg-rose-300/20">
              내 프로필
            </button>
            <button className="rounded-full border border-emerald-200/30 bg-white/5 px-3 py-1.5 text-xs font-semibold text-emerald-100 backdrop-blur hover:bg-emerald-300/20">
              발급
            </button>
            <button className="rounded-full border border-sky-200/30 bg-white/5 px-3 py-1.5 text-xs font-semibold text-sky-100 backdrop-blur hover:bg-sky-300/20">
              실적
            </button>
            <button className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 backdrop-blur hover:text-white">
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl space-y-4 p-5">
        {/* 오늘 요약 */}
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
          <div className="absolute -inset-px rounded-3xl ring-1 ring-rose-300/30" />
          <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-rose-300/30 blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-rose-300/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-200 ring-1 ring-rose-200/40">
                  today
                </span>
                <span className="text-xs text-zinc-300">
                  오늘 {todays.length}건
                </span>
              </div>
              <div className="text-[10px] text-zinc-300/80">{TODAY_LABEL}</div>
            </div>
            <ul className="mt-3 space-y-2">
              {todays.map((s, i) => (
                <li
                  key={i}
                  className={
                    "flex items-center gap-3 rounded-2xl border px-3 py-2 backdrop-blur " +
                    (s.completed
                      ? "border-emerald-200/30 bg-emerald-300/10 text-emerald-100"
                      : "border-rose-200/30 bg-rose-300/10 text-white")
                  }
                >
                  <span
                    className={
                      "font-heading text-lg tabular-nums " +
                      (s.completed ? "text-emerald-200" : "text-white drop-shadow-[0_0_8px_rgba(252,165,165,0.4)]")
                    }
                  >
                    {fmtMin(s.slotMin)}
                  </span>
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-zinc-300">{s.service}</span>
                  {s.completed && (
                    <span className="ml-auto text-xs text-emerald-200">완료</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 슬롯 그리드 */}
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base tracking-tight text-white">
              5/20 (화) 일정
            </h2>
            <div className="flex gap-1">
              <button className="h-7 w-7 rounded-full border border-white/15 text-zinc-300 hover:bg-white/10">
                ‹
              </button>
              <button className="h-7 rounded-full border border-white/15 px-2 text-xs text-zinc-300">
                오늘
              </button>
              <button className="h-7 w-7 rounded-full border border-white/15 text-zinc-300 hover:bg-white/10">
                ›
              </button>
            </div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <div className="flex min-w-max">
              <div className="sticky left-0 z-10 flex w-14 flex-col bg-white/5 backdrop-blur-xl">
                <div className="h-10 border-b border-white/10" />
                {SLOT_AXIS.map((s) => (
                  <div
                    key={s}
                    className="flex h-10 items-start justify-end pr-2 pt-1 font-mono text-[10px] tabular-nums text-zinc-400"
                  >
                    {fmtMin(s)}
                  </div>
                ))}
              </div>
              {DAYS.map((d, di) => (
                <div
                  key={di}
                  className="flex w-24 shrink-0 flex-col border-l border-white/10"
                >
                  <div
                    className={
                      "flex h-10 flex-col items-center justify-center border-b text-[11px] font-bold " +
                      (d.isToday
                        ? "border-rose-200/30 bg-gradient-to-br from-rose-300/30 to-emerald-300/20 text-white"
                        : "border-white/10 text-zinc-300")
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
                          className="h-10 border-b border-white/10 bg-zinc-900/40"
                        />
                      );
                    }
                    if (c.kind === "free") {
                      return (
                        <div
                          key={ci}
                          className="flex h-10 items-center justify-center border-b border-white/10 bg-white/5 text-xs text-zinc-500 hover:bg-rose-300/15 hover:text-rose-200"
                        >
                          +
                        </div>
                      );
                    }
                    return (
                      <div
                        key={ci}
                        className={
                          "flex h-10 flex-col justify-center overflow-hidden border-b border-white/10 px-1.5 text-[10px] font-medium ring-1 ring-inset " +
                          (c.completed
                            ? "bg-emerald-300/15 text-emerald-100 ring-emerald-200/30"
                            : "bg-rose-300/15 text-white ring-rose-200/30")
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
