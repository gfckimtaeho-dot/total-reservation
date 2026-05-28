import { DarkHeader } from "../_components";

const SUB_KPI = [
  { label: "활성 회원", value: "247", delta: "+3 이번주" },
  { label: "오늘 예약", value: "38", delta: "PT 14 / 단체 24" },
  { label: "만료 임박", value: "9", delta: "7일 이내" },
];

const FEED = [
  { time: "10:24", text: "박지원 - PT 10회권 결제 ₩550,000" },
  { time: "10:18", text: "이수민 - 단체수업 환불 신청" },
  { time: "09:55", text: "Han 트레이너 - 김도윤 양도 받음" },
  { time: "09:30", text: "그룹수업 '코어 클래스' 정원 도달" },
];

const SLOTS = [
  { time: "11:00", trainer: "Han", member: "이서연", svc: "PT 50분" },
  { time: "11:00", trainer: "Park", member: "박지훈", svc: "PT 50분" },
  { time: "12:00", trainer: "Han", member: "김민지", svc: "PT 50분" },
  { time: "13:00", trainer: "단체", member: "코어 (8/10)", svc: "단체 50분" },
];

export default function OwnerBPreview() {
  return (
    <main className="min-h-screen bg-[#F7F7F7] text-[#222222] font-sans">
      <DarkHeader role="사장" variant="B" back="../" />

      <section className="bg-[#222222] text-white">
        <div className="mx-auto max-w-6xl px-6 pt-10 pb-16">
          <p className="text-sm text-[#A0A0A0]">스트롱헬스 강남점 · 5월 29일 (목)</p>
          <h1
            className="mt-2 text-sm font-medium uppercase tracking-wider text-[#A0A0A0]"
          >
            오늘 매출
          </h1>
          <p
            className="mt-2 text-6xl tracking-[-0.03em]"
            style={{ fontWeight: 800 }}
          >
            ₩1,287,500
          </p>
          <p className="mt-2 text-sm text-[#FF385C]" style={{ fontWeight: 600 }}>
            +12% vs 어제
          </p>

          <div className="mt-8 grid grid-cols-3 gap-6 border-t border-[#333333] pt-6">
            {SUB_KPI.map((k) => (
              <div key={k.label}>
                <p className="text-xs uppercase tracking-wider text-[#A0A0A0]">
                  {k.label}
                </p>
                <p
                  className="mt-2 text-3xl tracking-[-0.02em]"
                  style={{ fontWeight: 800 }}
                >
                  {k.value}
                </p>
                <p className="mt-1 text-xs text-[#A0A0A0]">{k.delta}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
            <h2
              className="text-xl tracking-[-0.015em]"
              style={{ fontWeight: 600 }}
            >
              다음 시간 스케줄
            </h2>
            <ul className="mt-4 divide-y divide-[#EEEEEE]">
              {SLOTS.map((s, i) => (
                <li key={i} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-4">
                    <span className="w-12 text-sm font-semibold tabular-nums">
                      {s.time}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{s.member}</p>
                      <p className="text-xs text-[#717171]">
                        {s.trainer} · {s.svc}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full border border-[#DDDDDD] px-3 py-1 text-xs font-medium">
                    예정
                  </span>
                </li>
              ))}
            </ul>
            <button className="mt-4 w-full rounded-lg bg-[#222222] px-4 py-2.5 text-sm font-semibold text-white hover:bg-black">
              전체 캘린더 열기
            </button>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
            <h2
              className="text-xl tracking-[-0.015em]"
              style={{ fontWeight: 600 }}
            >
              실시간 활동
            </h2>
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
        </div>

        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "회원 등록", primary: true },
            { label: "새 권 발급", primary: true },
            { label: "단체수업", primary: false },
            { label: "정산", primary: false },
          ].map((m) => (
            <button
              key={m.label}
              className={
                m.primary
                  ? "rounded-lg bg-[#FF385C] px-5 py-3 text-sm font-semibold text-white hover:bg-[#E31C5F]"
                  : "rounded-lg border border-[#DDDDDD] bg-white px-5 py-3 text-sm font-semibold hover:border-[#222222]"
              }
            >
              {m.label}
            </button>
          ))}
        </section>
      </div>
    </main>
  );
}
