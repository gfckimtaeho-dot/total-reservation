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

// V10 — Bauhaus Geometric (트레이너)

export default async function PreviewTrainerV10({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const todays = getTodaySessions();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-5 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <Link
              href={`/${lang}/preview/trainer`}
              className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500 hover:text-yellow-300"
            >
              ← INDEX
            </Link>
            <div className="mt-1 flex items-center gap-2">
              <span className="h-3 w-3 bg-red-500" />
              <span className="h-3 w-3 rounded-full bg-yellow-400" />
              <span className="h-3 w-6 bg-blue-500" />
            </div>
            <h1 className="mt-1 font-heading text-3xl font-black uppercase tracking-tight text-white">
              {TRAINER_NAME}
            </h1>
            <div className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.32em] text-zinc-400">
              {GYM_NAME} · {TODAY_LABEL}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="bg-zinc-100 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-zinc-950 hover:bg-white">
              SHOWCASE
            </button>
            <button className="bg-red-500 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white hover:bg-red-400">
              INTAKE
            </button>
            <button className="bg-blue-500 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white hover:bg-blue-400">
              PERF
            </button>
            <button className="bg-zinc-900 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-zinc-500 hover:text-white">
              LOGOUT
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-3 p-5">
        {/* 오늘 — primary 블록 컴포지션 */}
        <section className="grid grid-cols-12 gap-2">
          <div className="col-span-3 bg-red-500 p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.32em] text-red-100">
              today
            </div>
            <div className="mt-3 font-heading text-6xl font-black leading-none tabular-nums text-white">
              {todays.length}
            </div>
            <div className="mt-2 text-xs font-bold uppercase text-red-100">
              건
            </div>
          </div>
          <ul className="col-span-9 grid grid-cols-3 gap-2">
            {todays.map((s, i) => {
              const palette = s.completed
                ? "bg-zinc-100 text-zinc-950"
                : i === 0
                  ? "bg-yellow-400 text-zinc-950"
                  : i === 1
                    ? "bg-blue-500 text-white"
                    : "bg-zinc-900 text-white ring-2 ring-red-500";
              return (
                <li key={i} className={"p-4 " + palette}>
                  <div className="text-[10px] font-black uppercase tracking-[0.32em] opacity-70">
                    session
                  </div>
                  <div className="mt-2 font-heading text-3xl font-black tabular-nums">
                    {fmtMin(s.slotMin)}
                  </div>
                  <div className="mt-1 text-xs font-bold uppercase">
                    {s.name}
                  </div>
                  <div className="mt-0.5 text-[10px] font-bold uppercase opacity-70">
                    {s.service}
                    {s.completed && " · DONE"}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* 슬롯 그리드 — primary 컬러 fill */}
        <section className="bg-zinc-100 p-4 text-zinc-950">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base font-black uppercase tracking-tight">
              5/20 (TUE) SCHEDULE
            </h2>
            <div className="flex gap-1">
              <button className="h-7 w-7 bg-zinc-950 text-white text-xs font-black hover:bg-zinc-800">
                ‹
              </button>
              <button className="h-7 bg-zinc-950 px-2 text-xs font-black uppercase text-white hover:bg-zinc-800">
                today
              </button>
              <button className="h-7 w-7 bg-zinc-950 text-white text-xs font-black hover:bg-zinc-800">
                ›
              </button>
            </div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <div className="flex min-w-max">
              <div className="sticky left-0 z-10 flex w-14 flex-col bg-zinc-100">
                <div className="h-10 border-b-2 border-zinc-950" />
                {SLOT_AXIS.map((s) => (
                  <div
                    key={s}
                    className="flex h-10 items-start justify-end pr-2 pt-1 font-mono text-[10px] font-black tabular-nums text-zinc-700"
                  >
                    {fmtMin(s)}
                  </div>
                ))}
              </div>
              {DAYS.map((d, di) => (
                <div
                  key={di}
                  className="flex w-24 shrink-0 flex-col border-l border-zinc-300"
                >
                  <div
                    className={
                      "flex h-10 flex-col items-center justify-center border-b-2 font-heading font-black " +
                      (d.isToday
                        ? "border-red-500 bg-zinc-950 text-white"
                        : "border-zinc-950 bg-white text-zinc-950")
                    }
                  >
                    <span className="text-xs tabular-nums">
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
                          className="h-10 border-b border-zinc-300 bg-zinc-200"
                        />
                      );
                    }
                    if (c.kind === "free") {
                      return (
                        <div
                          key={ci}
                          className="flex h-10 items-center justify-center border-b border-zinc-300 bg-white text-xs font-black text-zinc-400 hover:bg-yellow-400 hover:text-zinc-950"
                        >
                          +
                        </div>
                      );
                    }
                    const tone = c.completed
                      ? "bg-blue-500 text-white"
                      : ci % 2 === 0
                        ? "bg-red-500 text-white"
                        : "bg-yellow-400 text-zinc-950";
                    return (
                      <div
                        key={ci}
                        className={
                          "flex h-10 flex-col justify-center overflow-hidden border-b border-zinc-300 px-1.5 text-[10px] font-black " +
                          tone
                        }
                      >
                        <span className="truncate">
                          {c.completed && "✓ "}
                          {c.customerName}
                        </span>
                        <span className="truncate text-[8px] uppercase opacity-80">
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
