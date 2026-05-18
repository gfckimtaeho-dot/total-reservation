"use client";

import { useState } from "react";
import { Showcase, type ShowcaseConcept } from "@/components/showcase/Showcase";
import type { ShowcaseData } from "@/lib/catalog/showcaseData";

// 프리뷰 전용 래퍼: Dark ⇄ Light 두 컨셉을 같은 실데이터로 즉시 비교.
// 토글 칩은 프리뷰에서만 보이는 chrome — 실 라우트에는 들어가지 않는다.
export function PreviewToggle({ data }: { data: ShowcaseData }) {
  const [concept, setConcept] = useState<ShowcaseConcept>("dark");

  return (
    <div className="relative">
      <Showcase data={data} concept={concept} />

      <div className="fixed left-1/2 top-5 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/20 bg-black/60 p-1 backdrop-blur">
        {(["dark", "light"] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setConcept(c)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-[0.18em] transition ${
              concept === c
                ? "bg-white text-zinc-900"
                : "text-zinc-300 hover:text-white"
            }`}
          >
            {c === "dark" ? "Dark Cinematic" : "Editorial Light"}
          </button>
        ))}
      </div>
    </div>
  );
}
