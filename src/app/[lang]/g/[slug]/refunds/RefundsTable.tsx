"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { completeRefund } from "./actions";

type Tone = "normal" | "black" | "white";

export type RefundRow = {
  id: string;
  kind: "PACKAGE" | "MEMBERSHIP";
  serviceName: string;
  trainerName: string | null;
  refundPhp: number;
  totalUnits: number;
  completedUnits: number;
  todayUnits: number;
  refundUnits: number;
  payoutMethod: "BANK_TRANSFER" | "IN_PERSON";
  bankName: string | null;
  bankAccount: string | null;
  accountHolder: string | null;
  reason:
    | "CUSTOMER_REQUEST"
    | "CLASS_DISCONTINUED"
    | "SERVICE_DISCONTINUED"
    | "STAFF_UNAVAILABLE";
  status: "PENDING" | "COMPLETED";
  requestedAt: string;
  completedAt: string | null;
  user: { name: string; phone: string | null };
};

const TONE = {
  normal: {
    card: "border-ink/10 bg-white",
    th: "text-ink/55",
    td: "text-ink",
    rowBorder: "border-ink/5",
    muted: "text-ink/50",
    input: "border-ink/15 bg-white text-ink",
    tabActive: "bg-ink text-white",
    tabIdle: "text-ink/60 hover:bg-ink/5",
    btn: "bg-ink text-white hover:brightness-110",
  },
  black: {
    card: "border-white/5 bg-zinc-900",
    th: "text-zinc-500",
    td: "text-zinc-200",
    rowBorder: "border-white/5",
    muted: "text-zinc-500",
    input: "border-white/15 bg-zinc-950 text-white",
    tabActive: "bg-lime-300 text-zinc-950",
    tabIdle: "text-zinc-400 hover:bg-white/5",
    btn: "bg-lime-300 text-zinc-950 hover:brightness-110",
  },
  white: {
    card: "border-violet-100 bg-white",
    th: "text-ink/55",
    td: "text-ink",
    rowBorder: "border-violet-50",
    muted: "text-ink/45",
    input: "border-violet-200 bg-white text-ink",
    tabActive: "bg-ink text-white",
    tabIdle: "text-ink/55 hover:bg-violet-50",
    btn: "bg-ink text-white hover:brightness-110",
  },
} as const;

function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

// 현재 from/to 가 어느 프리셋과 일치하는지 — 프리셋 버튼 활성 표시용.
// 날짜 없음 = "전체"(기본 선택). 직접 범위면 일치하는 게 없어 null.
function derivePreset(
  from: string,
  to: string,
): "all" | "today" | "week" | "month" | null {
  if (!from && !to) return "all";
  const now = new Date();
  const todayS = ymdLocal(now);
  if (to !== todayS) return null;
  if (from === todayS) return "today";
  const w = new Date(now);
  w.setDate(w.getDate() - 6);
  if (from === ymdLocal(w)) return "week";
  const m = new Date(now);
  m.setMonth(m.getMonth() - 1);
  if (from === ymdLocal(m)) return "month";
  return null;
}

export function RefundsTable({
  tone,
  lang,
  slug,
  rows,
  page,
  totalPages,
  status,
  from,
  to,
  customer,
  trainer,
  pendingCount,
  pendingSum,
}: {
  tone: Tone;
  lang: string;
  slug: string;
  rows: RefundRow[];
  page: number;
  totalPages: number;
  status: "pending" | "completed" | "all";
  from: string;
  to: string;
  customer: string;
  trainer: string;
  pendingCount: number;
  pendingSum: number;
}) {
  const t = useTranslations("refunds");
  const router = useRouter();
  const tk = TONE[tone];
  const [pending, startTransition] = useTransition();
  const [fromV, setFromV] = useState(from);
  const [toV, setToV] = useState(to);
  const [custV, setCustV] = useState(customer);
  const [trainV, setTrainV] = useState(trainer);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const money = (n: number) => `₱${n.toLocaleString()}`;
  const activePreset = derivePreset(fromV, toV);

  // 현재 필터 + override 로 URL 구성 후 이동. page 는 명시 안 하면 1로.
  function go(over: Partial<Record<string, string>>) {
    const merged: Record<string, string> = {
      status,
      from: fromV,
      to: toV,
      customer: custV,
      trainer: trainV,
      page: "1",
      ...over,
    };
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) u.set(k, v);
    startTransition(() => {
      router.push(`/${lang}/g/${slug}/refunds?${u.toString()}`);
    });
  }

  function preset(kind: "all" | "today" | "week" | "month") {
    if (kind === "all") {
      setFromV("");
      setToV("");
      go({ from: "", to: "" });
      return;
    }
    const now = new Date();
    const f = new Date(now);
    if (kind === "week") f.setDate(f.getDate() - 6);
    else if (kind === "month") f.setMonth(f.getMonth() - 1);
    const fromS = ymdLocal(f);
    const toS = ymdLocal(now);
    setFromV(fromS);
    setToV(toS);
    go({ from: fromS, to: toS });
  }

  function doComplete(id: string) {
    setError(null);
    startTransition(async () => {
      const r = await completeRefund(slug, id);
      if (r.ok) {
        setConfirmId(null);
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  const dateFmt = new Intl.DateTimeFormat(
    lang === "en" ? "en-US" : "ko-KR",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    },
  );

  const statusTabs: { key: "pending" | "completed" | "all"; label: string }[] =
    [
      { key: "pending", label: t("tabPending") },
      { key: "completed", label: t("tabCompleted") },
      { key: "all", label: t("tabAll") },
    ];

  return (
    <div className="mt-4">
      {/* 미지급 합계 */}
      <div
        className={`rounded-xl border ${tk.card} px-4 py-3 text-sm ${tk.td}`}
      >
        {t("pendingSummary", {
          count: pendingCount,
          sum: money(pendingSum),
        })}
      </div>

      {/* 상태 탭 */}
      <div className="mt-3 flex gap-1.5">
        {statusTabs.map((s) => (
          <button
            key={s.key}
            type="button"
            disabled={pending}
            onClick={() => go({ status: s.key })}
            className={
              "rounded-full px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 " +
              (status === s.key ? tk.tabActive : tk.tabIdle)
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* 날짜 프리셋 + 직접 범위 + 이름 검색 */}
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <div className="flex gap-1.5">
          {(["all", "today", "week", "month"] as const).map((k) => (
            <button
              key={k}
              type="button"
              disabled={pending}
              onClick={() => preset(k)}
              className={
                "rounded-full px-3 py-1.5 text-xs transition disabled:opacity-50 " +
                (activePreset === k ? tk.tabActive : tk.tabIdle)
              }
            >
              {t(
                k === "all"
                  ? "presetAll"
                  : k === "today"
                    ? "presetToday"
                    : k === "week"
                      ? "presetWeek"
                      : "presetMonth",
              )}
            </button>
          ))}
        </div>
        <input
          type="date"
          lang={lang}
          value={fromV}
          onChange={(e) => setFromV(e.target.value)}
          className={`rounded-md border px-2 py-1.5 text-xs ${tk.input}`}
        />
        <span className={`text-xs ${tk.muted}`}>~</span>
        <input
          type="date"
          lang={lang}
          value={toV}
          onChange={(e) => setToV(e.target.value)}
          className={`rounded-md border px-2 py-1.5 text-xs ${tk.input}`}
        />
        <input
          type="text"
          value={custV}
          onChange={(e) => setCustV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") go({});
          }}
          placeholder={t("searchCustomer")}
          className={`w-32 rounded-md border px-2 py-1.5 text-xs ${tk.input}`}
        />
        <input
          type="text"
          value={trainV}
          onChange={(e) => setTrainV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") go({});
          }}
          placeholder={t("searchTrainer")}
          className={`w-32 rounded-md border px-2 py-1.5 text-xs ${tk.input}`}
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => go({})}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${tk.btn} disabled:opacity-50`}
        >
          {t("searchBtn")}
        </button>
      </div>

      {error && (
        <div className="mt-2 text-xs text-rose-500">{error}</div>
      )}

      {/* 그리드 */}
      <div
        className={`mt-3 overflow-x-auto rounded-2xl border ${tk.card}`}
      >
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className={`border-b ${tk.rowBorder}`}>
              {[
                "colCustomer",
                "colProduct",
                "colUnits",
                "colAmount",
                "colPayout",
                "colRequested",
                "colTrainer",
                "colAction",
              ].map((c) => (
                <th
                  key={c}
                  className={`px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.14em] ${tk.th}`}
                >
                  {t(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className={`px-3 py-10 text-center text-sm ${tk.muted}`}
                >
                  {t("empty")}
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const unit = t(
                  r.kind === "PACKAGE" ? "unitSession" : "unitDay",
                );
                const used = r.completedUnits + r.todayUnits;
                return (
                  <tr key={r.id} className={`border-b ${tk.rowBorder}`}>
                    {/* 고객 + 연락처 */}
                    <td className={`px-3 py-3 ${tk.td}`}>
                      <div className="font-medium">{r.user.name}</div>
                      {r.user.phone && (
                        <div
                          className={`text-[11px] tabular-nums ${tk.muted}`}
                        >
                          {r.user.phone}
                        </div>
                      )}
                    </td>
                    {/* 상품명 + (매장 귀책 사유면) 칩 */}
                    <td className={`px-3 py-3 ${tk.td}`}>
                      <div>{r.serviceName}</div>
                      {r.reason !== "CUSTOMER_REQUEST" && (
                        <div className="mt-1">
                          <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-500/30">
                            {t(`reasonLabel.${r.reason}`)}
                          </span>
                        </div>
                      )}
                    </td>
                    {/* 횟수 — 총/완료/환불 */}
                    <td
                      className={`px-3 py-3 text-center text-xs tabular-nums ${tk.muted}`}
                    >
                      {t("unitsCell", {
                        total: r.totalUnits,
                        used,
                        refund: r.refundUnits,
                        unit,
                      })}
                    </td>
                    {/* 환불 금액 */}
                    <td
                      className={`px-3 py-3 text-right font-semibold tabular-nums ${tk.td}`}
                    >
                      {money(r.refundPhp)}
                    </td>
                    {/* 수령 방법 / 계좌 */}
                    <td className={`px-3 py-3 text-xs ${tk.td}`}>
                      {r.payoutMethod === "IN_PERSON" ? (
                        <span className={tk.muted}>
                          {t("methodInPerson")}
                        </span>
                      ) : (
                        <div className="tabular-nums">
                          <div>
                            {r.bankName} {r.bankAccount}
                          </div>
                          <div className={tk.muted}>
                            {t("holderLabel", {
                              name: r.accountHolder ?? "",
                            })}
                          </div>
                        </div>
                      )}
                    </td>
                    {/* 신청일 */}
                    <td
                      className={`px-3 py-3 text-center text-xs tabular-nums ${tk.muted}`}
                    >
                      {dateFmt.format(new Date(r.requestedAt))}
                    </td>
                    {/* 담당 트레이너 */}
                    <td className={`px-3 py-3 text-center text-xs ${tk.td}`}>
                      {r.trainerName ?? (
                        <span className={tk.muted}>-</span>
                      )}
                    </td>
                    {/* 상태 / 환불 완료 액션 */}
                    <td className="px-3 py-3 text-center">
                      {r.status === "COMPLETED" ? (
                        <span className="text-xs font-medium text-emerald-500">
                          {t("statusDone")}
                        </span>
                      ) : confirmId === r.id ? (
                        <span className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => doComplete(r.id)}
                            className="rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                          >
                            {t("confirmYes")}
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => setConfirmId(null)}
                            className={`rounded-full px-2.5 py-1 text-[11px] ${tk.tabIdle}`}
                          >
                            {t("confirmNo")}
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            setError(null);
                            setConfirmId(r.id);
                          }}
                          className="rounded-full bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
                        >
                          {t("markDone")}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 페이징 */}
      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={pending || page <= 1}
            onClick={() => go({ page: String(page - 1) })}
            className={`rounded-full px-3 py-1.5 text-xs ${tk.tabIdle} disabled:opacity-30`}
          >
            {t("prev")}
          </button>
          <span className={`text-xs tabular-nums ${tk.muted}`}>
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={pending || page >= totalPages}
            onClick={() => go({ page: String(page + 1) })}
            className={`rounded-full px-3 py-1.5 text-xs ${tk.tabIdle} disabled:opacity-30`}
          >
            {t("next")}
          </button>
        </div>
      )}
    </div>
  );
}
