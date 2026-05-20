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

// V4 — Bold Mono Editorial
// 핵심: 매거진 무드. 거대한 흰 typography + red 한 점.
// 캘린더는 가로 스크롤 일자 리스트(주 단위 묶음), 일정 있는 날은 빨간 underline.

export default async function PreviewMeV4({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const cells = buildCalendar();
  const today = TODAY_RES[0];

  // 주 단위 묶음 (5주)
  const weeks: typeof cells[] = [];
  for (let i = 0; i < 5; i++) {
    weeks.push(cells.slice(i * 7, (i + 1) * 7));
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-900">
        <div className="mx-auto flex max-w-3xl items-start justify-between px-6 py-5">
          <div>
            <Link
              href={`/${lang}/preview/me`}
              className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 hover:text-white"
            >
              ← back
            </Link>
            <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.32em] text-rose-500">
              {GYM_NAME}
            </div>
            <div className="mt-1 font-heading text-3xl font-extrabold tracking-tight">
              {MEMBER_NAME}
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.22em] text-zinc-400">
              {TODAY_LABEL}
            </div>
          </div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-600">
            v4 mono
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-8 px-6 py-8">
        {/* 오늘 — 거대 typography */}
        <section className="border-y border-zinc-900 py-8">
          <div className="flex items-center gap-2">
            <span className="rounded-sm bg-rose-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.22em] text-white">
              today
            </span>
            <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">
              오늘의 일정
            </span>
          </div>
          <div className="mt-4 font-heading text-7xl font-extrabold leading-none tabular-nums text-white">
            {fmtMin(today.startMin)}
          </div>
          <div className="mt-3 flex items-center gap-3 text-zinc-300">
            <span className="font-mono text-sm tabular-nums">
              → {fmtMin(today.endMin)}
            </span>
            <span className="h-1 w-1 rounded-full bg-zinc-700" />
            <span className="text-sm font-semibold uppercase tracking-wide">
              {today.service}
            </span>
            <span className="h-1 w-1 rounded-full bg-zinc-700" />
            <span className="text-sm">{today.trainer}</span>
          </div>
        </section>

        {/* QR — 직사각 단순 */}
        <button
          type="button"
          className="flex w-full items-center justify-between border-2 border-white bg-white px-6 py-5 text-left text-zinc-950 transition hover:bg-zinc-100"
        >
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.32em] text-rose-500">
              scan now
            </div>
            <div className="mt-0.5 font-heading text-2xl font-extrabold uppercase tracking-tight">
              Access QR
            </div>
          </div>
          <div className="text-3xl">▣</div>
        </button>

        {/* 회원권 + 횟수권 통합 — list editorial */}
        <section>
          <div className="text-[11px] font-bold uppercase tracking-[0.32em] text-zinc-500">
            보유 회원권 / 횟수권
          </div>
          <ul className="mt-4 divide-y divide-zinc-900">
            {MEMBERSHIPS.map((m) => {
              const soon = m.daysLeft <= 7;
              return (
                <li key={m.id} className="flex items-baseline justify-between py-3">
                  <div>
                    <div className="text-base font-semibold text-white">
                      {m.name}
                    </div>
                    <div
                      className={
                        "mt-0.5 text-xs " +
                        (soon ? "text-rose-400" : "text-zinc-500")
                      }
                    >
                      {m.expiresOn} 만료{soon ? " — 곧 만료" : ""}
                    </div>
                  </div>
                  <div
                    className={
                      "font-heading text-3xl font-extrabold tabular-nums " +
                      (soon ? "text-rose-400" : "text-white")
                    }
                  >
                    {m.daysLeft}
                    <span className="ml-0.5 text-sm font-normal text-zinc-500">
                      일
                    </span>
                  </div>
                </li>
              );
            })}
            {PACKAGES.map((p) => (
              <li key={p.id} className="flex items-baseline justify-between py-3">
                <div>
                  <div className="text-base font-semibold text-white">
                    {p.service}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    담당 {p.trainer}
                  </div>
                </div>
                <div className="font-heading text-3xl font-extrabold tabular-nums text-white">
                  {p.remaining}
                  <span className="ml-0.5 text-sm font-normal text-zinc-500">
                    /{p.total}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* 캘린더 — 주 단위 가로 일자 */}
        <section>
          <div className="flex items-baseline justify-between">
            <div className="text-[11px] font-bold uppercase tracking-[0.32em] text-zinc-500">
              앞으로 5주
            </div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
              <span className="border-b-2 border-rose-500 pb-0.5 font-bold text-rose-400">
                RED
              </span>{" "}
              = 일정 있는 날
            </div>
          </div>
          <div className="mt-4 space-y-1.5">
            {weeks.map((wk, wi) => (
              <div
                key={wi}
                className="grid grid-cols-7 gap-1 border-b border-zinc-900 pb-1.5"
              >
                {wk.map((c) => {
                  const dim = !c.isCurrentMonth || c.isPast;
                  return (
                    <div
                      key={c.dayKey}
                      className={
                        "flex flex-col items-center justify-center py-2 " +
                        (c.isToday
                          ? "bg-rose-500/15"
                          : c.hasEvent
                            ? ""
                            : "")
                      }
                    >
                      <span
                        className={
                          "text-[10px] uppercase tracking-wider " +
                          (c.isToday
                            ? "text-rose-300"
                            : dim
                              ? "text-zinc-700"
                              : "text-zinc-500")
                        }
                      >
                        {["일", "월", "화", "수", "목", "금", "토"][c.weekdayIdx]}
                      </span>
                      <span
                        className={
                          "mt-1 font-heading text-2xl font-extrabold tabular-nums " +
                          (c.isToday
                            ? "text-rose-400"
                            : dim
                              ? "text-zinc-700"
                              : c.hasEvent
                                ? "text-white"
                                : "text-zinc-500") +
                          (c.hasEvent && !c.isToday
                            ? " border-b-2 border-rose-500"
                            : "")
                        }
                      >
                        {c.day}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>

        {/* 다가오는 리스트 */}
        <section>
          <div className="text-[11px] font-bold uppercase tracking-[0.32em] text-zinc-500">
            다가오는 예약
          </div>
          <ul className="mt-4 divide-y divide-zinc-900">
            {UPCOMING.map((r) => (
              <li
                key={r.id}
                className="flex items-baseline justify-between py-3"
              >
                <div className="flex items-baseline gap-4">
                  <span className="font-heading text-xl font-extrabold tabular-nums text-white">
                    {fmtMin(r.startMin)}
                  </span>
                  <span className="text-sm text-zinc-300">{r.service}</span>
                </div>
                <div className="text-xs uppercase tracking-wider text-zinc-500">
                  {r.dayKey.slice(5)} · {r.trainer}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
