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

// V4 — Bold Mono Editorial (트레이너)

export default async function PreviewTrainerV4({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const todays = getTodaySessions();

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-900 px-5 py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <Link
              href={`/${lang}/preview/trainer`}
              className="text-[11px] uppercase tracking-[0.32em] text-zinc-500 hover:text-white"
            >
              ← back
            </Link>
            <h1 className="mt-1 font-heading text-3xl font-extrabold tracking-tight text-white">
              {TRAINER_NAME}
            </h1>
            <div className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.22em] text-rose-500">
              {GYM_NAME} · {TODAY_LABEL}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="border-2 border-white bg-white px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-zinc-950 hover:bg-zinc-100">
              내 프로필
            </button>
            <button className="border-2 border-rose-500 bg-rose-500 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-white hover:bg-rose-400">
              발급
            </button>
            <button className="border-2 border-white px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-white hover:bg-white hover:text-zinc-950">
              실적
            </button>
            <button className="border-2 border-zinc-700 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-zinc-500 hover:text-white">
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 p-5">
        {/* 오늘 요약 */}
        <section className="border-y border-zinc-900 py-6">
          <div className="flex items-center gap-2">
            <span className="rounded-sm bg-rose-500 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.22em] text-white">
              today
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">
              {todays.length}건
            </span>
          </div>
          <ul className="mt-4 divide-y divide-zinc-900">
            {todays.map((s, i) => (
              <li
                key={i}
                className="flex items-baseline justify-between py-3"
              >
                <div className="flex items-baseline gap-5">
                  <span
                    className={
                      "font-heading text-4xl font-extrabold tabular-nums " +
                      (s.completed ? "text-zinc-500 line-through" : "text-white")
                    }
                  >
                    {fmtMin(s.slotMin)}
                  </span>
                  <div>
                    <div className="text-base font-bold text-white">
                      {s.name}
                    </div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                      {s.service}
                    </div>
                  </div>
                </div>
                {s.completed ? (
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-zinc-600">
                    done
                  </span>
                ) : (
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-rose-500">
                    upcoming
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* 슬롯 그리드 */}
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="font-heading text-2xl font-extrabold tracking-tight text-white">
              5/20 (화)
            </h2>
            <div className="flex gap-1">
              <button className="h-8 w-8 border border-white text-white hover:bg-white hover:text-zinc-950">
                ‹
              </button>
              <button className="h-8 border border-white px-3 text-[10px] font-extrabold uppercase tracking-wider text-white hover:bg-white hover:text-zinc-950">
                NOW
              </button>
              <button className="h-8 w-8 border border-white text-white hover:bg-white hover:text-zinc-950">
                ›
              </button>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <div className="flex min-w-max">
              <div className="sticky left-0 z-10 flex w-14 flex-col bg-zinc-950">
                <div className="h-10 border-b-2 border-white" />
                {SLOT_AXIS.map((s) => (
                  <div
                    key={s}
                    className="flex h-10 items-start justify-end pr-2 pt-1 font-mono text-[10px] font-bold tabular-nums text-zinc-500"
                  >
                    {fmtMin(s)}
                  </div>
                ))}
              </div>
              {DAYS.map((d, di) => (
                <div
                  key={di}
                  className="flex w-24 shrink-0 flex-col border-l border-zinc-900"
                >
                  <div
                    className={
                      "flex h-10 flex-col items-center justify-center border-b-2 font-heading " +
                      (d.isToday
                        ? "border-rose-500 bg-rose-500/15 text-rose-300"
                        : "border-white text-white")
                    }
                  >
                    <span className="font-extrabold tabular-nums">
                      {d.month}/{d.day}
                    </span>
                    <span className="text-[9px] uppercase">
                      {WD_KO[d.weekdayIdx]}
                    </span>
                  </div>
                  {d.cells.map((c, ci) => {
                    if (c.kind === "unavail") {
                      return (
                        <div
                          key={ci}
                          className="h-10 border-b border-zinc-900 bg-zinc-950"
                        />
                      );
                    }
                    if (c.kind === "free") {
                      return (
                        <div
                          key={ci}
                          className="flex h-10 items-center justify-center border-b border-zinc-900 bg-zinc-950 text-xs text-zinc-700 hover:bg-rose-500/10 hover:text-rose-400"
                        >
                          +
                        </div>
                      );
                    }
                    return (
                      <div
                        key={ci}
                        className={
                          "flex h-10 flex-col justify-center overflow-hidden border-b border-zinc-900 px-1.5 text-[10px] font-extrabold " +
                          (c.completed
                            ? "bg-zinc-900 text-zinc-500"
                            : "bg-white text-zinc-950")
                        }
                      >
                        <span className="truncate">
                          {c.completed && "✓ "}
                          {c.customerName}
                        </span>
                        <span className="truncate text-[8px] uppercase opacity-70">
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
