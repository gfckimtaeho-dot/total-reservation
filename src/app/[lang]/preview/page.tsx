import Link from "next/link";

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
        DASHBOARD PREVIEW · v2 구조 (sidebar + 4-zone)
      </span>
      <h1 className="font-heading mt-4 text-4xl tracking-tight text-ink">
        5개 시안 — 색·톤 변형
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600">
        구조는 v2 (좌 sidebar + 우 4-zone) 베이스 고정. 동시간대 PT 2명, 진행중 강조, 단체수업 시각화, 갱신 권유 카드 모두 동일. 차이는 색·톤·강조 방식.
      </p>

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

      <p className="mt-10 text-xs text-zinc-500">
        * 모든 시안 공통: 매출 카드 제거, 진행중 강조, 동시간대 PT 2명 가시화, 멤버십 만료 임박 패널 포함.
      </p>
    </div>
  );
}
