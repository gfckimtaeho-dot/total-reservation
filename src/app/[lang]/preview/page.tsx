import Link from "next/link";

const variants = [
  {
    slug: "dash-v1",
    label: "v1 — Editorial Calm",
    body: "mainpage 톤 충실. 큰 여백, serif 숫자, 옅은 경계. 사장님 의견(1~4) 그대로.",
  },
  {
    slug: "dash-v2",
    label: "v2 — 32\" Dense Grid",
    body: "좌 sidebar nav + 우 4-zone 그리드. 32인치 화면 전체 활용, 정보 밀도 최대.",
  },
  {
    slug: "dash-v3",
    label: "v3 — Timeline-first",
    body: "오늘 타임라인이 화면 60%. 가로형 시간축, 운영 사장님 위주.",
  },
  {
    slug: "dash-v4",
    label: "v4 — Calendar-first",
    body: "월별 heatmap이 화면 60%. 큰 셀, 정보 풍부, 분석/매출 사장님 위주.",
  },
  {
    slug: "dash-v5",
    label: "v5 — Tablet-Optimized",
    body: "태블릿 가로 우선. 2x2 큰 카드, 큰 터치 영역, bottom nav.",
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
        5개 시안 비교
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600">
        같은 mock 데이터로 5가지 레이아웃·정보 밀도 변형. 32인치 모니터·태블릿·핸드폰에서 각각 열어 비교 후 한 가지(또는 변형)를 본격 dashboard에 적용합니다.
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
              <span className="font-heading text-lg tracking-tight text-ink">
                {v.label}
              </span>
              <span className="text-sm text-zinc-600">{v.body}</span>
              <span className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-ink/60">
                /preview/{v.slug} →
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-10 text-xs text-zinc-500">
        * preview 라우트는 인증 없음 + mock 데이터. 본격 dashboard 채택 후 삭제 또는 보존 결정.
      </p>
    </div>
  );
}
