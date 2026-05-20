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

// V8 — Sunset Gradient (트레이너)

export default async function PreviewTrainerV8({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const todays = getTodaySessions();

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-x-0 -top-20 h-[40rem] bg-gradient-to-b from-purple-700/30 via-pink-500/15 to-transparent" />
      <div className="pointer-events-none absolute -right-40 top-1/4 h-[28rem] w-[28rem] rounded-full bg-orange-500/25 blur-3xl" />
      <div className="pointer-events-none absolute -left-32 bottom-0 h-[26rem] w-[26rem] rounded-full bg-fuchsia-600/20 blur-3xl" />

      <header className="relative border-b border-white/5 px-5 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <Link
              href={`/${lang}/preview/trainer`}
              className="text-xs text-zinc-400 hover:text-orange-200"
            >
              ← 시안 목록
            </Link>
            <h1 className="mt-1 font-heading text-xl tracking-tight text-white">
              {TRAINER_NAME}
            </h1>
            <div className="mt-0.5 bg-gradient-to-r from-orange-300 to-pink-300 bg-clip-text text-[11px] font-semibold uppercase tracking-[0.22em] text-transparent">
              {GYM_NAME} · {TODAY_LABEL}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-full bg-gradient-to-r from-orange-500/20 to-pink-500/20 px-3 py-1.5 text-xs font-semibold text-orange-100 ring-1 ring-orange-400/40 hover:from-orange-500/30 hover:to-pink-500/30">
              내 프로필
            </button>
            <button className="rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-3 py-1.5 text-xs font-bold text-white shadow-[0_4px_18px_-6px_rgba(251,146,60,0.6)] hover:brightness-110">
              발급
            </button>
            <button className="rounded-full bg-gradient-to-r from-pink-500/20 to-purple-500/20 px-3 py-1.5 text-xs font-semibold text-pink-100 ring-1 ring-pink-400/40">
              실적
            </button>
            <button className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-zinc-400 ring-1 ring-white/10 hover:text-white">
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl space-y-4 p-5">
        {/* 오늘 */}
        <section className="relative overflow-hidden rounded-3xl p-[1.5px]">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500" />
          <div className="relative rounded-[calc(1.5rem-1.5px)] bg-zinc-950 p-5">
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-orange-500/40 blur-3xl" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-gradient-to-r from-orange-400 to-pink-500 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white">
                    today
                  </span>
                  <span className="text-xs text-zinc-300">
                    오늘 {todays.length}건
                  </span>
                </div>
                <div className="text-[10px] text-zinc-400">{TODAY_LABEL}</div>
              </div>
              <ul className="mt-3 space-y-2">
                {todays.map((s, i) => (
                  <li
                    key={i}
                    className={
                      "flex items-center gap-3 rounded-xl px-3 py-2 " +
                      (s.completed
                        ? "bg-zinc-900/70 text-zinc-300 ring-1 ring-white/5"
                        : "bg-zinc-900/70 ring-1 ring-orange-400/30")
                    }
                  >
                    <span
                      className={
                        "font-heading text-lg tabular-nums " +
                        (s.completed
                          ? "text-zinc-400"
                          : "bg-gradient-to-r from-orange-300 to-pink-300 bg-clip-text text-transparent")
                      }
                    >
                      {fmtMin(s.slotMin)}
                    </span>
                    <span className="font-medium text-white">{s.name}</span>
                    <span className="text-xs text-zinc-400">{s.service}</span>
                    {s.completed && (
                      <span className="ml-auto text-xs text-zinc-400">
                        완료
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 슬롯 그리드 */}
        <section className="rounded-2xl bg-zinc-900/70 p-4 ring-1 ring-white/5 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base tracking-tight text-white">
              5/20 (화) 일정
            </h2>
            <div className="flex gap-1">
              <button className="h-7 w-7 rounded-full ring-1 ring-white/10 text-zinc-300 hover:bg-white/5">
                ‹
              </button>
              <button className="h-7 rounded-full px-2 text-xs ring-1 ring-white/10 text-zinc-300">
                오늘
              </button>
              <button className="h-7 w-7 rounded-full ring-1 ring-white/10 text-zinc-300 hover:bg-white/5">
                ›
              </button>
            </div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <div className="flex min-w-max">
              <div className="sticky left-0 z-10 flex w-14 flex-col bg-zinc-900/95">
                <div className="h-10 border-b border-white/10" />
                {SLOT_AXIS.map((s) => (
                  <div
                    key={s}
                    className="flex h-10 items-start justify-end pr-2 pt-1 font-mono text-[10px] tabular-nums text-zinc-500"
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
                        ? "border-pink-400/30 bg-gradient-to-br from-orange-400/30 via-pink-500/20 to-purple-500/20 text-white"
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
                          className="h-10 border-b border-white/10 bg-zinc-950"
                        />
                      );
                    }
                    if (c.kind === "free") {
                      return (
                        <div
                          key={ci}
                          className="flex h-10 items-center justify-center border-b border-white/10 bg-white/5 text-xs text-zinc-600 hover:bg-orange-500/15 hover:text-orange-200"
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
                            ? "bg-zinc-800/70 text-zinc-400 ring-white/10"
                            : "bg-gradient-to-br from-orange-500/25 via-pink-500/15 to-purple-500/15 text-white ring-pink-400/30")
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
