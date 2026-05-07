import Link from "next/link";

const ROUND2 = [
  {
    key: "v6",
    name: "Black Lime",
    desc: "순수 블랙 + 라임 강세. 시간 블록 또렷, 셀별 라임 보더.",
    accentClass: "text-lime-300",
    border: "border-lime-300/30",
  },
  {
    key: "v7",
    name: "Black Amber",
    desc: "순수 블랙 + 앰버. 따뜻한 톤, 동일 구조.",
    accentClass: "text-amber-300",
    border: "border-amber-400/30",
  },
  {
    key: "v8",
    name: "Black Cyan",
    desc: "순수 블랙 + 시안. 차가운 톤, 동일 구조.",
    accentClass: "text-cyan-300",
    border: "border-cyan-400/30",
  },
];

const ROUND1 = [
  { key: "v1", name: "Crisp Black (lime)", accent: "text-lime-300" },
  { key: "v2", name: "Mono Sharp (white)", accent: "text-white" },
  { key: "v3", name: "Cyan Studio", accent: "text-cyan-300" },
  { key: "v4", name: "Amber Warm", accent: "text-amber-300" },
  { key: "v5", name: "Emerald Premium", accent: "text-emerald-400" },
];

export default function TrainerPreviewIndex() {
  return (
    <div className="min-h-screen bg-black p-6 text-zinc-100">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-heading text-2xl tracking-tight text-white">
          Trainer Dashboard 시안
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          2라운드 — V2의 순수 블랙 + V4의 시간 블록·셀 boundary 융합. 색상만 다름.
        </p>

        <div className="mt-6 grid gap-3">
          {ROUND2.map((v) => (
            <Link
              key={v.key}
              href={`/ko/preview/trainer-${v.key}`}
              className={`group block rounded-2xl border bg-black p-5 transition hover:bg-zinc-900 ${v.border}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${v.accentClass}`}
                  >
                    {v.key}
                  </span>
                  <h2 className="font-heading text-lg tracking-tight text-white">
                    {v.name}
                  </h2>
                </div>
                <span className="text-xs text-zinc-500 group-hover:text-zinc-300">
                  보기 →
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                {v.desc}
              </p>
            </Link>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-white/10 bg-zinc-950 p-4 text-xs text-zinc-400">
          <p>
            <strong className="text-zinc-200">2라운드 공통 정책</strong>
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>페이지 배경 = 순수 블랙 (V2의 깔끔함)</li>
            <li>일정: 시간 좌측 mono + 카드 우측 + 슬롯 사이 divider (V4의 분리감)</li>
            <li>캘린더: 셀마다 액센트 보더 + 일자 좌상단 + 클래스 1줄 truncate</li>
            <li>일자 모두 좌상단 정렬, 셀 고정 높이</li>
            <li>오늘은 휴무여도 강조 표시</li>
          </ul>
        </div>

        <details className="mt-6 rounded-xl border border-white/5 bg-zinc-950 p-4 text-xs text-zinc-500">
          <summary className="cursor-pointer text-zinc-400">
            이전 시안 (1라운드 — 참고)
          </summary>
          <ul className="mt-3 space-y-1.5">
            {ROUND1.map((v) => (
              <li key={v.key}>
                <Link
                  href={`/ko/preview/trainer-${v.key}`}
                  className={`hover:underline ${v.accent}`}
                >
                  {v.key} — {v.name}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}
