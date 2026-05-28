import { PreviewHeader } from "../_components";

const KPI = [
  { label: "오늘 매출", value: "₩1,287,500", delta: "+12% vs 어제" },
  { label: "활성 회원", value: "247", delta: "+3 이번주" },
  { label: "오늘 예약", value: "38", delta: "PT 14 · 단체 24" },
  { label: "만료 임박", value: "9", delta: "7일 이내" },
];

const FEED = [
  { time: "10:24", text: "박지원 - PT 10회권 결제 ₩550,000" },
  { time: "10:18", text: "이수민 - 단체수업 환불 신청" },
  { time: "09:55", text: "Han 트레이너 - 김도윤 양도 받음" },
  { time: "09:30", text: "그룹수업 '코어 클래스' 정원 도달" },
  { time: "09:12", text: "최예린 - 회원권 활성 (loginId: yerin01)" },
];

const EXPIRING = [
  { name: "김민준", svc: "PT 10회권", left: "2회 남음", due: "5월 31일" },
  { name: "이서연", svc: "월회원권", left: "5일 남음", due: "6월 3일" },
  { name: "박지훈", svc: "단체 8회권", left: "1회 남음", due: "6월 5일" },
];

export default function OwnerAPreview() {
  return (
    <main className="min-h-screen bg-white text-[#222222] font-sans">
      <PreviewHeader role="사장" variant="A" back="../" />

      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-[#717171]">스트롱헬스 강남점</p>
            <h1
              className="mt-1 text-4xl tracking-[-0.025em]"
              style={{ fontWeight: 800 }}
            >
              오늘의 운영 한눈에
            </h1>
            <p className="mt-2 text-base text-[#717171]">
              5월 29일 (목) · 영업 중
            </p>
          </div>
          <div className="flex gap-2">
            <button className="rounded-lg border border-[#DDDDDD] bg-white px-5 py-3 text-sm font-semibold text-[#222222] hover:bg-[#F7F7F7]">
              회원 등록
            </button>
            <button className="rounded-lg bg-[#FF385C] px-5 py-3 text-sm font-semibold text-white hover:bg-[#E31C5F]">
              새 권 발급
            </button>
          </div>
        </div>

        <section className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {KPI.map((k) => (
            <div
              key={k.label}
              className="rounded-xl border border-[#DDDDDD] p-5"
            >
              <p className="text-xs font-medium uppercase tracking-wider text-[#717171]">
                {k.label}
              </p>
              <p
                className="mt-2 text-3xl tracking-[-0.02em]"
                style={{ fontWeight: 800 }}
              >
                {k.value}
              </p>
              <p className="mt-1 text-xs text-[#717171]">{k.delta}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-[#DDDDDD] p-6 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2
                className="text-xl tracking-[-0.015em]"
                style={{ fontWeight: 600 }}
              >
                실시간 활동
              </h2>
              <a
                href="#"
                className="text-sm font-medium text-[#222222] underline underline-offset-4"
              >
                전체 보기
              </a>
            </div>
            <ul className="mt-4 divide-y divide-[#EEEEEE]">
              {FEED.map((f, i) => (
                <li key={i} className="flex gap-4 py-3">
                  <span className="w-12 shrink-0 text-sm font-medium tabular-nums text-[#717171]">
                    {f.time}
                  </span>
                  <span className="text-sm">{f.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-[#DDDDDD] p-6">
            <h2
              className="text-xl tracking-[-0.015em]"
              style={{ fontWeight: 600 }}
            >
              만료 임박
            </h2>
            <ul className="mt-4 space-y-3">
              {EXPIRING.map((e, i) => (
                <li key={i} className="rounded-lg bg-[#F7F7F7] p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{e.name}</p>
                    <span className="rounded-full bg-[#FF385C] px-2 py-0.5 text-[10px] font-semibold text-white">
                      {e.left}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#717171]">
                    {e.svc} · {e.due}
                  </p>
                </li>
              ))}
            </ul>
            <button className="mt-4 w-full rounded-lg border border-[#222222] bg-white px-4 py-2.5 text-sm font-semibold hover:bg-[#222222] hover:text-white">
              모두 보기
            </button>
          </div>
        </section>

        <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {["회원", "트레이너", "단체수업", "정산"].map((m) => (
            <button
              key={m}
              className="rounded-full border border-[#DDDDDD] bg-white px-5 py-3 text-sm font-medium hover:border-[#222222]"
            >
              {m}
            </button>
          ))}
        </section>
      </div>
    </main>
  );
}
