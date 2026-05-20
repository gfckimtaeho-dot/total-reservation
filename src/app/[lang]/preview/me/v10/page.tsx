import Link from "next/link";
import {
  TODAY_RES,
  UPCOMING,
  MEMBERSHIPS,
  PACKAGES,
  GYM_NAME,
  MEMBER_NAME,
  TODAY_LABEL,
  buildCalendar,
  fmtMin,
} from "../_mock";

// V10 — Bauhaus Geometric
// 핵심: zinc-950 + primary 컬러 블록(빨/노/파). 강한 geometry, asymmetric.
// 오늘은 빨강 큰 사각 + 노랑 원 + 파랑 직사각형. 캘린더는 컬러 사각 fill.

export default async function PreviewMeV10({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const cells = buildCalendar();
  const today = TODAY_RES[0];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-3xl items-start justify-between px-6 py-5">
          <div>
            <Link
              href={`/${lang}/preview/me`}
              className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500 hover:text-yellow-300"
            >
              ← INDEX
            </Link>
            <div className="mt-2 flex items-center gap-2">
              <span className="h-3 w-3 bg-red-500" />
              <span className="h-3 w-3 rounded-full bg-yellow-400" />
              <span className="h-3 w-6 bg-blue-500" />
            </div>
            <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.32em] text-zinc-400">
              {GYM_NAME}
            </div>
            <div className="mt-1 font-heading text-3xl font-black uppercase tracking-tight text-white">
              {MEMBER_NAME}
            </div>
            <div className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">
              {TODAY_LABEL}
            </div>
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-600">
            V10 BAUHAUS
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-3 px-6 py-6">
        {/* 오늘 — primary 블록 컴포지션 */}
        <section className="relative grid grid-cols-3 gap-2">
          {/* 큰 빨강 (2칸) */}
          <div className="col-span-2 relative bg-red-500 p-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.32em] text-red-100">
              today
            </div>
            <div className="mt-4 font-heading text-7xl font-black leading-none tabular-nums text-white">
              {fmtMin(today.startMin)}
            </div>
            <div className="mt-2 text-sm font-bold uppercase tracking-wider text-red-50">
              {today.service} · {today.trainer}
            </div>
            {/* 코너 노랑 원 */}
            <div className="absolute -bottom-3 -right-3 h-10 w-10 rounded-full bg-yellow-400 ring-4 ring-zinc-950" />
          </div>
          {/* 파랑 세로 직사각 */}
          <div className="flex flex-col bg-blue-500 p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.32em] text-blue-100">
              end
            </div>
            <div className="mt-2 font-heading text-2xl font-black tabular-nums text-white">
              {fmtMin(today.endMin)}
            </div>
            <div className="mt-auto text-[10px] font-bold uppercase tracking-wider text-blue-100">
              50 min
            </div>
          </div>
        </section>

        {/* QR — 노란 큰 버튼 */}
        <button
          type="button"
          className="flex w-full items-center justify-between bg-yellow-400 px-6 py-5 text-left text-zinc-950 transition hover:bg-yellow-300"
        >
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.32em] text-zinc-700">
              scan now
            </div>
            <div className="mt-0.5 font-heading text-2xl font-black uppercase tracking-tight">
              QR ENTRY
            </div>
          </div>
          <div className="h-12 w-12 bg-zinc-950" />
        </button>

        {/* 회원권 + 횟수권 — 컬러 분리 블록 */}
        <section className="grid grid-cols-2 gap-2">
          {MEMBERSHIPS.map((m, i) => {
            const soon = m.daysLeft <= 7;
            return (
              <div
                key={m.id}
                className={
                  "p-4 " +
                  (soon
                    ? "bg-red-500 text-white"
                    : i === 0
                      ? "bg-blue-500 text-white"
                      : "bg-zinc-100 text-zinc-950")
                }
              >
                <div className="text-[10px] font-black uppercase tracking-[0.32em] opacity-70">
                  membership
                </div>
                <div className="mt-1 text-xs font-bold uppercase">
                  {m.name}
                </div>
                <div className="mt-3 font-heading text-4xl font-black tabular-nums">
                  {m.daysLeft}
                  <span className="ml-0.5 text-sm font-bold">D</span>
                </div>
                <div className="mt-1 text-[10px] font-bold uppercase opacity-70">
                  EXP {m.expiresOn}
                </div>
              </div>
            );
          })}
        </section>

        <section className="grid grid-cols-2 gap-2">
          {PACKAGES.map((p, i) => (
            <div
              key={p.id}
              className={
                "p-4 " +
                (i === 0
                  ? "bg-yellow-400 text-zinc-950"
                  : "bg-zinc-100 text-zinc-950")
              }
            >
              <div className="text-[10px] font-black uppercase tracking-[0.32em] opacity-70">
                pack
              </div>
              <div className="mt-1 text-xs font-bold uppercase">{p.service}</div>
              <div className="mt-3 font-heading text-4xl font-black tabular-nums">
                {p.remaining}
                <span className="ml-1 text-sm font-bold opacity-60">
                  /{p.total}
                </span>
              </div>
              <div className="mt-1 text-[10px] font-bold uppercase opacity-70">
                {p.trainer}
              </div>
            </div>
          ))}
        </section>

        {/* 캘린더 — 컬러 사각 fill (PT=빨강, group=노랑, 둘 다=파랑) */}
        <section className="bg-zinc-100 p-4 text-zinc-950">
          <div className="flex items-baseline justify-between">
            <div className="text-[10px] font-black uppercase tracking-[0.32em] text-zinc-700">
              5 weeks
            </div>
            <div className="flex gap-2 text-[10px] font-bold uppercase">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 bg-red-500" /> PT
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 bg-yellow-400" /> GRP
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 bg-blue-500" /> BOTH
              </span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1 text-center">
            {["일", "월", "화", "수", "목", "금", "토"].map((w) => (
              <div
                key={w}
                className="pb-1 text-[10px] font-black uppercase tracking-wider text-zinc-500"
              >
                {w}
              </div>
            ))}
            {cells.map((c) => {
              const dim = !c.isCurrentMonth || c.isPast;
              let cls = "bg-white text-zinc-300";
              if (c.isToday) {
                cls = "bg-zinc-950 text-white ring-2 ring-red-500";
              } else if (c.isPersonalEvent && c.isGroupEvent) {
                cls = "bg-blue-500 text-white";
              } else if (c.isPersonalEvent) {
                cls = "bg-red-500 text-white";
              } else if (c.isGroupEvent) {
                cls = "bg-yellow-400 text-zinc-950";
              } else if (dim) {
                cls = "bg-white text-zinc-300";
              } else {
                cls = "bg-white text-zinc-700";
              }
              return (
                <div
                  key={c.dayKey}
                  className={
                    "flex h-11 items-center justify-center font-heading text-sm font-black tabular-nums " +
                    cls
                  }
                >
                  {c.day}
                </div>
              );
            })}
          </div>
        </section>

        {/* 다가오는 */}
        <section className="bg-zinc-900 p-5">
          <div className="text-[10px] font-black uppercase tracking-[0.32em] text-zinc-500">
            upcoming
          </div>
          <ul className="mt-3 divide-y divide-zinc-800">
            {UPCOMING.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 py-3"
              >
                <span
                  className={
                    "h-10 w-10 shrink-0 " +
                    (r.isGroup ? "bg-yellow-400" : "bg-red-500")
                  }
                />
                <div className="flex-1">
                  <div className="font-heading text-base font-black uppercase text-white tabular-nums">
                    {fmtMin(r.startMin)}
                    <span className="ml-2 text-sm font-bold">
                      {r.service}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                    {r.dayKey} · {r.trainer}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
