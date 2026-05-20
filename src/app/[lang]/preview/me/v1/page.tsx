import Link from "next/link";
import {
  TODAY_RES,
  UPCOMING,
  MEMBERSHIPS,
  PACKAGES,
  GYM_NAME,
  MEMBER_NAME,
  TODAY_LABEL,
  TODAY_KEY,
  buildCalendar,
  fmtMin,
} from "../_mock";

// V1 — Aurora Glow
// 핵심: violet/sky 라디얼 글로우 + 오늘 히어로 큰 ring + 캘린더 dot 강조.

export default async function PreviewMeV1({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const cells = buildCalendar();
  const today = TODAY_RES[0];

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-violet-500/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 top-1/3 h-96 w-96 rounded-full bg-sky-500/25 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-72 w-[120%] -translate-x-1/2 bg-fuchsia-500/10 blur-3xl" />

      <header className="relative border-b border-white/5 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-start justify-between px-6 py-5">
          <div>
            <Link
              href={`/${lang}/preview/me`}
              className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 hover:text-zinc-200"
            >
              ← 5개 시안
            </Link>
            <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-300/80">
              {GYM_NAME}
            </div>
            <div className="mt-1 font-heading text-xl tracking-tight text-white">
              {MEMBER_NAME}
            </div>
            <div className="mt-0.5 text-xs text-zinc-400">
              오늘 · {TODAY_LABEL}
            </div>
          </div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
            v1 aurora
          </div>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-3xl space-y-4 px-6 py-6">
        {/* 오늘 히어로 — glow + 큰 시각 */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600/20 via-zinc-900 to-sky-600/20 p-6 ring-1 ring-violet-400/30">
          <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-violet-500/40 blur-3xl" />
          <div className="relative">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-200/80">
              오늘의 일정
            </div>
            <div className="mt-3 flex items-baseline gap-3">
              <div className="font-heading text-5xl tracking-tight tabular-nums text-white drop-shadow-[0_0_24px_rgba(167,139,250,0.5)]">
                {fmtMin(today.startMin)}
              </div>
              <div className="text-base text-zinc-300 tabular-nums">
                — {fmtMin(today.endMin)}
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded-full bg-violet-500/20 px-2.5 py-0.5 text-xs font-medium text-violet-200 ring-1 ring-violet-400/40">
                {today.service}
              </span>
              <span className="text-sm text-zinc-300">
                {today.trainer} 트레이너
              </span>
            </div>
          </div>
        </section>

        {/* 출입 QR */}
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-2xl bg-gradient-to-r from-violet-500 to-sky-500 px-6 py-5 text-left text-white shadow-[0_0_32px_-8px_rgba(167,139,250,0.6)] transition hover:brightness-110"
        >
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-white/80">
              tap to open
            </div>
            <div className="mt-0.5 font-heading text-xl tracking-tight">
              출입 QR
            </div>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-2xl">
            ▦
          </div>
        </button>

        {/* 회원권 */}
        <section className="rounded-2xl bg-zinc-900/70 p-5 ring-1 ring-white/5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
            회원권
          </div>
          <ul className="mt-3 space-y-2">
            {MEMBERSHIPS.map((m) => {
              const soon = m.daysLeft <= 7;
              return (
                <li
                  key={m.id}
                  className={
                    "flex items-center justify-between rounded-xl px-4 py-3 ring-1 " +
                    (soon
                      ? "bg-amber-500/10 ring-amber-400/40"
                      : "bg-white/5 ring-white/10")
                  }
                >
                  <div>
                    <div className="text-sm font-medium text-zinc-100">
                      {m.name}
                    </div>
                    <div
                      className={
                        "mt-0.5 text-xs " +
                        (soon ? "text-amber-200" : "text-zinc-400")
                      }
                    >
                      {m.expiresOn} 만료
                    </div>
                  </div>
                  <div
                    className={
                      "font-heading text-lg tabular-nums " +
                      (soon ? "text-amber-200" : "text-zinc-200")
                    }
                  >
                    {m.daysLeft}일
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* 횟수권 */}
        <section className="rounded-2xl bg-zinc-900/70 p-5 ring-1 ring-white/5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
            횟수권
          </div>
          <ul className="mt-3 space-y-2">
            {PACKAGES.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10"
              >
                <div>
                  <div className="text-sm font-medium text-zinc-100">
                    {p.service}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-400">
                    담당 {p.trainer}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-heading text-lg tabular-nums text-violet-200">
                    {p.remaining}
                  </div>
                  <div className="text-[10px] text-zinc-500">/{p.total}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* 미니 캘린더 — 일정 있는 날 violet/sky dot */}
        <section className="rounded-2xl bg-zinc-900/70 p-5 ring-1 ring-white/5">
          <div className="flex items-baseline justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
              앞으로 5주
            </div>
            <div className="flex gap-3 text-[10px] text-zinc-500">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400" /> PT
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400" /> 단체
              </span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1.5 text-center text-[10px] text-zinc-500">
            {["일", "월", "화", "수", "목", "금", "토"].map((w) => (
              <div key={w} className="pb-1">
                {w}
              </div>
            ))}
            {cells.map((c) => {
              const dim = !c.isCurrentMonth || c.isPast;
              return (
                <div
                  key={c.dayKey}
                  className={
                    "relative flex h-11 flex-col items-center justify-center rounded-lg ring-1 transition " +
                    (c.isToday
                      ? "bg-violet-500/20 text-white ring-violet-400/70 shadow-[0_0_16px_-4px_rgba(167,139,250,0.7)]"
                      : c.hasEvent
                        ? "bg-white/5 text-zinc-100 ring-white/10"
                        : "ring-transparent " +
                          (dim ? "text-zinc-600" : "text-zinc-400"))
                  }
                >
                  <span className="text-sm font-medium tabular-nums">
                    {c.day}
                  </span>
                  {c.hasEvent && (
                    <span className="absolute bottom-1 flex gap-0.5">
                      {c.isPersonalEvent && (
                        <span className="h-1 w-1 rounded-full bg-violet-400" />
                      )}
                      {c.isGroupEvent && (
                        <span className="h-1 w-1 rounded-full bg-sky-400" />
                      )}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 다가오는 리스트 */}
        <section className="rounded-2xl bg-zinc-900/70 p-5 ring-1 ring-white/5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
            다가오는 예약
          </div>
          <ul className="mt-3 space-y-2">
            {UPCOMING.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10"
              >
                <div>
                  <div className="text-[11px] text-zinc-400">{r.dayKey}</div>
                  <div className="mt-0.5 text-sm font-medium text-zinc-100">
                    {fmtMin(r.startMin)} · {r.service}
                  </div>
                </div>
                <div className="text-xs text-zinc-400">{r.trainer}</div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
