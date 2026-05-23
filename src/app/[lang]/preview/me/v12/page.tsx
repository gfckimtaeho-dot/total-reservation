import Link from "next/link";
import { TODAY_RES, GYM_NAME, MEMBER_NAME, fmtMin } from "../_mock";

// V12 — Citrus Punch (white + yellow/lime, 검정 본문 high-contrast)

const STORE_PHONE = "02-1234-5678";
const QR_EXPIRES = "2026-12-31";

export default async function PreviewMeV12({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const today = TODAY_RES[0];

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-white font-sans text-zinc-900">
      <div className="pointer-events-none absolute -top-32 right-1/4 h-[28rem] w-[28rem] rounded-full bg-yellow-200/70 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 left-0 h-[24rem] w-[28rem] rounded-full bg-lime-200/60 blur-3xl" />

      <header className="relative border-b-2 border-zinc-900">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <div className="text-sm font-bold uppercase tracking-wider text-zinc-500">
              {GYM_NAME}
            </div>
            <div className="mt-0.5 text-2xl font-black tracking-tight text-zinc-900">
              {MEMBER_NAME}
            </div>
          </div>
          <Link
            href={`/${lang}/preview/me`}
            className="rounded-none border-2 border-zinc-900 bg-yellow-300 px-3 py-1 text-xs font-bold text-zinc-900 hover:bg-yellow-200"
          >
            ← INDEX
          </Link>
        </div>
      </header>

      <main className="relative flex-1">
        <div className="mx-auto w-full max-w-md space-y-5 px-5 py-5">
          <section className="rounded-2xl border-2 border-zinc-900 bg-white p-5">
            <div className="mx-auto w-full max-w-[14.5rem]">
              <div className="mx-auto w-[7.25rem] rounded-xl border-2 border-zinc-900 bg-white p-2.5">
                <FakeQr />
              </div>
              <div className="mt-2.5 text-center text-base font-black text-zinc-900 tabular-nums">
                {QR_EXPIRES} 까지 유효
              </div>
            </div>
          </section>

          <section className="rounded-2xl border-2 border-zinc-900 bg-yellow-300 p-5">
            <div className="flex items-baseline justify-between px-3">
              <h3 className="text-lg font-black text-zinc-900">오늘의 일정</h3>
              <span className="text-base font-bold text-zinc-700">5월 20일 (화)</span>
            </div>
            {today ? (
              <div className="mt-3 grid grid-cols-3 items-baseline gap-2 rounded-xl bg-zinc-900 p-3">
                <div className="text-left text-3xl font-black tabular-nums text-yellow-300">
                  {fmtMin(today.startMin)}
                </div>
                <div className="truncate text-center text-2xl font-black text-white">
                  {today.service}
                </div>
                <div className="text-right text-xs">
                  <span className="text-base font-bold text-yellow-300">
                    {today.trainer}
                  </span>{" "}
                  <span className="text-zinc-400">Tr</span>
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-xl bg-white p-4 text-center text-sm text-zinc-600">
                오늘 예정된 일정이 없습니다
              </div>
            )}
          </section>

          <section className="grid grid-cols-2 gap-3">
            <Link
              href={`/${lang}/preview/me/v12`}
              className="flex min-h-[112px] items-center justify-center rounded-2xl border-2 border-zinc-900 bg-lime-300 p-5 text-zinc-900 active:scale-[0.98]"
            >
              <div className="text-xl font-black">예약 하기</div>
            </Link>
            <Link
              href={`/${lang}/preview/me/v12`}
              className="flex min-h-[112px] items-center justify-center rounded-2xl border-2 border-zinc-900 bg-white p-5 text-zinc-900 active:scale-[0.98]"
            >
              <div className="text-xl font-black">마이 페이지</div>
            </Link>
          </section>
        </div>
      </main>

      <footer className="relative border-t-2 border-zinc-900 bg-yellow-100 py-5">
        <div className="text-center text-sm font-bold text-zinc-900">
          대표번호{" "}
          <a
            href={`tel:${STORE_PHONE}`}
            className="ml-1 tabular-nums underline underline-offset-4"
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
