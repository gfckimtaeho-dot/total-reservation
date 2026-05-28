import { DarkHeader } from "../_components";

const TODAY = [
  { time: "11:00", svc: "PT 50분", trainer: "Han 트레이너" },
  { time: "18:30", svc: "코어 클래스", trainer: "단체 (8/10)" },
];

const HOLDINGS = [
  { name: "PT 10회권", left: "7회 남음" },
  { name: "월회원권", left: "23일 남음" },
];

export default function CustomerBPreview() {
  return (
    <main className="min-h-screen bg-[#F7F7F7] text-[#222222] font-sans">
      <DarkHeader role="고객" variant="B" back="../" />

      <section className="bg-[#222222] text-white">
        <div className="mx-auto max-w-md px-5 pt-8 pb-24">
          <p className="text-sm text-[#A0A0A0]">스트롱헬스 강남점</p>
          <h1
            className="mt-2 text-3xl tracking-[-0.025em]"
            style={{ fontWeight: 800 }}
          >
            반가워요, 이서연님
          </h1>
          <p className="mt-1 text-sm text-[#A0A0A0]">5월 29일 (목)</p>
        </div>
      </section>

      <div className="mx-auto -mt-20 max-w-md px-5">
        <section className="rounded-xl bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#717171]">
              출입 QR
            </p>
            <span className="rounded-full bg-[#FF385C] px-2 py-0.5 text-[10px] font-semibold text-white">
              5분 후 갱신
            </span>
          </div>
          <div className="mt-3 grid aspect-square w-full place-items-center rounded-lg bg-[#F7F7F7]">
            <svg
              className="h-3/4 w-3/4 text-[#222222]"
              viewBox="0 0 100 100"
              fill="currentColor"
              aria-hidden
            >
              <rect x="10" y="10" width="25" height="25" />
              <rect x="65" y="10" width="25" height="25" />
              <rect x="10" y="65" width="25" height="25" />
              <rect x="42" y="42" width="6" height="6" />
              <rect x="52" y="42" width="6" height="6" />
              <rect x="42" y="52" width="6" height="6" />
              <rect x="52" y="52" width="6" height="6" />
              <rect x="42" y="62" width="6" height="6" />
              <rect x="52" y="72" width="6" height="6" />
              <rect x="62" y="42" width="6" height="6" />
              <rect x="72" y="52" width="6" height="6" />
            </svg>
          </div>
        </section>

        <section className="mt-5 rounded-xl bg-white p-5">
          <h2
            className="text-lg tracking-[-0.015em]"
            style={{ fontWeight: 600 }}
          >
            오늘 일정
          </h2>
          <ul className="mt-3 divide-y divide-[#EEEEEE]">
            {TODAY.map((t, i) => (
              <li key={i} className="flex items-center gap-4 py-3">
                <span className="w-14 shrink-0 text-base font-semibold tabular-nums">
                  {t.time}
                </span>
                <div>
                  <p className="text-sm font-semibold">{t.svc}</p>
                  <p className="text-xs text-[#717171]">{t.trainer}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-5 grid grid-cols-2 gap-3">
          <button className="rounded-lg bg-[#FF385C] px-5 py-4 text-sm font-semibold text-white hover:bg-[#E31C5F]">
            예약 하기
          </button>
          <button className="rounded-lg bg-[#222222] px-5 py-4 text-sm font-semibold text-white hover:bg-black">
            마이 페이지
          </button>
        </section>

        <section className="mt-5 rounded-xl bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#717171]">
            보유 중
          </p>
          <ul className="mt-3 space-y-2">
            {HOLDINGS.map((h, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg border border-[#DDDDDD] px-4 py-3"
              >
                <span className="text-sm font-semibold">{h.name}</span>
                <span className="text-xs text-[#717171]">{h.left}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="my-8 flex items-center justify-between rounded-lg bg-white px-4 py-3">
          <span className="text-sm text-[#717171]">매장 대표번호</span>
          <a
            href="tel:0212345678"
            className="text-sm font-semibold underline underline-offset-4"
          >
            02-1234-5678
          </a>
        </section>
      </div>
    </main>
  );
}
