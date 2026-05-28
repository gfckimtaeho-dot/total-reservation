import Link from "next/link";

type Variant = {
  href: string;
  role: string;
  variant: string;
  title: string;
  hint: string;
};

const VARIANTS: Variant[] = [
  {
    href: "owner-a",
    role: "사장",
    variant: "A",
    title: "Airbnb 정통",
    hint: "white + #FF385C accent + 4-카드 KPI",
  },
  {
    href: "owner-b",
    role: "사장",
    variant: "B",
    title: "Dark hero inverse",
    hint: "#222 hero + 매출 큰 숫자 + 화이트 카드",
  },
  {
    href: "customer-a",
    role: "고객",
    variant: "A",
    title: "Airbnb 정통",
    hint: "큰 QR + 오늘 일정 + 2 CTA",
  },
  {
    href: "customer-b",
    role: "고객",
    variant: "B",
    title: "Hero overlap",
    hint: "다크 hero + 흰 QR 카드 overlap",
  },
  {
    href: "trainer-a",
    role: "트레이너",
    variant: "A",
    title: "캘린더 (라이트)",
    hint: "흰 헤더 + 7일 주간 그리드 + #FF385C 다음 PT",
  },
  {
    href: "trainer-b",
    role: "트레이너",
    variant: "B",
    title: "캘린더 (다크 헤더)",
    hint: "#222 헤더 + 흰 캘린더 surface + chip 액션",
  },
];

export default function PreviewV2Index() {
  return (
    <main className="min-h-screen bg-[#FFFFFF] text-[#222222] font-sans">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1
          className="text-4xl font-extrabold tracking-[-0.025em]"
          style={{ fontWeight: 800 }}
        >
          Preview v2 - Airbnb 무드 적용 시안
        </h1>
        <p className="mt-3 text-base text-[#717171]">
          fivetaku/insane-design 의 Airbnb 토큰 (#FF385C / #222 / #FFF / weight
          400-500-600-800 / radius 8-12) 을 우리 도메인 3 영역에 적용한 시안.
          역할별 2 가지 변형을 비교하세요.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {VARIANTS.map((v) => (
            <Link
              key={v.href}
              href={`./v2/${v.href}`}
              className="group rounded-xl border border-[#DDDDDD] bg-white p-6 transition-colors hover:border-[#222222]"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#717171] uppercase tracking-wider">
                  {v.role}
                </span>
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#FF385C] px-2 text-xs font-semibold text-white">
                  {v.variant}
                </span>
              </div>
              <h2
                className="mt-3 text-xl font-semibold tracking-[-0.015em]"
                style={{ fontWeight: 600 }}
              >
                {v.title}
              </h2>
              <p className="mt-1 text-sm text-[#717171]">{v.hint}</p>
            </Link>
          ))}
        </div>

        <div className="mt-12 rounded-xl border border-[#DDDDDD] bg-[#F7F7F7] p-5 text-sm text-[#222222]">
          <p className="font-medium">검토 포인트</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[#717171]">
            <li>
              현재 운영(White Pastel)/고객(V18 Sunset Peach) 대비 통일감/차별성
            </li>
            <li>
              #FF385C 의 도메인 적합도 (긴급/CTA 강조에 어울리는가)
            </li>
            <li>
              다크 hero(B 시안) 가 정보 가독성에 도움이 되는가
            </li>
            <li>
              회색(#717171) 보조 텍스트 빈도가 메모 룰
              (`feedback-grey-is-negative`) 과 충돌하지 않는가
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
