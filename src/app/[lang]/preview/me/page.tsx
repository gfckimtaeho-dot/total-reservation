import Link from "next/link";

// 2026-05-23 — White 시안 10개 (v11~v20). 피드백 반영 새 정보구조
// (QR 큰 카드 / 오늘의 일정 / 예약하기+마이페이지 / 대표번호 푸터).
// 모두 white 베이스, 컨셉별로 색·톤만 다르게. dark 시안(v1~v10)은 폐기.

const VARIANTS = [
  {
    slug: "v11",
    title: "Coral Sunrise",
    concept: "코랄/로즈 + 화이트, 따뜻하고 부드러운 활력",
    accent: "from-rose-200 to-orange-200",
    chip: "bg-rose-500",
  },
  {
    slug: "v12",
    title: "Citrus Punch",
    concept: "노랑/라임 + 검정 본문, Apple Fitness 같은 high-contrast",
    accent: "from-yellow-200 to-lime-200",
    chip: "bg-yellow-400",
  },
  {
    slug: "v13",
    title: "Sky Active",
    concept: "스카이블루/시안 그라데, 시원하고 가벼움",
    accent: "from-sky-200 to-cyan-200",
    chip: "bg-sky-500",
  },
  {
    slug: "v14",
    title: "Mint Fresh",
    concept: "민트/에메랄드, 운동 후 상쾌한 톤",
    accent: "from-emerald-200 to-teal-200",
    chip: "bg-emerald-500",
  },
  {
    slug: "v15",
    title: "Hot Pink Power",
    concept: "네온 핫핑크 한 점 + 검정 카드, 스포츠 브랜드 톤",
    accent: "from-pink-200 to-fuchsia-200",
    chip: "bg-pink-500",
  },
  {
    slug: "v16",
    title: "Lavender Bloom",
    concept: "라벤더/푹시아 그라데, 부드러운 활기",
    accent: "from-violet-200 to-fuchsia-200",
    chip: "bg-violet-500",
  },
  {
    slug: "v17",
    title: "Multi Pastel",
    concept: "카드마다 다른 파스텔(로즈/스카이/앰버/에메랄드), 친근한 멀티",
    accent: "from-rose-200 via-sky-200 to-emerald-200",
    chip: "bg-gradient-to-r from-rose-400 via-sky-400 to-emerald-400",
  },
  {
    slug: "v18",
    title: "Sunset Peach",
    concept: "피치/오렌지 그라데, 황혼 같은 활기",
    accent: "from-orange-200 to-rose-200",
    chip: "bg-orange-500",
  },
  {
    slug: "v19",
    title: "Forest Active",
    concept: "딥 에메랄드 헤더 + 화이트 카드 + 라임 액센트, 헬시 톤",
    accent: "from-emerald-300 to-lime-200",
    chip: "bg-emerald-700",
  },
  {
    slug: "v20",
    title: "Bold Mono Editorial",
    concept: "퓨어 화이트 + 검정 굵은 보더 + 빨강 한 점, 매거진 톤",
    accent: "from-zinc-200 to-red-200",
    chip: "bg-red-600",
  },
] as const;

export default async function PreviewIndex({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <div className="text-sm font-semibold text-zinc-500">
            Customer dashboard · white concepts
          </div>
          <div className="mt-1 text-2xl font-bold tracking-tight">
            10개 화이트 시안 비교
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600">
            같은 정보구조(QR 크게 / 오늘의 일정 / 예약 하기 + 마이 페이지 /
            대표번호)에 색·톤·보더만 다르게. 카드를 누르면 풀스크린 미리보기.
            결정 후 본 페이지(/me)에 적용.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VARIANTS.map((v) => (
            <li key={v.slug}>
              <Link
                href={`/${lang}/preview/me/${v.slug}`}
                className="group block overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200 transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-zinc-300"
              >
                <div
                  className={
                    "relative h-44 bg-gradient-to-br " + v.accent
                  }
                >
                  <div className="absolute inset-0 bg-white/30" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <div
                      className={
                        "inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white " +
                        v.chip
                      }
                    >
                      {v.slug.toUpperCase()}
                    </div>
                    <div className="mt-1 text-xl font-bold tracking-tight text-zinc-900">
                      {v.title}
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-sm leading-relaxed text-zinc-600">
                    {v.concept}
                  </p>
                  <div className="mt-3 text-xs text-zinc-500 group-hover:text-zinc-700">
                    풀스크린 보기 →
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
