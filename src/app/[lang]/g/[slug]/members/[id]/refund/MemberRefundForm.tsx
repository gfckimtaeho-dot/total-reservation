"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { submitMemberRefund } from "../../actions";
import type { RefundItem } from "@/lib/refunds/member-request";

type Method = "BANK_TRANSFER" | "IN_PERSON";

// 카운터 환불 폼 (hybrid-c indigo). 권별(items 1개)·전체(items N개) 공용.
// 권별 내역 + 산식 + 합계 + 정가 기준 안내 + 지급 방법(기본 직접 지급) + 대면 확인
// 체크 후 "환불 완료" — 등록과 동시에 COMPLETED 마감되고 회원 채팅에 영수증이 간다.
export function MemberRefundForm({
  slug,
  lang,
  memberId,
  memberName,
  items,
}: {
  slug: string;
  lang: string;
  memberId: string;
  memberName: string;
  items: RefundItem[];
}) {
  const t = useTranslations("memberDetail");
  const router = useRouter();
  const [method, setMethod] = useState<Method>("IN_PERSON");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const money = (n: number) => `₱${n.toLocaleString()}`;
  const refundable = items.filter((i) => i.refundUnits > 0);
  const total = refundable.reduce((s, i) => s + i.refundPhp, 0);
  const nothing = refundable.length === 0;

  const bankOk =
    method === "IN_PERSON" ||
    (bankName.trim() !== "" &&
      bankAccount.trim() !== "" &&
      accountHolder.trim() !== "");
  const canSubmit = !nothing && bankOk && confirmed;

  function submit() {
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      const r = await submitMemberRefund(
        slug,
        refundable.map((i) => ({ kind: i.kind, id: i.passId })),
        { method, bankName, bankAccount, accountHolder },
      );
      if (r.ok) {
        router.push(`/${lang}/g/${slug}/members/${memberId}`);
        router.refresh();
      } else {
        setError(t("refundError"));
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* 환불 대상 목록 — 권별 내역 + 산식 */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
          {t("refundBreakdownTitle")}
        </div>
        {nothing ? (
          <p className="mt-3 text-base text-amber-800">{t("refundNothing")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-200">
            {refundable.map((it) => (
              <ItemBlock key={`${it.kind}:${it.passId}`} item={it} t={t} />
            ))}
          </ul>
        )}
        {!nothing && (
          <div className="mt-4 flex items-baseline justify-between border-t-2 border-zinc-300 pt-4">
            <span className="text-base font-semibold text-zinc-900">
              {t("refundTotalLabel", { n: refundable.length })}
            </span>
            <span className="text-3xl font-bold tracking-tight text-emerald-700 tabular-nums">
              {money(total)}
            </span>
          </div>
        )}
      </section>

      {/* 정가 기준 50% 안내 — 회원에게 그대로 설명할 문구. 분쟁 방지용 rose 강조. */}
      <section className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-6">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">
          {t("refundPriceBaseTitle")}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-rose-900">
          {t("refundPriceBaseBody")}
        </p>
      </section>

      {!nothing && (
        <>
          <section className="rounded-2xl border border-zinc-200 bg-white p-6">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
              {t("refundPayoutTitle")}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <MethodButton
                active={method === "IN_PERSON"}
                onClick={() => setMethod("IN_PERSON")}
                label={t("refundMethodInPerson")}
              />
              <MethodButton
                active={method === "BANK_TRANSFER"}
                onClick={() => setMethod("BANK_TRANSFER")}
                label={t("refundMethodBank")}
              />
            </div>
            {method === "BANK_TRANSFER" && (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Field
                  label={t("refundBankName")}
                  value={bankName}
                  onChange={setBankName}
                />
                <Field
                  label={t("refundBankAccount")}
                  value={bankAccount}
                  onChange={setBankAccount}
                />
                <Field
                  label={t("refundAccountHolder")}
                  value={accountHolder}
                  onChange={setAccountHolder}
                />
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-6">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1 h-5 w-5 rounded border-zinc-300 accent-indigo-600"
              />
              <span className="text-base leading-relaxed text-zinc-800">
                {t("refundConfirmLabel", {
                  name: memberName,
                  amount: money(total),
                })}
              </span>
            </label>
          </section>

          {error && <div className="text-sm text-rose-700">{error}</div>}

          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit || pending}
            className="w-full rounded-xl bg-emerald-600 py-3.5 text-base font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-40"
          >
            {pending ? t("refundSubmitting") : t("refundCompleteBtn")}
          </button>
        </>
      )}
    </div>
  );
}

function ItemBlock({
  item,
  t,
}: {
  item: RefundItem;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const unit = t(
    item.kind === "PACKAGE" ? "refundUnitSession" : "refundUnitDay",
  );
  const money = (n: number) => `₱${n.toLocaleString()}`;
  const rawHalf = (item.paidPhp * item.refundUnits) / item.totalUnits / 2;
  const wasRounded = item.refundPhp !== rawHalf;
  return (
    <li className="py-4 first:pt-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-lg font-semibold tracking-tight text-zinc-900">
          {item.serviceName}
          {item.trainerName && (
            <span className="ml-2 text-sm font-normal text-zinc-500">
              {t("refundTrainerLabel")}: {item.trainerName}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight text-emerald-700 tabular-nums">
            {money(item.refundPhp)}
          </span>
          {wasRounded && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
              {t("refundRounded")}
            </span>
          )}
        </div>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
        <Row label={t("refundPaidLabel")} value={money(item.paidPhp)} />
        <Row label={t("refundLineTotal")} value={`${item.totalUnits}${unit}`} />
        <Row
          label={t("refundLineCompleted")}
          value={`${item.completedUnits}${unit}`}
        />
        {item.todayUnits > 0 && (
          <Row
            label={t("refundLineToday")}
            value={`${item.todayUnits}${unit}`}
          />
        )}
        <Row
          label={t("refundLineRefundable")}
          value={`${item.refundUnits}${unit}`}
          strong
        />
      </dl>
      <div className="mt-2 text-xs text-zinc-500">
        {t("refundCalcLabel")}: ({money(item.paidPhp)} ÷ {item.totalUnits}) ×{" "}
        {item.refundUnits} × 50%
      </div>
    </li>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 sm:block">
      <dt className="text-zinc-500">{label}</dt>
      <dd
        className={
          "tabular-nums " +
          (strong ? "font-semibold text-zinc-900" : "text-zinc-700")
        }
      >
        {value}
      </dd>
    </div>
  );
}

function MethodButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-xl border px-4 py-3.5 text-base font-medium transition " +
        (active
          ? "border-indigo-500 bg-indigo-50 text-indigo-900"
          : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50")
      }
    >
      {label}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 outline-none focus:border-indigo-500"
      />
    </label>
  );
}
