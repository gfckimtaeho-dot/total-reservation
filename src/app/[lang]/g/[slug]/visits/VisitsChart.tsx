"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type View = "day" | "month" | "year";
// 한 막대(버킷)의 방문 건수 — 자유운동 / PT / 단체. visit-day 단위.
type Bar = { label: string; free: number; pt: number; cls: number };

// 화이트 테마 고정 — revenue 차트와 동일 톤.
const TK = {
  card: "border-violet-100 bg-white",
  text: "text-ink",
  sub: "text-ink/50",
  track: "bg-violet-100/60",
  tabActive: "bg-ink text-white",
  tabIdle: "text-ink/55 hover:bg-violet-50",
  chipOff: "border-violet-200 text-ink/35",
} as const;

// 세그먼트 색 — 자유운동(헤드라인)=바이올렛, PT=스카이, 단체=앰버. 셋 다
// 긍정 카테고리라 회색 안 씀([[feedback_grey_is_negative]]).
const C_FREE = "bg-violet-500";
const C_PT = "bg-sky-400";
const C_CLS = "bg-amber-400";
const C_FREE_TEXT = "text-violet-600";
const C_PT_TEXT = "text-sky-500";
const C_CLS_TEXT = "text-amber-500";

// 막대 라벨용 — 0은 빈 문자열(라벨 생략). 방문 건수는 작은 수라 축약 불필요.
function fmt(n: number): string {
  return n === 0 ? "" : String(n);
}

export function VisitsChart({
  lang,
  slug,
  view,
  anchorY,
  anchorM,
  periodLabel,
  series,
}: {
  lang: string;
  slug: string;
  view: View;
  anchorY: number;
  anchorM: number;
  periodLabel: string;
  series: Bar[];
}) {
  const t = useTranslations("visits");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sel, setSel] = useState<number | null>(null);
  // 세그먼트 토글 — 끄면 그 카테고리 막대 숨김(자유운동만 보기 등).
  const [showFree, setShowFree] = useState(true);
  const [showPt, setShowPt] = useState(true);
  const [showCls, setShowCls] = useState(true);

  const visibleOf = (b: Bar) =>
    (showFree ? b.free : 0) + (showPt ? b.pt : 0) + (showCls ? b.cls : 0);
  const maxVal = Math.max(1, ...series.map(visibleOf));

  // 보이는 기간 전체 합계 — 토글과 무관 항상 풀 합계.
  const sumFree = series.reduce((s, b) => s + b.free, 0);
  const sumPt = series.reduce((s, b) => s + b.pt, 0);
  const sumCls = series.reduce((s, b) => s + b.cls, 0);

  const narrow = series.length > 14;
  const minChartWidth = narrow ? `${series.length * 22}px` : undefined;

  function push(p: { view: View; y: number; m: number }) {
    startTransition(() => {
      router.push(`/${lang}/g/${slug}/visits?view=${p.view}&y=${p.y}&m=${p.m}`);
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
    view === "day" ? t("unitDay") : view === "month" ? t("unitMonth") : "";

  return (
    <div className={`mt-3 rounded-2xl border ${TK.card} p-4`}>
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
                (view === v ? TK.tabActive : TK.tabIdle)
              }
            >
              {t(
                v === "day" ? "viewDay" : v === "month" ? "viewMonth" : "viewYear",
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => nav(-1)}
            className={`rounded-full px-2.5 py-1 text-xs ${TK.tabIdle} disabled:opacity-40`}
          >
            ‹
          </button>
          <span className={`text-sm font-medium tabular-nums ${TK.text}`}>
            {periodLabel}
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => nav(1)}
            className={`rounded-full px-2.5 py-1 text-xs ${TK.tabIdle} disabled:opacity-40`}
          >
            ›
          </button>
        </div>
      </div>

      {/* 기간 합계 — 자유운동 / PT / 단체 방문 건수. 막대 토글과 무관 항상 표시. */}
      <div
        className={`mt-3 grid grid-cols-3 gap-3 rounded-xl ${TK.track} px-3 py-2.5`}
      >
        <SumCell label={t("legendFree")} value={sumFree} valueClass={C_FREE_TEXT} />
        <SumCell label={t("legendPt")} value={sumPt} valueClass={C_PT_TEXT} />
        <SumCell label={t("legendCls")} value={sumCls} valueClass={C_CLS_TEXT} />
      </div>

      {/* 세그먼트 토글 칩 */}
      <div className="mt-3 flex flex-wrap gap-2">
        <SegChip
          on={showFree}
          color={C_FREE}
          label={t("legendFree")}
          onClick={() => setShowFree((v) => !v)}
        />
        <SegChip
          on={showPt}
          color={C_PT}
          label={t("legendPt")}
          onClick={() => setShowPt((v) => !v)}
        />
        <SegChip
          on={showCls}
          color={C_CLS}
          label={t("legendCls")}
          onClick={() => setShowCls((v) => !v)}
        />
      </div>

      {/* 선택 막대 상세 */}
      <div className={`mt-2 text-xs ${TK.sub}`}>
        {selBar ? (
          <span className={TK.text}>
            {selBar.label}
            {unit} · {t("legendFree")} {selBar.free} · {t("legendPt")}{" "}
            {selBar.pt} · {t("legendCls")} {selBar.cls}
          </span>
        ) : (
          t("tapBar")
        )}
      </div>

      {/* 누적 막대 — 아래부터 자유운동 / PT / 단체 */}
      <div className="mt-2 overflow-x-auto">
        <div className="flex items-end gap-1" style={{ minWidth: minChartWidth }}>
          {series.map((b, i) => {
            const freeH = showFree ? (b.free / maxVal) * 100 : 0;
            const ptH = showPt ? (b.pt / maxVal) * 100 : 0;
            const clsH = showCls ? (b.cls / maxVal) * 100 : 0;
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
                  } ${on ? TK.text : TK.sub}`}
                >
                  {fmt(barTotal)}
                </span>
                <div
                  className={`flex h-28 w-full flex-col justify-end rounded-sm ${TK.track}`}
                >
                  <div
                    className={`w-full overflow-hidden rounded-t-sm ${C_CLS}`}
                    style={{ height: `${clsH}%` }}
                  />
                  <div
                    className={`w-full overflow-hidden ${C_PT}`}
                    style={{ height: `${ptH}%` }}
                  />
                  <div
                    className={`w-full overflow-hidden ${C_FREE}`}
                    style={{ height: `${freeH}%` }}
                  />
                </div>
                <span
                  className={`text-[9px] tabular-nums ${on ? TK.text : TK.sub}`}
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
  valueClass,
}: {
  label: string;
  value: number;
  valueClass: string;
}) {
  return (
    <div className="min-w-0">
      <div
        className={`truncate text-[10px] uppercase tracking-[0.16em] ${TK.sub}`}
      >
        {label}
      </div>
      <div
        className={`mt-0.5 truncate font-heading text-base tabular-nums ${valueClass}`}
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function SegChip({
  on,
  color,
  label,
  onClick,
}: {
  on: boolean;
  color: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition " +
        (on ? `border-transparent ${TK.text}` : TK.chipOff)
      }
    >
      <span
        className={"h-2.5 w-2.5 rounded-sm " + (on ? color : "bg-current opacity-30")}
      />
      {label}
    </button>
  );
}
