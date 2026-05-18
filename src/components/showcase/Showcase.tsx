"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type {
  ShowcaseData,
  ShowcaseMembership,
  ShowcaseService,
  ShowcasePackage,
  ShowcaseCombo,
  ShowcasePromotion,
} from "@/lib/catalog/showcaseData";

export type ShowcaseConcept = "dark" | "light";

type Cat = "membership" | "service" | "package" | "combo" | "promotion";
const CATS: Cat[] = [
  "membership",
  "service",
  "package",
  "combo",
  "promotion",
];

// 컨셉별 스타일 토큰. content는 동일, 색·타이포만 분기.
const TK = {
  dark: {
    root: "bg-zinc-950 text-zinc-100",
    eyebrow: "text-lime-300/70",
    title: "text-white",
    lead: "text-zinc-400",
    row: "border-white/10",
    name: "text-zinc-100",
    sub: "text-zinc-500",
    price: "text-lime-300",
    strike: "text-zinc-600 line-through",
    chip: "border-white/15 text-zinc-400",
    saveChip: "bg-lime-300/10 text-lime-300 border-lime-300/30",
    arrow:
      "border-white/15 text-zinc-300 hover:bg-white/10 hover:text-white",
    dot: "bg-white/20",
    dotOn: "bg-lime-300",
    gym: "text-zinc-500",
    hint: "text-zinc-600",
    accent: (_c: Cat) => "text-lime-300",
  },
  light: {
    root: "bg-[#faf8f3] text-ink",
    eyebrow: "",
    title: "text-ink",
    lead: "text-zinc-500",
    row: "border-zinc-200/80",
    name: "text-ink",
    sub: "text-zinc-500",
    price: "",
    strike: "text-zinc-400 line-through",
    chip: "border-zinc-300 text-zinc-500",
    saveChip: "bg-emerald-50 text-emerald-700 border-emerald-200",
    arrow:
      "border-zinc-300 text-zinc-500 hover:bg-white hover:text-ink hover:border-ink/30",
    dot: "bg-zinc-300",
    dotOn: "bg-ink",
    gym: "text-zinc-400",
    hint: "text-zinc-400",
    accent: (c: Cat) =>
      ({
        membership: "text-sky-600",
        service: "text-amber-600",
        package: "text-sky-600",
        combo: "text-violet-600",
        promotion: "text-lime-600",
      })[c],
  },
} as const;

const peso = (n: number) => `₱${Math.round(n).toLocaleString()}`;

export function Showcase({
  data,
  concept,
  exitHref,
}: {
  data: ShowcaseData;
  concept: ShowcaseConcept;
  // 트레이너가 발표를 끝내고 메인으로 돌아가는 경로. 없으면 버튼 미표시(프리뷰).
  exitHref?: string;
}) {
  const t = useTranslations("showcase");
  const tk = TK[concept];
  const scroller = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const now = new Date();

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    setIdx((prev) => (prev === i ? prev : i));
  }, []);

  const goTo = useCallback((i: number) => {
    const el = scroller.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(CATS.length - 1, i));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goTo(idx + 1);
      if (e.key === "ArrowLeft") goTo(idx - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, goTo]);

  const activePromotions = data.promotions.filter(
    (p) => now >= p.startsAt && now <= p.endsAt,
  );

  return (
    <div
      className={`relative h-[100dvh] w-screen overflow-hidden ${tk.root}`}
    >
      {/* 화면 돌아가기 — 우상단(오른손 엄지 접근성), 명확히 보이게 */}
      {exitHref && (
        <Link
          href={exitHref}
          className={`absolute right-5 top-5 z-30 flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition ${tk.arrow}`}
        >
          <span className="text-base leading-none">←</span>
          {t("exit")}
        </Link>
      )}

      {/* 상단: 헬스장명(중앙) + 카테고리 진행(좌 — 우상단은 돌아가기 버튼) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-center px-8 py-7 md:px-14">
        <span
          className={`text-xs font-semibold uppercase tracking-[0.28em] ${tk.gym}`}
        >
          {data.gymName}
        </span>
        <span
          className={`absolute left-8 text-xs font-medium tabular-nums tracking-[0.22em] md:left-14 ${tk.gym}`}
        >
          {String(idx + 1).padStart(2, "0")} / 0{CATS.length}
        </span>
      </div>

      {/* 가로 스크롤 패널 */}
      <div
        ref={scroller}
        onScroll={onScroll}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {CATS.map((cat) => (
          <section
            key={cat}
            className="relative flex h-full w-screen shrink-0 snap-center snap-always flex-col justify-center overflow-y-auto px-8 py-24 md:px-20"
          >
            <div className="mx-auto w-full max-w-3xl">
              <div
                className={`text-xs font-semibold uppercase tracking-[0.34em] ${
                  concept === "dark" ? tk.eyebrow : tk.accent(cat)
                }`}
              >
                {t(`cat.${cat}`)}
              </div>
              <h2
                className={`mt-4 font-heading text-5xl leading-[1.05] tracking-tight md:text-6xl ${tk.title}`}
              >
                {t(`title.${cat}`)}
              </h2>
              <p className={`mt-4 text-base md:text-lg ${tk.lead}`}>
                {t(`lead.${cat}`)}
              </p>

              <div className="mt-12">
                {cat === "membership" && (
                  <MembershipPanel
                    items={data.memberships}
                    tk={tk}
                    cat={cat}
                    t={t}
                  />
                )}
                {cat === "service" && (
                  <ServicePanel
                    items={data.services}
                    tk={tk}
                    cat={cat}
                    t={t}
                  />
                )}
                {cat === "package" && (
                  <PackagePanel
                    items={data.packages}
                    tk={tk}
                    cat={cat}
                    t={t}
                  />
                )}
                {cat === "combo" && (
                  <ComboPanel items={data.combos} tk={tk} cat={cat} t={t} />
                )}
                {cat === "promotion" && (
                  <PromotionPanel
                    items={activePromotions}
                    tk={tk}
                    cat={cat}
                    t={t}
                  />
                )}
              </div>
            </div>

            {idx === 0 && cat === "membership" && (
              <div
                className={`pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 text-xs uppercase tracking-[0.3em] ${tk.hint}`}
              >
                {t("swipeHint")} →
              </div>
            )}
          </section>
        ))}
      </div>


      {/* 하단: 화살표 + 진행 점 */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-6 pb-8">
        <button
          type="button"
          aria-label="prev"
          onClick={() => goTo(idx - 1)}
          disabled={idx === 0}
          className={`flex h-11 w-11 items-center justify-center rounded-full border text-lg transition disabled:opacity-25 ${tk.arrow}`}
        >
          ←
        </button>
        <div className="flex items-center gap-2.5">
          {CATS.map((c, i) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => goTo(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === idx ? `w-8 ${tk.dotOn}` : `w-1.5 ${tk.dot}`
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          aria-label="next"
          onClick={() => goTo(idx + 1)}
          disabled={idx === CATS.length - 1}
          className={`flex h-11 w-11 items-center justify-center rounded-full border text-lg transition disabled:opacity-25 ${tk.arrow}`}
        >
          →
        </button>
      </div>
    </div>
  );
}

type PanelStyle = (typeof TK)[ShowcaseConcept];
type T = ReturnType<typeof useTranslations>;

function Row({
  tk,
  cat,
  concept,
  name,
  sub,
  right,
}: {
  tk: PanelStyle;
  cat: Cat;
  concept: ShowcaseConcept;
  name: string;
  sub?: ReactNode;
  right: ReactNode;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-6 border-b py-5 ${tk.row}`}
    >
      <div className="min-w-0">
        <div className={`text-lg font-medium md:text-xl ${tk.name}`}>
          {name}
        </div>
        {sub && <div className={`mt-1 text-sm ${tk.sub}`}>{sub}</div>}
      </div>
      <div
        className={`shrink-0 text-right font-heading text-2xl tabular-nums tracking-tight md:text-3xl ${
          concept === "light" ? tk.accent(cat) : tk.price
        }`}
      >
        {right}
      </div>
    </div>
  );
}

function MembershipPanel({
  items,
  tk,
  cat,
  t,
}: {
  items: ShowcaseMembership[];
  tk: PanelStyle;
  cat: Cat;
  t: T;
}) {
  const concept: ShowcaseConcept = tk === TK.dark ? "dark" : "light";
  return (
    <div>
      {items.map((m) => {
        const months =
          m.durationDays >= 28 ? Math.round(m.durationDays / 30) : 0;
        return (
          <Row
            key={m.id}
            tk={tk}
            cat={cat}
            concept={concept}
            name={m.name}
            sub={
              months > 0
                ? t("perMonth", { v: peso(m.pricePhp / months) })
                : undefined
            }
            right={peso(m.pricePhp)}
          />
        );
      })}
    </div>
  );
}

function ServicePanel({
  items,
  tk,
  cat,
  t,
}: {
  items: ShowcaseService[];
  tk: PanelStyle;
  cat: Cat;
  t: T;
}) {
  const concept: ShowcaseConcept = tk === TK.dark ? "dark" : "light";
  return (
    <div>
      {items.map((s) => (
        <Row
          key={s.id}
          tk={tk}
          cat={cat}
          concept={concept}
          name={s.name}
          sub={
            <span className="flex flex-wrap gap-x-3 gap-y-1">
              <span>{t("min", { n: s.durationMin })}</span>
              <span aria-hidden>·</span>
              <span>
                {s.capacity <= 1
                  ? t("private")
                  : t("group", { n: s.capacity })}
              </span>
            </span>
          }
          right={peso(s.pricePhp)}
        />
      ))}
    </div>
  );
}

function PackagePanel({
  items,
  tk,
  cat,
  t,
}: {
  items: ShowcasePackage[];
  tk: PanelStyle;
  cat: Cat;
  t: T;
}) {
  const concept: ShowcaseConcept = tk === TK.dark ? "dark" : "light";
  return (
    <div>
      {items.map((p) => {
        const discounted = p.listPhp > p.pricePhp;
        return (
          <Row
            key={p.id}
            tk={tk}
            cat={cat}
            concept={concept}
            name={p.name}
            sub={
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>
                  {p.serviceName} · {t("sessions", { n: p.sessionCount })}
                </span>
                <span aria-hidden>·</span>
                <span>
                  {t("perSession", {
                    v: peso(p.pricePhp / p.sessionCount),
                  })}
                </span>
              </span>
            }
            right={
              <span className="flex flex-col items-end">
                {discounted && (
                  <span className={`text-sm ${tk.strike}`}>
                    {peso(p.listPhp)}
                  </span>
                )}
                <span>{peso(p.pricePhp)}</span>
              </span>
            }
          />
        );
      })}
    </div>
  );
}

function ComboPanel({
  items,
  tk,
  cat,
  t,
}: {
  items: ShowcaseCombo[];
  tk: PanelStyle;
  cat: Cat;
  t: T;
}) {
  const concept: ShowcaseConcept = tk === TK.dark ? "dark" : "light";
  return (
    <div className="space-y-5">
      {items.map((c) => {
        const save = c.listPhp - c.pricePhp;
        const parts = [
          ...(c.membershipName ? [c.membershipName] : []),
          ...c.packageNames,
        ];
        return (
          <div
            key={c.id}
            className={`rounded-2xl border p-6 ${tk.row} ${
              concept === "dark" ? "bg-white/[0.03]" : "bg-white"
            }`}
          >
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <div
                  className={`text-xl font-medium md:text-2xl ${tk.name}`}
                >
                  {c.name}
                </div>
                <div className={`mt-2 text-sm ${tk.sub}`}>
                  <span className="uppercase tracking-wider">
                    {t("includes")}
                  </span>{" "}
                  · {parts.join(" + ")}
                </div>
              </div>
              <div className="shrink-0 text-right">
                {save > 0 && (
                  <div className={`text-sm ${tk.strike}`}>
                    {peso(c.listPhp)}
                  </div>
                )}
                <div
                  className={`font-heading text-3xl tabular-nums tracking-tight md:text-4xl ${
                    concept === "light" ? tk.accent(cat) : tk.price
                  }`}
                >
                  {peso(c.pricePhp)}
                </div>
              </div>
            </div>
            {save > 0 && (
              <div
                className={`mt-4 inline-block rounded-full border px-3 py-1 text-xs font-medium ${tk.saveChip}`}
              >
                {t("save", { v: Math.round(save).toLocaleString() })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PromotionPanel({
  items,
  tk,
  cat,
  t,
}: {
  items: ShowcasePromotion[];
  tk: PanelStyle;
  cat: Cat;
  t: T;
}) {
  const concept: ShowcaseConcept = tk === TK.dark ? "dark" : "light";
  if (items.length === 0) {
    return (
      <div
        className={`rounded-2xl border border-dashed py-16 text-center text-sm ${tk.row} ${tk.sub}`}
      >
        {t("noPromotions")}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {items.map((p) => {
        const label =
          p.discountType === "PERCENT"
            ? `${p.discountValue}%`
            : peso(p.discountValue);
        return (
          <div
            key={p.id}
            className={`flex items-center justify-between gap-6 rounded-2xl border p-6 ${tk.row} ${
              concept === "dark" ? "bg-white/[0.03]" : "bg-white"
            }`}
          >
            <div className="min-w-0">
              <div className={`text-xl font-medium md:text-2xl ${tk.name}`}>
                {p.name}
              </div>
              <div
                className={`mt-1 text-sm uppercase tracking-wider ${tk.sub}`}
              >
                {t("discountAll")}
              </div>
            </div>
            <div
              className={`shrink-0 font-heading text-3xl tracking-tight md:text-4xl ${
                concept === "light" ? tk.accent(cat) : tk.price
              }`}
            >
              {t("off", { v: label })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
