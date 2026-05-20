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

// V8 — Sunset Gradient
// 핵심: deep purple → sunset orange/coral 그라데. 따뜻한 야간 라이트.
// 오늘에 sunset glow, 캘린더는 그라데 chip.

export default async function PreviewMeV8({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const cells = buildCalendar();
  const today = TODAY_RES[0];

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-x-0 -top-20 h-[40rem] bg-gradient-to-b from-purple-700/30 via-pink-500/15 to-transparent" />
      <div className="pointer-events-none absolute -right-40 top-1/4 h-[28rem] w-[28rem] rounded-full bg-orange-500/25 blur-3xl" />
      <div className="pointer-events-none absolute -left-32 bottom-0 h-[26rem] w-[26rem] rounded-full bg-fuchsia-600/20 blur-3xl" />

      <header className="relative border-b border-white/5">
        <div className="mx-auto flex max-w-3xl items-start justify-between px-6 py-5">
          <div>
            <Link
              href={`/${lang}/preview/me`}
              className="text-xs text-zinc-400 hover:text-orange-200"
            >
              ← 시안 목록
            </Link>
            <div className="mt-2 bg-gradient-to-r from-orange-300 to-pink-300 bg-clip-text text-[11px] font-semibold uppercase tracking-[0.22em] text-transparent">
              {GYM_NAME}
            </div>
            <div className="mt-1 font-heading text-xl tracking-tight text-white">
              {MEMBER_NAME}
            </div>
            <div className="mt-0.5 text-xs text-orange-200/70">
              오늘 · {TODAY_LABEL}
            </div>
          </div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
            v8 sunset
          </div>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-3xl space-y-4 px-6 py-6">
        {/* 오늘 — sunset 그라데 ring + glow */}
        <section className="relative overflow-hidden rounded-3xl p-[1.5px]">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500" />
          <div className="relative rounded-[calc(1.5rem-1.5px)] bg-zinc-950 p-6">
            <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-orange-500/40 blur-3xl" />
            <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-purple-500/40 blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-gradient-to-r from-orange-400 to-pink-500 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white">
                  today
                </span>
                <span className="text-xs text-zinc-300">오늘의 일정</span>
              </div>
              <div className="mt-3 flex items-baseline gap-3">
                <div className="bg-gradient-to-r from-orange-300 via-pink-300 to-purple-300 bg-clip-text font-heading text-5xl tracking-tight tabular-nums text-transparent drop-shadow-[0_0_20px_rgba(251,113,133,0.4)]">
                  {fmtMin(today.startMin)}
                </div>
                <div className="text-base text-zinc-300 tabular-nums">
                  — {fmtMin(today.endMin)}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm text-zinc-200">
                <span>{today.service}</span>
                <span className="h-1 w-1 rounded-full bg-orange-400/60" />
                <span>{today.trainer} 트레이너</span>
              </div>
            </div>
          </div>
        </section>

        {/* QR — 따뜻한 그라데 */}
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-2xl bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 px-6 py-5 text-left text-white shadow-[0_8px_32px_-12px_rgba(251,146,60,0.6)] transition hover:brightness-110"
        >
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-white/80">
              tap to open
            </div>
            <div className="mt-0.5 font-heading text-xl tracking-tight">
              출입 QR
            </div>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 text-2xl backdrop-blur">
            ▦
          </div>
        </button>

        {/* 회원권 + 횟수권 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <section className="rounded-2xl bg-zinc-900/70 p-5 ring-1 ring-orange-500/15 backdrop-blur-sm">
            <div className="bg-gradient-to-r from-orange-300 to-pink-300 bg-clip-text text-[10px] font-semibold uppercase tracking-[0.22em] text-transparent">
              회원권
            </div>
            <ul className="mt-3 space-y-2.5">
              {MEMBERSHIPS.map((m) => {
                const soon = m.daysLeft <= 7;
                return (
                  <li key={m.id} className="text-sm">
                    <div className="flex items-baseline justify-between">
                      <div className="font-medium text-zinc-100">{m.name}</div>
                      <div
                        className={
                          "font-heading tabular-nums " +
                          (soon
                            ? "bg-gradient-to-r from-orange-300 to-pink-300 bg-clip-text text-transparent"
                            : "text-zinc-200")
                        }
                      >
                        {m.daysLeft}일
                      </div>
                    </div>
                    <div
                      className={
                        "text-xs " +
                        (soon ? "text-orange-200" : "text-zinc-400")
                      }
                    >
                      {m.expiresOn} 만료{soon && " · 곧"}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-2xl bg-zinc-900/70 p-5 ring-1 ring-purple-500/15 backdrop-blur-sm">
            <div className="bg-gradient-to-r from-pink-300 to-purple-300 bg-clip-text text-[10px] font-semibold uppercase tracking-[0.22em] text-transparent">
              횟수권
            </div>
            <ul className="mt-3 space-y-2.5">
              {PACKAGES.map((p) => (
                <li key={p.id} className="text-sm">
                  <div className="flex items-baseline justify-between">
                    <div className="font-medium text-zinc-100">{p.service}</div>
                    <div className="font-heading tabular-nums">
                      <span className="bg-gradient-to-r from-pink-300 to-purple-300 bg-clip-text text-transparent">
                        {p.remaining}
                      </span>
                      <span className="text-zinc-500"> /{p.total}</span>
                    </div>
                  </div>
                  <div className="text-xs text-zinc-400">담당 {p.trainer}</div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* 캘린더 — sunset 그라데 chip */}
        <section className="rounded-2xl bg-zinc-900/70 p-5 ring-1 ring-white/5 backdrop-blur-sm">
          <div className="flex items-baseline justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-300">
              앞으로 5주
            </div>
            <div className="flex gap-3 text-[10px] text-zinc-400">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-400" /> PT
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-400" /> 단체
              </span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1.5 text-center text-[10px] text-zinc-400">
            {["일", "월", "화", "수", "목", "금", "토"].map((w) => (
              <div key={w} className="pb-1">
                {w}
              </div>
            ))}
            {cells.map((c) => {
              const dim = !c.isCurrentMonth || c.isPast;
              let cls = "";
              if (c.isToday) {
                cls =
                  "bg-gradient-to-br from-orange-400 via-pink-500 to-purple-500 text-white shadow-[0_0_16px_-4px_rgba(251,113,133,0.6)]";
              } else if (c.isPersonalEvent && c.isGroupEvent) {
                cls =
                  "bg-gradient-to-br from-orange-400/30 to-purple-500/30 text-white ring-1 ring-pink-400/40";
              } else if (c.isPersonalEvent) {
                cls = "bg-orange-500/20 text-white ring-1 ring-orange-400/40";
              } else if (c.isGroupEvent) {
                cls = "bg-purple-500/20 text-white ring-1 ring-purple-400/40";
              } else {
                cls = dim ? "text-zinc-600" : "text-zinc-300";
              }
              return (
                <div
                  key={c.dayKey}
                  className={
                    "flex h-11 items-center justify-center rounded-xl text-sm tabular-nums transition " +
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
        <section className="rounded-2xl bg-zinc-900/70 p-5 ring-1 ring-white/5 backdrop-blur-sm">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-300">
            다가오는 예약
          </div>
          <ul className="mt-3 space-y-2">
            {UPCOMING.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/5"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={
                      "rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
                      (r.isGroup
                        ? "bg-gradient-to-r from-pink-400 to-purple-500 text-white"
                        : "bg-gradient-to-r from-orange-400 to-pink-500 text-white")
                    }
                  >
                    {r.isGroup ? "단체" : "PT"}
                  </span>
                  <div>
                    <div className="text-[11px] text-zinc-400">{r.dayKey}</div>
                    <div className="mt-0.5 text-sm font-medium text-zinc-100">
                      {fmtMin(r.startMin)} · {r.service}
                    </div>
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
