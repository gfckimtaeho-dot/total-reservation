"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { submitMemberRefund } from "../../actions";
import type { RefundPreview } from "@/lib/refunds/member-request";

type PreviewData = Extract<RefundPreview, { ok: true }>;
type Method = "BANK_TRANSFER" | "IN_PERSON";

// 카운터 환불 등록 폼 (hybrid-c indigo). 내역 + 산식 + 정가 기준 안내 + 수령 방법
// (기본 직접 수령) + 대면 확인 체크 후 등록. 등록되면 /refunds 로 이동해 바로
// "완료" 마감할 수 있게 한다.
export function MemberRefundForm({
  slug,
  lang,
  kind,
  passId,
  preview,
}: {
  slug: string;
  lang: string;
  kind: "PACKAGE" | "MEMBERSHIP";
  passId: string;
  preview: PreviewData;
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

  const unit = t(kind === "PACKAGE" ? "refundUnitSession" : "refundUnitDay");
  const money = (n: number) => `₱${n.toLocaleString()}`;
  const rawHalf =
    (preview.paidPhp * preview.refundUnits) / preview.totalUnits / 2;
  const wasRounded = preview.refundPhp !== rawHalf;

  const nothing = preview.refundUnits <= 0;
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
      const r = await submitMemberRefund(slug, kind, passId, {
        method,
        bankName,
        bankAccount,
        accountHolder,
      });
      if (r.ok) {
        router.push(`/${lang}/g/${slug}/refunds`);
        router.refresh();
      } else {
        setError(t("refundError"));
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* 환불 내역 + 산정 방식 */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
          {t("refundBreakdownTitle")}
        </div>
        <div className="mt-2 text-lg font-semibold tracking-tight text-zinc-900">
          {preview.serviceName}
          {preview.trainerName && (
            <span className="ml-2 text-sm font-normal text-zinc-500">
              {t("refundTrainerLabel")}: {preview.trainerName}
            </span>
          )}
        </div>

        <dl className="mt-4 space-y-2 text-base">
          <Row label={t("refundPaidLabel")} value={money(preview.paidPhp)} />
          <Row
            label={t("refundLineTotal")}
            value={`${preview.totalUnits}${unit}`}
          />
          <Row
            label={t("refundLineCompleted")}
            value={`${preview.completedUnits}${unit}`}
          />
          {preview.todayUnits > 0 && (
            <Row
              label={t("refundLineToday")}
              value={`${preview.todayUnits}${unit}`}
            />
          )}
          <Row
            label={t("refundLineRefundable")}
            value={`${preview.refundUnits}${unit}`}
            strong
          />
        </dl>

        <div className="mt-4 border-t border-zinc-200 pt-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            {t("refundCalcLabel")}
          </div>
          <div className="mt-2 text-sm text-zinc-700">
            ({money(preview.paidPhp)} ÷ {preview.totalUnits}) ×{" "}
            {preview.refundUnits} × 50%
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-sm text-zinc-500">=</span>
            <span className="text-3xl font-bold tracking-tight text-emerald-700">
              {money(preview.refundPhp)}
            </span>
            {wasRounded && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                {t("refundRounded")}
              </span>
            )}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-zinc-500">
            {t("refundCalcNote")}
          </p>
        </div>
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

      {nothing ? (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-base text-amber-800">
          {t("refundNothing")}
        </section>
      ) : (
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
                  name: preview.memberName,
                  amount: money(preview.refundPhp),
                })}
              </span>
            </label>
          </section>

          {error && <div className="text-sm text-rose-700">{error}</div>}

          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit || pending}
            className="w-full rounded-xl bg-indigo-600 py-3.5 text-base font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40"
          >
            {pending ? t("refundSubmitting") : t("refundSubmit")}
          </button>
        </>
      )}
    </div>
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
    <div className="flex items-baseline justify-between gap-3">
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
