import Link from "next/link";
import { TODAY_RES, GYM_NAME, MEMBER_NAME, fmtMin } from "../_mock";

// V18 — Sunset Peach (peach/orange 그라데, 황혼 활기)

const STORE_PHONE = "02-1234-5678";
const QR_EXPIRES = "2026-12-31";

export default async function PreviewMeV18({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const today = TODAY_RES[0];

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-orange-50 via-rose-50 to-amber-50 font-sans text-zinc-900">
      <div className="pointer-events-none absolute -top-32 left-1/4 h-[28rem] w-[28rem] rounded-full bg-orange-200/60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 right-0 h-[24rem] w-[28rem] rounded-full bg-rose-200/50 blur-3xl" />

      <header className="relative border-b border-orange-100">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <div className="text-sm font-medium text-orange-600">{GYM_NAME}</div>
            <div className="mt-0.5 text-2xl font-bold tracking-tight text-zinc-900">
              {MEMBER_NAME}
            </div>
          </div>
          <Link
            href={`/${lang}/preview/me`}
            className="rounded-full border border-orange-200 bg-white px-3 py-1 text-xs text-orange-600 hover:bg-orange-50"
          >
            ← INDEX
          </Link>
        </div>
      </header>

      <main className="relative flex-1">
        <div className="mx-auto w-full max-w-md space-y-5 px-5 py-5">
          <section className="rounded-3xl border border-orange-200/60 bg-white/90 p-5 shadow-[0_30px_80px_-30px_rgba(249,115,22,0.4)] backdrop-blur">
            <div className="mx-auto w-full max-w-[14.5rem]">
              <div className="mx-auto w-[7.25rem] rounded-2xl bg-gradient-to-br from-orange-50 to-rose-50 p-2.5">
                <FakeQr />
              </div>
              <div className="mt-2.5 text-center text-base font-semibold text-orange-600 tabular-nums">
                {QR_EXPIRES} 까지 유효
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-orange-200/60 bg-white/90 p-5 backdrop-blur">
            <div className="flex items-baseline justify-between px-3">
              <h3 className="text-lg font-bold text-orange-600">오늘의 일정</h3>
              <span className="text-base text-zinc-500">5월 20일 (화)</span>
            </div>
            {today ? (
              <div className="mt-3 grid grid-cols-3 items-baseline gap-2 rounded-2xl bg-gradient-to-r from-orange-200 to-rose-200 p-3">
                <div className="text-left text-3xl font-bold tabular-nums text-orange-800">
                  {fmtMin(today.startMin)}
                </div>
                <div className="truncate text-center text-2xl font-bold text-zinc-900">
                  {today.service}
                </div>
                <div className="text-right text-xs">
                  <span className="text-base font-semibold text-orange-700">
                    {today.trainer}
                  </span>{" "}
                  <span className="text-zinc-600">Tr</span>
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-2xl bg-zinc-50 p-4 text-center text-sm text-zinc-500">
                오늘 예정된 일정이 없습니다
              </div>
            )}
          </section>

          <section className="grid grid-cols-2 gap-3">
            <Link
              href={`/${lang}/preview/me/v18`}
              className="flex min-h-[112px] items-center justify-center rounded-3xl bg-gradient-to-br from-orange-500 to-rose-500 p-5 text-white shadow-[0_15px_40px_-15px_rgba(249,115,22,0.55)] active:scale-[0.98]"
            >
              <div className="text-xl font-bold">예약 하기</div>
            </Link>
            <Link
              href={`/${lang}/preview/me/v18`}
              className="flex min-h-[112px] items-center justify-center rounded-3xl border-2 border-orange-200 bg-white p-5 text-zinc-900 active:scale-[0.98]"
            >
              <div className="text-xl font-bold">마이 페이지</div>
            </Link>
          </section>
        </div>
      </main>

      <footer className="relative border-t border-orange-100 bg-white/60 py-5 backdrop-blur">
        <div className="text-center text-sm text-zinc-600">
          대표번호{" "}
          <a
            href={`tel:${STORE_PHONE}`}
            className="ml-1 font-medium tabular-nums text-orange-600 underline-offset-2 hover:underline"
          >
            {STORE_PHONE}
          </a>
        </div>
      </footer>
    </div>
  );
}

function FakeQr() {
  const cells: boolean[] = [];
  for (let i = 0; i < 21 * 21; i++) cells.push((i * 31 + 7) % 5 < 2);
  return (
    <div className="grid grid-cols-[repeat(21,1fr)] gap-[1px]">
      {cells.map((on, i) => (
        <div
          key={i}
          className={on ? "aspect-square bg-zinc-900" : "aspect-square bg-white"}
        />
      ))}
    </div>
  );
}
