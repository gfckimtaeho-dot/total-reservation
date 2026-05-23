import Link from "next/link";
import { TODAY_RES, GYM_NAME, MEMBER_NAME, fmtMin } from "../_mock";

// V20 — Bold Mono Editorial (pure white + 검정 + 빨강 한 점, 매거진 톤)

const STORE_PHONE = "02-1234-5678";
const QR_EXPIRES = "2026-12-31";

export default async function PreviewMeV20({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const today = TODAY_RES[0];

  return (
    <div className="relative flex min-h-screen flex-col bg-white font-sans text-zinc-900">
      <header className="relative border-b-4 border-zinc-900">
        <div className="mx-auto flex max-w-md items-end justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-[0.32em] text-zinc-500">
              {GYM_NAME}
            </div>
            <div className="mt-1 text-3xl font-black tracking-tight text-zinc-900">
              {MEMBER_NAME}
            </div>
          </div>
          <Link
            href={`/${lang}/preview/me`}
            className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500 hover:text-red-600"
          >
            ← INDEX
          </Link>
        </div>
      </header>

      <main className="relative flex-1">
        <div className="mx-auto w-full max-w-md space-y-4 px-5 py-5">
          <section className="border-2 border-zinc-900 bg-white p-5">
            <div className="mx-auto w-full max-w-[14.5rem]">
              <div className="mx-auto w-[7.25rem] border-2 border-zinc-900 bg-white p-2.5">
                <FakeQr />
              </div>
              <div className="mt-2.5 text-center">
                <div className="inline-block bg-red-600 px-2.5 py-0.5 text-sm font-black uppercase tracking-[0.18em] text-white tabular-nums">
                  {QR_EXPIRES} until
                </div>
              </div>
            </div>
          </section>

          <section className="border-2 border-zinc-900 bg-white p-5">
            <div className="flex items-baseline justify-between border-b-2 border-zinc-900 pb-2">
              <h3 className="text-xl font-black uppercase tracking-tight text-zinc-900">
                오늘의 일정
              </h3>
              <span className="text-base font-bold uppercase tracking-wider text-zinc-500">
                5/20 (화)
              </span>
            </div>
            {today ? (
              <div className="mt-3 grid grid-cols-3 items-baseline gap-2">
                <div className="text-left text-4xl font-black tabular-nums text-red-600">
                  {fmtMin(today.startMin)}
                </div>
                <div className="truncate border-l-4 border-zinc-900 pl-2 text-center text-2xl font-black uppercase text-zinc-900">
                  {today.service}
                </div>
                <div className="text-right text-[10px] uppercase">
                  <span className="text-sm font-bold uppercase tracking-wider text-red-600">
                    {today.trainer}
                  </span>{" "}
                  <span className="font-bold text-zinc-500">Tr</span>
                </div>
              </div>
            ) : (
              <div className="mt-3 py-4 text-center text-sm font-bold text-zinc-500">
                오늘 예정된 일정이 없습니다
              </div>
            )}
          </section>

          <section className="grid grid-cols-2 gap-3">
            <Link
              href={`/${lang}/preview/me/v20`}
              className="flex min-h-[112px] items-center justify-center border-2 border-zinc-900 bg-zinc-900 p-5 text-white active:scale-[0.98]"
            >
              <div className="text-xl font-black">예약 하기</div>
            </Link>
            <Link
              href={`/${lang}/preview/me/v20`}
              className="flex min-h-[112px] items-center justify-center border-2 border-zinc-900 bg-white p-5 text-zinc-900 active:scale-[0.98]"
            >
              <div className="text-xl font-black">마이 페이지</div>
            </Link>
          </section>
        </div>
      </main>

      <footer className="relative border-t-4 border-zinc-900 py-5">
        <div className="text-center text-xs font-bold uppercase tracking-[0.22em] text-zinc-700">
          대표번호{" "}
          <a
            href={`tel:${STORE_PHONE}`}
            className="ml-1 tabular-nums text-red-600 underline-offset-4 hover:underline"
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
