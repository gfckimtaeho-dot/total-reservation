import { DarkHeader } from "../_components";

// 트레이너 첫 화면 = 캘린더 중심. 다크 헤더(Airbnb #222) 유지 + 캘린더는 화이트
// surface 로 뽑아 정보 가독성 극대화. 기존 V8 Sunset Gradient 의 다크 무드는
// 살리되 보라/오렌지 그라데는 Airbnb 토큰으로 대체.

const HOURS = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];
const DAYS = [
  { label: "29 목", today: true },
  { label: "30 금", today: false },
  { label: "31 토", today: false },
  { label: "01 일", off: true, today: false },
  { label: "02 월", today: false },
  { label: "03 화", today: false },
  { label: "04 수", today: false },
];

type Slot = {
  hour: string;
  day: number;
  member: string;
  kind: "pt-done" | "pt-next" | "pt-future" | "group";
  meta?: string;
};

const SLOTS: Slot[] = [
  { hour: "10:00", day: 0, member: "이서연", kind: "pt-done" },
  { hour: "11:00", day: 0, member: "박지훈", kind: "pt-done" },
  { hour: "14:00", day: 0, member: "김민지", kind: "pt-next" },
  { hour: "15:00", day: 0, member: "최예린", kind: "pt-future" },
  { hour: "11:00", day: 1, member: "박지훈", kind: "pt-future" },
  { hour: "13:00", day: 1, member: "코어 8/10", kind: "group", meta: "단체" },
  { hour: "14:00", day: 1, member: "이서연", kind: "pt-future" },
  { hour: "10:00", day: 2, member: "김민지", kind: "pt-future" },
  { hour: "13:00", day: 2, member: "코어 6/10", kind: "group", meta: "단체" },
  { hour: "11:00", day: 4, member: "박지훈", kind: "pt-future" },
  { hour: "14:00", day: 4, member: "최예린", kind: "pt-future" },
  { hour: "10:00", day: 5, member: "이서연", kind: "pt-future" },
  { hour: "13:00", day: 5, member: "코어 3/10", kind: "group", meta: "단체" },
];

function pillClass(kind: Slot["kind"]) {
  if (kind === "pt-done") return "bg-[#F7F7F7] text-[#717171]";
  if (kind === "pt-next") return "bg-[#FF385C] text-white";
  if (kind === "group") return "bg-[#FFE9EE] text-[#92174D]";
  return "bg-white text-[#222222] border border-[#DDDDDD]";
}

export default function TrainerBPreview() {
  return (
    <main className="min-h-screen bg-[#F7F7F7] text-[#222222] font-sans">
      <DarkHeader role="트레이너" variant="B" back="../" />

      <header className="border-b border-[#333333] bg-[#222222]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4 text-white">
          <div>
            <h1
              className="text-xl tracking-[-0.015em]"
              style={{ fontWeight: 600 }}
            >
              <span className="text-[#A0A0A0]">스트롱헬스 강남점</span>
              <span className="mx-2 text-[#555555]">/</span>
              <span style={{ fontWeight: 800 }}>Han 트레이너</span>
            </h1>
            <p className="mt-1 text-xs text-[#A0A0A0]">
              오늘 6 건 · 다음 14:00 김민지
            </p>
          </div>
          <nav className="flex flex-wrap items-center gap-2">
            <button className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#222222] hover:bg-[#F7F7F7]">
              QR
            </button>
            <button className="rounded-full border border-[#555555] px-4 py-2 text-xs font-semibold text-white hover:border-white">
              Showcase
            </button>
            <button className="rounded-full bg-[#FF385C] px-4 py-2 text-xs font-semibold text-white hover:bg-[#E31C5F]">
              상담 신규
            </button>
            <button className="rounded-full border border-[#555555] px-4 py-2 text-xs font-semibold text-white hover:border-white">
              내 고객
            </button>
            <button className="rounded-full border border-[#555555] px-4 py-2 text-xs font-semibold text-white hover:border-white">
              회고
            </button>
            <button className="rounded-full border border-[#555555] px-4 py-2 text-xs font-semibold text-white hover:border-white">
              채팅 <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF385C] px-1 text-[10px] text-white">3</span>
            </button>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[#717171]">
              주간 캘린더
            </p>
            <p
              className="mt-1 text-2xl tracking-[-0.02em]"
              style={{ fontWeight: 800 }}
            >
              5월 29일 - 6월 4일
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-lg border border-[#DDDDDD] bg-white px-3 py-2 text-sm font-medium hover:border-[#222222]">
              &larr;
            </button>
            <button className="rounded-lg bg-[#222222] px-3 py-2 text-sm font-medium text-white hover:bg-black">
              오늘
            </button>
            <button className="rounded-lg border border-[#DDDDDD] bg-white px-3 py-2 text-sm font-medium hover:border-[#222222]">
              &rarr;
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
          <div className="grid min-w-[700px] grid-cols-[60px_repeat(7,minmax(0,1fr))]">
            <div className="border-b border-r border-[#DDDDDD] bg-[#F7F7F7]" />
            {DAYS.map((d, i) => (
              <div
                key={i}
                className={
                  "border-b border-l border-[#DDDDDD] px-2 py-3 text-center text-xs font-semibold " +
                  (d.today
                    ? "bg-[#222222] text-white"
                    : d.off
                    ? "bg-[#F7F7F7] text-[#717171]"
                    : "bg-white text-[#222222]")
                }
              >
                {d.label}
                {d.today && (
                  <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[#FF385C]" />
                )}
              </div>
            ))}

            {HOURS.map((h) => (
              <div key={h} className="contents">
                <div className="border-b border-r border-[#DDDDDD] bg-[#F7F7F7] px-2 py-3 text-right text-[10px] font-medium tabular-nums text-[#717171]">
                  {h}
                </div>
                {DAYS.map((d, di) => {
                  const slot = SLOTS.find(
                    (s) => s.hour === h && s.day === di,
                  );
                  return (
                    <div
                      key={di}
                      className={
                        "min-h-[44px] border-b border-l border-[#DDDDDD] p-1 " +
                        (d.off ? "bg-[#F7F7F7]" : "bg-white")
                      }
                    >
                      {slot && (
                        <div
                          className={
                            "rounded-md px-2 py-1 text-[11px] font-semibold " +
                            pillClass(slot.kind)
                          }
                        >
                          {slot.member}
                          {slot.meta && (
                            <span className="ml-1 opacity-70">
                              {slot.meta}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[#717171]">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded bg-[#FF385C]" />
            다음 / 진행 PT
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded border border-[#DDDDDD]" />
            예정 PT
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded bg-[#FFE9EE]" />
            단체 수업
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded bg-[#F7F7F7]" />
            완료 / 휴무
          </span>
        </div>
      </section>
    </main>
  );
}
