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

// V3 — Calm Slate
// 핵심: slate-900 베이스 + amber 한 색만 강조. 정돈된 비즈니스 톤,
// 일정 있는 날은 amber underline.

export default async function PreviewMeV3({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const cells = buildCalendar();
  const today = TODAY_RES[0];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-3xl items-start justify-between px-6 py-5">
          <div>
            <Link
              href={`/${lang}/preview/me`}
              className="text-xs text-slate-400 hover:text-slate-100"
            >
              ← 시안 목록
            </Link>
            <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              {GYM_NAME}
            </div>
            <div className="mt-1 font-heading text-xl tracking-tight text-white">
              {MEMBER_NAME}
            </div>
            <div className="mt-0.5 text-xs text-slate-400">
              오늘 · {TODAY_LABEL}
            </div>
          </div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
            v3 slate
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-4 px-6 py-6">
        {/* 오늘 — amber 한 색 강조, 좌측 두꺼운 amber bar */}
        <section className="relative flex overflow-hidden rounded-2xl bg-slate-800 ring-1 ring-slate-700">
          <div className="w-1.5 bg-amber-400" />
          <div className="flex-1 p-6">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-300">
              오늘의 일정
            </div>
            <div className="mt-3 flex items-baseline gap-3">
              <div className="font-heading text-5xl tracking-tight tabular-nums text-amber-100">
                {fmtMin(today.startMin)}
              </div>
              <div className="text-base text-slate-300 tabular-nums">
                — {fmtMin(today.endMin)}
              </div>
            </div>
            <div className="mt-2 text-sm text-slate-300">
              {today.service} · {today.trainer} 트레이너
            </div>
          </div>
        </section>

        {/* QR — slate 카드, amber 작은 액센트 */}
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-2xl bg-slate-800 px-6 py-5 text-left text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
        >
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-amber-300">
              tap to open
            </div>
            <div className="mt-0.5 font-heading text-xl tracking-tight">
              출입 QR
            </div>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-400 text-xl text-slate-900">
            ▣
          </div>
        </button>

        {/* 회원권 + 횟수권 — 2열 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <section className="rounded-2xl bg-slate-800 p-5 ring-1 ring-slate-700">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              회원권
            </div>
            <ul className="mt-3 space-y-2.5">
              {MEMBERSHIPS.map((m) => {
                const soon = m.daysLeft <= 7;
                return (
                  <li key={m.id} className="text-sm">
                    <div className="flex items-baseline justify-between">
                      <div className="font-medium text-slate-100">{m.name}</div>
                      <div
                        className={
                          "font-heading tabular-nums " +
                          (soon ? "text-amber-300" : "text-slate-200")
                        }
                      >
                        {m.daysLeft}일
                      </div>
                    </div>
                    <div
                      className={
                        "text-xs " +
                        (soon ? "text-amber-300/80" : "text-slate-400")
                      }
                    >
                      {m.expiresOn} 만료
                      {soon && <span className="ml-1 font-semibold">· 곧</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-2xl bg-slate-800 p-5 ring-1 ring-slate-700">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              횟수권
            </div>
            <ul className="mt-3 space-y-2.5">
              {PACKAGES.map((p) => (
                <li key={p.id} className="text-sm">
                  <div className="flex items-baseline justify-between">
                    <div className="font-medium text-slate-100">
                      {p.service}
                    </div>
                    <div className="font-heading text-slate-200 tabular-nums">
                      <span className="text-amber-300">{p.remaining}</span>
                      <span className="text-slate-500"> /{p.total}</span>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">담당 {p.trainer}</div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* 캘린더 — amber underline 표시 */}
        <section className="rounded-2xl bg-slate-800 p-5 ring-1 ring-slate-700">
          <div className="flex items-baseline justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              앞으로 5주
            </div>
            <div className="text-[10px] text-slate-400">
              <span className="border-b-2 border-amber-400 pb-0.5">amber</span>{" "}
              = 일정 있는 날
            </div>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] text-slate-500">
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
                    "relative flex h-11 items-center justify-center rounded-md transition " +
                    (c.isToday
                      ? "bg-amber-400 font-semibold text-slate-900"
                      : c.hasEvent
                        ? "bg-slate-900/70 text-slate-100"
                        : dim
                          ? "text-slate-600"
                          : "text-slate-400")
                  }
                >
                  <span className="text-sm tabular-nums">{c.day}</span>
                  {c.hasEvent && !c.isToday && (
                    <span className="absolute bottom-1 left-1/2 h-0.5 w-5 -translate-x-1/2 bg-amber-400" />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 다가오는 리스트 */}
        <section className="rounded-2xl bg-slate-800 p-5 ring-1 ring-slate-700">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            다가오는 예약
          </div>
          <ul className="mt-3 divide-y divide-slate-700/60">
            {UPCOMING.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <div className="text-xs text-slate-400">{r.dayKey}</div>
                  <div className="mt-0.5 text-sm font-medium text-slate-100">
                    {fmtMin(r.startMin)} · {r.service}
                  </div>
                </div>
                <div className="text-xs text-slate-300">
                  {r.trainer} 트레이너
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
