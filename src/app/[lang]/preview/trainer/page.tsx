import Link from "next/link";

const VARIANTS = [
  {
    key: "v1",
    name: "Crisp Black",
    accent: "lime",
    desc: "정제된 현재안. 라임 강세, 셀 안에 클래스명 pill 2개까지.",
    gradient: "from-zinc-900 to-zinc-800",
    accentClass: "text-lime-300",
  },
  {
    key: "v2",
    name: "Mono Sharp",
    accent: "white",
    desc: "순수 흑 + 흰색만. 클래스 표시는 작은 dot. 미니멀 극단.",
    gradient: "from-black to-zinc-900",
    accentClass: "text-white",
  },
  {
    key: "v3",
    name: "Cyan Studio",
    accent: "cyan",
    desc: "Slate 베이스 + 시안. 오늘 셀 글로우. 차분한 세련됨.",
    gradient: "from-slate-900 to-slate-800",
    accentClass: "text-cyan-300",
  },
  {
    key: "v4",
    name: "Amber Warm",
    accent: "amber",
    desc: "Zinc + 앰버. 클래스명 1줄 + 코너 dot. 따뜻한 톤.",
    gradient: "from-zinc-900 to-zinc-800",
    accentClass: "text-amber-300",
  },
  {
    key: "v5",
    name: "Emerald Premium",
    accent: "emerald",
    desc: "큰 셀(h-20) + 그라데이션. 오늘 셀 강한 글로우. 고급감.",
    gradient: "from-zinc-900 to-zinc-800",
    accentClass: "text-emerald-400",
  },
];

export default function TrainerPreviewIndex() {
  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-heading text-2xl tracking-tight text-white">
          Trainer Dashboard 시안
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          5가지 톤. 핸드폰에서 직접 보고 마음에 드는 거 골라주세요. 모두 일자
          좌상단 정렬, weekday 가독성 보강, 셀 고정 높이.
        </p>

        <div className="mt-6 grid gap-3">
          {VARIANTS.map((v) => (
            <Link
              key={v.key}
              href={`/ko/preview/trainer-${v.key}`}
              className={`group block rounded-2xl bg-gradient-to-br ${v.gradient} p-5 ring-1 ring-white/10 transition hover:ring-white/30`}
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

        <div className="mt-8 rounded-xl border border-white/10 bg-zinc-900 p-4 text-xs text-zinc-400">
          <p>
            <strong className="text-zinc-200">고정 정책</strong> — 모든 시안
            공통:
          </p>
          <ul className="mt-2 space-y-1 list-disc list-inside">
            <li>일자 모두 좌상단 정렬</li>
            <li>셀 고정 높이 (수업 유무에 따라 줄 안 어긋남)</li>
            <li>요일 헤더 가독성 보강 (회색 X)</li>
            <li>오늘은 휴무여도 강조 표시</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
