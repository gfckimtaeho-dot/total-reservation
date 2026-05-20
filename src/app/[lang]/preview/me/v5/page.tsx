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

// V5 — Pastel Glass
// 핵심: 글래스모피즘. 라이트 핑크/민트 라디얼 backdrop + 카드 backdrop-blur.
// 캘린더는 day cell에 pastel chip 표시 (PT=rose, group=emerald).

export default async function PreviewMeV5({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const cells = buildCalendar();
  const today = TODAY_RES[0];

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute -top-32 left-1/4 h-[28rem] w-[28rem] rounded-full bg-rose-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 top-1/3 h-[24rem] w-[24rem] rounded-full bg-emerald-400/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 left-0 h-[24rem] w-[28rem] rounded-full bg-sky-400/15 blur-3xl" />

      <header className="relative border-b border-white/5 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-start justify-between px-6 py-5">
          <div>
            <Link
              href={`/${lang}/preview/me`}
              className="text-xs text-zinc-400 hover:text-rose-200"
            >
              ← 시안 목록
            </Link>
            <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-200/90">
              {GYM_NAME}
            </div>
            <div className="mt-1 font-heading text-xl tracking-tight text-white">
              {MEMBER_NAME}
            </div>
            <div className="mt-0.5 text-xs text-zinc-300/80">
              오늘 · {TODAY_LABEL}
            </div>
          </div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
            v5 glass
          </div>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-3xl space-y-4 px-6 py-6">
        {/* 오늘 — glass 카드 + rose ring + 큰 시각 + glow */}
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="absolute -inset-px rounded-3xl ring-1 ring-rose-300/30" />
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-rose-300/30 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-rose-300/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-200 ring-1 ring-rose-200/40">
                today
              </span>
              <span className="text-xs text-zinc-300">오늘의 일정</span>
            </div>
            <div className="mt-3 flex items-baseline gap-3">
              <div className="font-heading text-5xl tracking-tight tabular-nums text-white drop-shadow-[0_0_24px_rgba(252,165,165,0.45)]">
                {fmtMin(today.startMin)}
              </div>
              <div className="text-base text-zinc-300 tabular-nums">
                — {fmtMin(today.endMin)}
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm text-zinc-200">
              <span>{today.service}</span>
              <span className="h-1 w-1 rounded-full bg-zinc-500" />
              <span>{today.trainer} 트레이너</span>
            </div>
          </div>
        </section>

        {/* QR — glass + rose→emerald gradient */}
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-gradient-to-r from-rose-300/20 via-white/5 to-emerald-300/20 px-6 py-5 text-left text-white backdrop-blur-xl transition hover:from-rose-300/30 hover:to-emerald-300/30"
        >
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-rose-100/90">
              tap to open
            </div>
            <div className="mt-0.5 font-heading text-xl tracking-tight">
              출입 QR
            </div>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-2xl backdrop-blur">
            ▦
          </div>
        </button>

        {/* 회원권 + 횟수권 — 2열 glass */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-200/90">
              회원권
            </div>
            <ul className="mt-3 space-y-2.5">
              {MEMBERSHIPS.map((m) => {
                const soon = m.daysLeft <= 7;
                return (
                  <li key={m.id} className="text-sm">
                    <div className="flex items-baseline justify-between">
                      <div className="font-medium text-white">{m.name}</div>
                      <div
                        className={
                          "font-heading tabular-nums " +
                          (soon ? "text-amber-200" : "text-zinc-100")
                        }
                      >
                        {m.daysLeft}일
                      </div>
                    </div>
                    <div
                      className={
                        "text-xs " +
                        (soon ? "text-amber-200/80" : "text-zinc-400")
                      }
                    >
                      {m.expiresOn} 만료
                      {soon && (
                        <span className="ml-1 font-semibold">· 곧</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-200/90">
              횟수권
            </div>
            <ul className="mt-3 space-y-2.5">
              {PACKAGES.map((p) => (
                <li key={p.id} className="text-sm">
                  <div className="flex items-baseline justify-between">
                    <div className="font-medium text-white">{p.service}</div>
                    <div className="font-heading tabular-nums">
                      <span className="text-emerald-200">{p.remaining}</span>
                      <span className="text-zinc-500"> /{p.total}</span>
                    </div>
                  </div>
                  <div className="text-xs text-zinc-400">담당 {p.trainer}</div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* 캘린더 — pastel chip */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
          <div className="flex items-baseline justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-300">
              앞으로 5주
            </div>
            <div className="flex gap-3 text-[10px] text-zinc-400">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-300" /> PT
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> 단체
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
              const bg = c.isToday
                ? "bg-gradient-to-br from-rose-300/35 to-emerald-300/25 text-white ring-1 ring-rose-200/50"
                : c.isPersonalEvent && c.isGroupEvent
                  ? "bg-gradient-to-br from-rose-300/20 to-emerald-300/20 text-white ring-1 ring-white/20"
                  : c.isPersonalEvent
                    ? "bg-rose-300/15 text-white ring-1 ring-rose-200/30"
                    : c.isGroupEvent
                      ? "bg-emerald-300/15 text-white ring-1 ring-emerald-200/30"
                      : dim
                        ? "text-zinc-600"
                        : "text-zinc-300";
              return (
                <div
                  key={c.dayKey}
                  className={
                    "flex h-11 items-center justify-center rounded-xl text-sm tabular-nums transition " +
                    bg
                  }
                >
                  {c.day}
                </div>
              );
            })}
          </div>
        </section>

        {/* 다가오는 리스트 — pastel chips per row */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-300">
            다가오는 예약
          </div>
          <ul className="mt-3 space-y-2">
            {UPCOMING.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={
                      "rounded-full px-2.5 py-0.5 text-[10px] font-semibold ring-1 " +
                      (r.isGroup
                        ? "bg-emerald-300/15 text-emerald-200 ring-emerald-200/30"
                        : "bg-rose-300/15 text-rose-200 ring-rose-200/30")
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
