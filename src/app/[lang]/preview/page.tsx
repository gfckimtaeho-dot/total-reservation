import Link from "next/link";

const normalVariants = [
  {
    slug: "normal-v1",
    label: "v1 — Sand",
    body: "stone-50 따뜻한 배경 + 흰 카드. 시간 row hairline divider, 달력 셀 진한 stone border. 흰 과다 해소.",
  },
  {
    slug: "normal-v2",
    label: "v2 — Zebra",
    body: "흰 배경 + 시간 row 짝/홀 stripe + 달력 평일·주말 미세 톤 차이. 줄무늬로 구분.",
  },
  {
    slug: "normal-v3",
    label: "v3 — Heavy Grid",
    body: "흰 배경 + 격자선 강화. 시간 row divide-zinc-300, 달력 gap-0 + zinc-300 격자. 분명한 grid.",
  },
  {
    slug: "normal-v4",
    label: "v4 — Tinted",
    body: "메인 살짝 회색 + 섹션별 다른 tint. 흰 카드가 위에 떠 보이는 depth 효과.",
  },
  {
    slug: "normal-v5",
    label: "v5 — Paper Cream",
    body: "amber-50 종이 배경 + 흰 카드. weekday header에 band accent. 따뜻한 인쇄물 느낌.",
  },
] as const;

const variants = [
  {
    slug: "dash-v1",
    label: "v1 — Mint Calm",
    body: "mainpage 컨셉 #1. bg-band 페일 라임 hero strip + 흰 카드. 차분한 산뜻함.",
    tag: "mainpage 컨셉",
  },
  {
    slug: "dash-v2",
    label: "v2 — Mint Sidebar",
    body: "mainpage 컨셉 #2. 좌 sidebar 통째로 라임 + 메인 흰. 라임 비중 더 큼.",
    tag: "mainpage 컨셉",
  },
  {
    slug: "dash-v3",
    label: "v3 — Dark Studio",
    body: "검정 배경 + 형광 라임 accent. 진행중·단체수업이 빛나듯 강조. 헬스 brutality.",
    tag: "다른 컨셉",
  },
  {
    slug: "dash-v4",
    label: "v4 — Pastel Multi",
    body: "각 영역마다 페일 색 (라임·하늘·복숭아·장미). 정보별 색 구분 명확.",
    tag: "다른 컨셉",
  },
  {
    slug: "dash-v5",
    label: "v5 — Editorial Bold",
    body: "큰 serif typography + 노란 highlighter accent. 잡지 편집 디자인.",
    tag: "다른 컨셉",
  },
] as const;

export default async function PreviewIndex({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
        DASHBOARD PREVIEW
      </span>
      <h1 className="font-heading mt-4 text-4xl tracking-tight text-ink">
        시안 비교
      </h1>

      <div className="mt-10 rounded-2xl border-2 border-ink bg-band/20 p-5">
        <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
          NEW
        </span>
        <h2 className="font-heading mt-3 text-xl tracking-tight text-ink">
          Normal 재변형 — 흰 과다 + 칸 구분 강화 (5안)
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700">
          채택된 normal(v2 Mint Sidebar)에서 사용자 피드백 반영: "흰색 너무
          많고 시간/날짜 칸 사이 구분이 약하다." 같은 문제를 5가지 다른 방향으로 해결.
          사이드바 라임은 동일, 메인 영역만 변형.
        </p>
        <ul className="mt-5 space-y-2">
          {normalVariants.map((v) => (
            <li
              key={v.slug}
              className="rounded-xl bg-white p-4 ring-1 ring-zinc-200 transition hover:ring-ink"
            >
              <Link
                href={`/${lang}/preview/${v.slug}`}
                className="flex flex-col gap-1"
              >
                <span className="font-heading text-base tracking-tight text-ink">
                  {v.label}
                </span>
                <span className="text-sm text-zinc-600">{v.body}</span>
                <span className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-ink/60">
                  /preview/{v.slug} →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-10">
        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
          어제 정한 5개 시안 (참고)
        </span>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          구조는 v2 (좌 sidebar + 우 4-zone) 베이스 고정. 동시간대 PT 2명, 진행중 강조, 단체수업 시각화, 갱신 권유 카드 모두 동일. 차이는 색·톤·강조 방식.
        </p>
      </div>

      <ul className="mt-10 space-y-3">
        {variants.map((v) => (
          <li
            key={v.slug}
            className="rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-ink"
          >
            <Link
              href={`/${lang}/preview/${v.slug}`}
              className="flex flex-col gap-1.5"
            >
              <div className="flex items-center gap-2">
                <span className="font-heading text-lg tracking-tight text-ink">
                  {v.label}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] ${
                    v.tag === "mainpage 컨셉"
                      ? "bg-band text-ink"
                      : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {v.tag}
                </span>
              </div>
              <span className="text-sm text-zinc-600">{v.body}</span>
              <span className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-ink/60">
                /preview/{v.slug} →
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5">
        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
          추가 시안
        </span>
        <Link
          href={`/${lang}/preview/settings`}
          className="mt-2 flex flex-col gap-1.5"
        >
          <span className="font-heading text-lg tracking-tight text-ink">
            설정 화면
          </span>
          <span className="text-sm text-zinc-600">
            언어 선택(한국어/English) + 화면 컨셉 선택(Normal·Dark·White). 사이드바 nav "설정" 클릭 시 진입.
          </span>
          <span className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-ink/60">
            /preview/settings →
          </span>
        </Link>
      </div>

      <p className="mt-8 text-xs text-zinc-500">
        * 모든 시안 공통: 매출 카드 제거, 진행중 강조, 동시간대 PT 2명 가시화, 멤버십 만료 임박 패널 포함.
      </p>
    </div>
  );
}
