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

// V1 — Aurora Glow (트레이너)

export default async function PreviewTrainerV1({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const todays = getTodaySessions();

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-violet-500/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 top-1/3 h-96 w-96 rounded-full bg-sky-500/25 blur-3xl" />

      <header className="relative border-b border-white/5 px-5 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <Link
              href={`/${lang}/preview/trainer`}
              className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 hover:text-violet-200"
            >
              ← 시안 목록
            </Link>
            <h1 className="mt-1 font-heading text-xl tracking-tight text-white drop-shadow-[0_0_18px_rgba(167,139,250,0.4)]">
              {TRAINER_NAME}
            </h1>
            <div className="mt-0.5 text-[11px] text-violet-200/80">
              {GYM_NAME} · {TODAY_LABEL}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-md bg-gradient-to-r from-violet-500/20 to-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-200 ring-1 ring-violet-400/40 transition hover:from-violet-500/30">
              내 프로필
            </button>
            <button className="rounded-md bg-gradient-to-r from-sky-500/20 to-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-200 ring-1 ring-sky-400/40">
              발급
            </button>
            <button className="rounded-md bg-gradient-to-r from-fuchsia-500/20 to-fuchsia-500/10 px-3 py-1.5 text-xs font-semibold text-fuchsia-200 ring-1 ring-fuchsia-400/40">
              실적
            </button>
            <button className="rounded-md bg-white/5 px-3 py-1.5 text-xs text-zinc-400 ring-1 ring-white/10 hover:text-white">
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl space-y-4 p-5">
        {/* 오늘 요약 */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600/20 via-zinc-900 to-sky-600/20 p-5 ring-1 ring-violet-400/30">
          <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-violet-500/40 blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-200">
                오늘 {todays.length}건
              </div>
              <div className="text-[10px] text-zinc-400">{TODAY_LABEL}</div>
            </div>
            <ul className="mt-3 space-y-2">
              {todays.map((s, i) => (
                <li
                  key={i}
                  className={
                    "flex items-center gap-3 rounded-xl px-3 py-2 ring-1 " +
                    (s.completed
                      ? "bg-emerald-500/10 text-emerald-200 ring-emerald-500/30"
                      : "bg-violet-500/10 text-violet-100 ring-violet-400/40")
                  }
                >
                  <span className="font-heading text-lg tabular-nums text-white drop-shadow-[0_0_8px_rgba(167,139,250,0.5)]">
                    {fmtMin(s.slotMin)}
                  </span>
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-zinc-300">{s.service}</span>
                  {s.completed && (
                    <span className="ml-auto text-xs text-emerald-300">
                      완료
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 슬롯 그리드 */}
        <section className="overflow-hidden rounded-2xl bg-zinc-900/70 p-4 ring-1 ring-white/5">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base tracking-tight text-white">
              5/20 (화) 일정
            </h2>
            <div className="flex gap-1">
              <button className="h-7 w-7 rounded-md ring-1 ring-white/10 text-zinc-400 hover:bg-white/5">
                ‹
              </button>
              <button className="h-7 rounded-md px-2 text-xs ring-1 ring-white/10 text-zinc-400">
                오늘
              </button>
              <button className="h-7 w-7 rounded-md ring-1 ring-white/10 text-zinc-400 hover:bg-white/5">
                ›
              </button>
            </div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <div className="flex min-w-max">
              <div className="sticky left-0 z-10 flex w-14 flex-col bg-zinc-900/95">
                <div className="h-10 border-b border-white/15" />
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
                  className={
                    "flex w-24 shrink-0 flex-col border-l " +
                    (d.isToday ? "border-violet-400/30" : "border-white/10")
                  }
                >
                  <div
                    className={
                      "flex h-10 flex-col items-center justify-center border-b text-[11px] font-bold " +
                      (d.isToday
                        ? "border-violet-400/40 bg-violet-500/15 text-violet-200"
                        : "border-white/15 text-zinc-300")
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
                          className="flex h-10 items-center justify-center border-b border-white/10 bg-white/5 text-xs text-zinc-600 transition hover:bg-violet-500/15 hover:text-violet-200"
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
                            ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/40"
                            : "bg-gradient-to-br from-violet-500/25 to-sky-500/15 text-white ring-violet-400/40")
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
