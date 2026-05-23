"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type Tone = "normal" | "black" | "white";
type View = "day" | "month" | "year";
type Bar = { label: string; total: number; owner: number };

const TONE = {
  normal: {
    card: "border-ink/10 bg-white",
    text: "text-ink",
    sub: "text-ink/55",
    track: "bg-ink/5",
    tabActive: "bg-ink text-white",
    tabIdle: "text-ink/60 hover:bg-ink/5",
    chipOff: "border-ink/15 text-ink/40",
  },
  black: {
    card: "border-white/5 bg-zinc-900",
    text: "text-white",
    sub: "text-zinc-500",
    track: "bg-white/5",
    tabActive: "bg-lime-300 text-zinc-950",
    tabIdle: "text-zinc-400 hover:bg-white/5",
    chipOff: "border-white/15 text-zinc-600",
  },
  white: {
    card: "border-violet-100 bg-white",
    text: "text-ink",
    sub: "text-ink/50",
    track: "bg-violet-100/60",
    tabActive: "bg-ink text-white",
    tabIdle: "text-ink/55 hover:bg-violet-50",
    chipOff: "border-violet-200 text-ink/35",
  },
} as const;

// 세그먼트 색 — 3테마 공통. 순수익=에메랄드, 트레이너 지급=스카이.
const C_OWNER = "bg-emerald-400";
const C_PAYOUT = "bg-sky-400";
const C_OWNER_TEXT = "text-emerald-500";
const C_PAYOUT_TEXT = "text-sky-500";

// 막대 라벨용 천/백만 축약. 0은 빈 문자열(라벨 생략).
function fmtK(n: number): string {
  if (n === 0) return "";
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1)}K`;
  if (n < 1000000) return `${Math.round(n / 1000)}K`;
  return `${(n / 1000000).toFixed(1)}M`;
}

export function RevenueChart({
  tone,
  lang,
  slug,
  view,
  anchorY,
  anchorM,
  periodLabel,
  series,
}: {
  tone: Tone;
  lang: string;
  slug: string;
  view: View;
  anchorY: number;
  anchorM: number;
  periodLabel: string;
  series: Bar[];
}) {
  const t = useTranslations("revenue");
  const router = useRouter();
  const tk = TONE[tone];
  const [pending, startTransition] = useTransition();
  const [sel, setSel] = useState<number | null>(null);
  // 세그먼트 토글 — 둘 다 켜면 총매출, 하나 끄면 그 세그먼트만.
  const [showOwner, setShowOwner] = useState(true);
  const [showPayout, setShowPayout] = useState(true);

  const money = (n: number) => `₱${n.toLocaleString()}`;
  const payoutOf = (b: Bar) => b.total - b.owner;
  const visibleOf = (b: Bar) =>
    (showOwner ? b.owner : 0) + (showPayout ? payoutOf(b) : 0);
  const maxVal = Math.max(1, ...series.map(visibleOf));

  // 보이는 기간 전체 합계 — 차트 안 금액 카드(총매출/순수익/트레이너 지급).
  // 막대 토글(showOwner/showPayout)과 무관, 항상 풀 합계.
  const sumTotal = series.reduce((s, b) => s + b.total, 0);
  const sumOwner = series.reduce((s, b) => s + b.owner, 0);
  const sumPayout = sumTotal - sumOwner;
  // 일별(30+ 막대)에서도 K-단위 라벨이 보이게 — 막대 폭이 좁으면 컨테이너
  // 최소폭을 늘려서 가로 스크롤로 흐르게 한다. 22px/막대면 "12K" 안 잘림.
  const narrow = series.length > 14;
  const minChartWidth = narrow ? `${series.length * 22}px` : undefined;

  function push(p: { view: View; y: number; m: number }) {
    startTransition(() => {
      router.push(
        `/${lang}/g/${slug}/revenue?view=${p.view}&y=${p.y}&m=${p.m}`,
      );
    });
  }
  function nav(dir: -1 | 1) {
    setSel(null);
    if (view === "day") {
      let y = anchorY;
      let m = anchorM + dir;
      if (m < 1) {
        m = 12;
        y -= 1;
      } else if (m > 12) {
        m = 1;
        y += 1;
      }
      push({ view, y, m });
    } else if (view === "month") {
      push({ view, y: anchorY + dir, m: anchorM });
    } else {
      push({ view, y: anchorY + dir * 10, m: anchorM });
    }
  }

  const views: View[] = ["day", "month", "year"];
  const selBar = sel !== null ? series[sel] : null;
  const unit =
    view === "day"
      ? t("unitDay")
      : view === "month"
        ? t("unitMonth")
        : "";

  return (
    <div className={`mt-3 rounded-2xl border ${tk.card} p-4`}>
      {/* 뷰 토글 + 기간 이동 */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1">
          {views.map((v) => (
            <button
              key={v}
              type="button"
              disabled={pending}
              onClick={() => {
                setSel(null);
                push({ view: v, y: anchorY, m: anchorM });
              }}
              className={
                "rounded-full px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 " +
                (view === v ? tk.tabActive : tk.tabIdle)
              }
            >
              {t(
                v === "day"
                  ? "viewDay"
                  : v === "month"
                    ? "viewMonth"
                    : "viewYear",
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => nav(-1)}
            className={`rounded-full px-2.5 py-1 text-xs ${tk.tabIdle} disabled:opacity-40`}
          >
            ‹
          </button>
          <span className={`text-sm font-medium tabular-nums ${tk.text}`}>
            {periodLabel}
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => nav(1)}
            className={`rounded-full px-2.5 py-1 text-xs ${tk.tabIdle} disabled:opacity-40`}
          >
            ›
          </button>
        </div>
      </div>

      {/* 기간 합계 — 총매출 / 순수익 / 트레이너 지급. 막대 토글과 무관 항상 표시. */}
      <div
        className={`mt-3 grid grid-cols-3 gap-3 rounded-xl ${tk.track} px-3 py-2.5`}
      >
        <SumCell
          label={t("sumTotal")}
          value={money(sumTotal)}
          tk={tk}
        />
        <SumCell
          label={t("legendOwner")}
          value={money(sumOwner)}
          tk={tk}
          valueClass={C_OWNER_TEXT}
        />
        <SumCell
          label={t("legendPayout")}
          value={money(sumPayout)}
          tk={tk}
          valueClass={C_PAYOUT_TEXT}
        />
      </div>

      {/* 세그먼트 토글 칩 */}
      <div className="mt-3 flex gap-2">
        <SegChip
          on={showOwner}
          color={C_OWNER}
          label={t("legendOwner")}
          tk={tk}
          onClick={() => setShowOwner((v) => !v)}
        />
        <SegChip
          on={showPayout}
          color={C_PAYOUT}
          label={t("legendPayout")}
          tk={tk}
          onClick={() => setShowPayout((v) => !v)}
        />
      </div>

      {/* 선택 막대 상세 */}
      <div className={`mt-2 text-xs ${tk.sub}`}>
        {selBar ? (
          <span className={tk.text}>
            {selBar.label}
            {unit} · {t("legendOwner")} {money(selBar.owner)} ·{" "}
            {t("legendPayout")} {money(payoutOf(selBar))}
          </span>
        ) : (
          t("tapBar")
        )}
      </div>

      {/* 누적 막대 — 아래 순수익, 위 트레이너 지급 */}
      <div className="mt-2 overflow-x-auto">
        <div
          className="flex items-end gap-1"
          style={{ minWidth: minChartWidth }}
        >
          {series.map((b, i) => {
            const ownerH = showOwner
              ? (b.owner / maxVal) * 100
              : 0;
            const payoutH = showPayout
              ? (payoutOf(b) / maxVal) * 100
              : 0;
            const on = sel === i;
            const barTotal = visibleOf(b);
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSel(on ? null : i)}
                className="flex flex-1 flex-col items-center gap-1"
                style={{ minWidth: narrow ? "22px" : "14px" }}
              >
                <span
                  className={`min-h-[12px] tabular-nums ${
                    narrow ? "text-[8.5px]" : "text-[9px]"
                  } ${on ? tk.text : tk.sub}`}
                >
                  {fmtK(barTotal)}
                </span>
                <div
                  className={`flex h-28 w-full flex-col justify-end rounded-sm ${tk.track}`}
                >
                  <div
                    className={`flex w-full items-center justify-center overflow-hidden rounded-t-sm ${C_PAYOUT}`}
                    style={{ height: `${payoutH}%` }}
                  >
                    {/* 세그먼트 높이가 충분히(픽셀 ≈10px) 클 때만 안 라벨 표시. */}
                    {payoutH >= 9 && (
                      <span className="text-[8px] font-semibold tabular-nums text-white">
                        {fmtK(payoutOf(b))}
                      </span>
                    )}
                  </div>
                  <div
                    className={`flex w-full items-center justify-center overflow-hidden ${C_OWNER}`}
                    style={{ height: `${ownerH}%` }}
                  >
                    {ownerH >= 9 && (
                      <span className="text-[8px] font-semibold tabular-nums text-white">
                        {fmtK(b.owner)}
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className={`text-[9px] tabular-nums ${
                    on ? tk.text : tk.sub
                  }`}
                >
                  {b.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SumCell({
  label,
  value,
  tk,
  valueClass,
}: {
  label: string;
  value: string;
  tk: { text: string; sub: string };
  valueClass?: string;
}) {
  return (
    <div className="min-w-0">
      <div className={`truncate text-[10px] uppercase tracking-[0.16em] ${tk.sub}`}>
        {label}
      </div>
      <div
        className={`mt-0.5 truncate font-heading text-base tabular-nums ${
          valueClass ?? tk.text
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function SegChip({
  on,
  color,
  label,
  tk,
  onClick,
}: {
  on: boolean;
  color: string;
  label: string;
  tk: { text: string; chipOff: string };
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition " +
        (on ? `border-transparent ${tk.text}` : tk.chipOff)
      }
    >
      <span
        className={
          "h-2.5 w-2.5 rounded-sm " + (on ? color : "bg-current opacity-30")
        }
      />
      {label}
    </button>
  );
}
