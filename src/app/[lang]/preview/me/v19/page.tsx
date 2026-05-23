import Link from "next/link";
import { TODAY_RES, GYM_NAME, MEMBER_NAME, fmtMin } from "../_mock";

// V19 — Forest Active (white + deep emerald, healthy 톤)

const STORE_PHONE = "02-1234-5678";
const QR_EXPIRES = "2026-12-31";

export default async function PreviewMeV19({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const today = TODAY_RES[0];

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-white font-sans text-zinc-900">
      <div className="pointer-events-none absolute -top-32 -left-20 h-[28rem] w-[28rem] rounded-full bg-emerald-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 right-1/4 h-[24rem] w-[28rem] rounded-full bg-lime-200/40 blur-3xl" />

      <header className="relative bg-emerald-700">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <div className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-200">
              {GYM_NAME}
            </div>
            <div className="mt-0.5 text-2xl font-extrabold tracking-tight text-white">
              {MEMBER_NAME}
            </div>
          </div>
          <Link
            href={`/${lang}/preview/me`}
            className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/20"
          >
            ← INDEX
          </Link>
        </div>
      </header>

      <main className="relative flex-1">
        <div className="mx-auto w-full max-w-md space-y-5 px-5 py-5">
          <section className="rounded-3xl bg-white p-5 ring-2 ring-emerald-600/30 shadow-[0_30px_80px_-30px_rgba(5,150,105,0.5)]">
            <div className="mx-auto w-full max-w-[14.5rem]">
              <div className="mx-auto w-[7.25rem] rounded-2xl bg-emerald-50 p-2.5">
                <FakeQr />
              </div>
              <div className="mt-2.5 text-center text-base font-extrabold text-emerald-700 tabular-nums">
                {QR_EXPIRES} 까지 유효
              </div>
            </div>
          </section>

          <section className="rounded-3xl bg-emerald-700 p-5">
            <div className="flex items-baseline justify-between px-3">
              <h3 className="text-lg font-extrabold text-lime-300">오늘의 일정</h3>
              <span className="text-base text-emerald-200">5월 20일 (화)</span>
            </div>
            {today ? (
              <div className="mt-3 grid grid-cols-3 items-baseline gap-2 rounded-2xl bg-white p-3">
                <div className="text-left text-3xl font-extrabold tabular-nums text-emerald-700">
                  {fmtMin(today.startMin)}
                </div>
                <div className="truncate text-center text-2xl font-extrabold text-zinc-900">
                  {today.service}
                </div>
                <div className="text-right text-xs">
                  <span className="text-base font-bold text-emerald-700">
                    {today.trainer}
                  </span>{" "}
                  <span className="text-zinc-500">Tr</span>
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-2xl bg-emerald-800/60 p-4 text-center text-sm text-emerald-100">
                오늘 예정된 일정이 없습니다
              </div>
            )}
          </section>

          <section className="grid grid-cols-2 gap-3">
            <Link
              href={`/${lang}/preview/me/v19`}
              className="flex min-h-[112px] items-center justify-center rounded-3xl bg-emerald-700 p-5 text-white shadow-[0_15px_40px_-15px_rgba(5,150,105,0.55)] active:scale-[0.98]"
            >
              <div className="text-xl font-extrabold">예약 하기</div>
            </Link>
            <Link
              href={`/${lang}/preview/me/v19`}
              className="flex min-h-[112px] items-center justify-center rounded-3xl bg-lime-300 p-5 text-emerald-900 active:scale-[0.98]"
            >
              <div className="text-xl font-extrabold">마이 페이지</div>
            </Link>
          </section>
        </div>
      </main>

      <footer className="relative border-t border-emerald-100 bg-white/60 py-5 backdrop-blur">
        <div className="text-center text-sm text-zinc-600">
          대표번호{" "}
          <a
            href={`tel:${STORE_PHONE}`}
            className="ml-1 font-bold tabular-nums text-emerald-700 underline-offset-2 hover:underline"
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
