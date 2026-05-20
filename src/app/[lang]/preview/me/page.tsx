import Link from "next/link";

// 5개 dark 시안 인덱스. 모바일 폰 폭(390px)으로 미니어처 프레임을 만들어
// 같은 화면에서 1차 비교. 풀스크린 비교는 각 카드 클릭.

const VARIANTS = [
  {
    slug: "v1",
    title: "Aurora Glow",
    concept: "보라/사이안 그라데이션 글로우, 부드러운 야경 무드",
    accent: "from-violet-500/40 to-sky-500/30",
  },
  {
    slug: "v2",
    title: "Neon Grid",
    concept: "순흑 + 라임/시안 형광, 터미널·사이버펑크 톤",
    accent: "from-lime-500/40 to-cyan-500/30",
  },
  {
    slug: "v3",
    title: "Calm Slate",
    concept: "차분한 슬레이트 + amber 한 색만 강조, 비즈니스 톤",
    accent: "from-slate-600/40 to-amber-500/20",
  },
  {
    slug: "v4",
    title: "Bold Mono Editorial",
    concept: "큰 흰글씨 타이포 + red 한 점, 매거진 무드",
    accent: "from-zinc-700/40 to-rose-500/30",
  },
  {
    slug: "v5",
    title: "Pastel Glass",
    concept: "글래스모피즘 + 파스텔 핑크·민트, 부드러운 야간 라이트",
    accent: "from-rose-500/30 to-emerald-500/30",
  },
  {
    slug: "v6",
    title: "Cinema Noir",
    concept: "거의 흑백 + tungsten orange 한 점, 영화관 spotlight 무드",
    accent: "from-zinc-700/30 to-orange-500/30",
  },
  {
    slug: "v7",
    title: "Forest Tactical",
    concept: "forest green 베이스 + bronze 액센트, 군용 utility 시계 톤",
    accent: "from-emerald-800/50 to-amber-700/30",
  },
  {
    slug: "v8",
    title: "Sunset Gradient",
    concept: "deep purple → sunset orange 그라데, 따뜻한 야간 라이트",
    accent: "from-purple-700/40 to-orange-500/40",
  },
  {
    slug: "v9",
    title: "Health App Dark",
    concept: "검정 + 큰 라운드 카드 + 활동링 다색 chip, Apple Health 무드",
    accent: "from-rose-500/40 via-emerald-500/30 to-sky-500/40",
  },
  {
    slug: "v10",
    title: "Bauhaus Geometric",
    concept: "primary 컬러 블록(빨/노/파) + 강한 geometry, 미술관 톤",
    accent: "from-red-500/40 via-yellow-400/30 to-blue-500/40",
  },
] as const;

export default async function PreviewIndex({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
            Customer dashboard · dark concepts
          </div>
          <div className="mt-1 font-heading text-2xl tracking-tight">
            5개 시안 비교
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            같은 mock 데이터(오늘 PT 18:00, 이번 주~다음 달 일정, 회원권/횟수권
            보유) 위에서 색·타이포·그리드만 다르게. 카드를 누르면 풀스크린
            미리보기. 결정 후 본 페이지(/me)에 적용.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VARIANTS.map((v) => (
            <li key={v.slug}>
              <Link
                href={`/${lang}/preview/me/${v.slug}`}
                className="group block overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-zinc-800 transition hover:ring-zinc-600"
              >
                <div
                  className={
                    "relative h-44 bg-gradient-to-br " + v.accent
                  }
                >
                  <div className="absolute inset-0 bg-zinc-950/40" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-300">
                      {v.slug.toUpperCase()}
                    </div>
                    <div className="mt-1 font-heading text-xl tracking-tight text-white">
                      {v.title}
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-sm leading-relaxed text-zinc-400">
                    {v.concept}
                  </p>
                  <div className="mt-3 text-xs text-zinc-500 group-hover:text-zinc-300">
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
