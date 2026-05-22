"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { submitRefundRequest, type RefundPreview } from "../refund-actions";

type PreviewData = Extract<RefundPreview, { ok: true }>;
type Method = "BANK_TRANSFER" | "IN_PERSON";

// 환불 신청 폼 — 내역 + 산식 확인 + 수령방법 + "동의" 입력 후 제출.
export function RefundFlow({
  slug,
  lang,
  kind,
  id,
  preview,
}: {
  slug: string;
  lang: string;
  kind: "PACKAGE" | "MEMBERSHIP";
  id: string;
  preview: PreviewData;
}) {
  const t = useTranslations("me");
  const router = useRouter();
  const [method, setMethod] = useState<Method | null>(null);
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [agree, setAgree] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const unit = t(
    kind === "PACKAGE" ? "refundUnitSession" : "refundUnitDay",
  );
  const agreeWord = t("refundAgreeWord");
  const money = (n: number) => `₱${n.toLocaleString()}`;
  // 올림으로 금액이 올라갔는지 — 산식 표시에 "올림" 표기.
  const rawHalf =
    (preview.paidPhp * preview.refundUnits) / preview.totalUnits / 2;
  const wasRounded = preview.refundPhp !== rawHalf;

  const nothing = preview.refundUnits <= 0;
  const bankOk =
    method === "IN_PERSON" ||
    (method === "BANK_TRANSFER" &&
      bankName.trim() !== "" &&
      bankAccount.trim() !== "" &&
      accountHolder.trim() !== "");
  const canSubmit =
    !nothing && method !== null && bankOk && agree.trim() === agreeWord;

  function submit() {
    if (!canSubmit || method === null) return;
    setError(null);
    startTransition(async () => {
      const r = await submitRefundRequest(slug, kind, id, {
        method,
        bankName,
        bankAccount,
        accountHolder,
      });
      if (r.ok) {
        router.push(`/${lang}/g/${slug}/me/holdings`);
        router.refresh();
      } else {
        setError(t("refundError"));
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* 환불 내역 + 산정 방식 */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-200/90">
          {t("refundBreakdownTitle")}
        </div>
        <div className="mt-2 font-heading text-base tracking-tight text-white">
          {preview.serviceName}
        </div>

        <dl className="mt-3 space-y-1.5 text-sm">
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

        {/* 산정 방식 — 환불 금액이 어떻게 나왔는지 산식으로 */}
        <div className="mt-3 border-t border-white/10 pt-3">
          <div className="text-[11px] font-semibold text-zinc-300">
            {t("refundCalcLabel")}
          </div>
          <div className="mt-1.5 text-xs leading-relaxed text-zinc-300">
            ({money(preview.paidPhp)} ÷ {preview.totalUnits}) ×{" "}
            {preview.refundUnits} × 50%
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xs text-zinc-500">=</span>
            <span className="font-heading text-xl tracking-tight text-emerald-300">
              {money(preview.refundPhp)}
            </span>
            {wasRounded && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-zinc-400">
                {t("refundRounded")}
              </span>
            )}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
            {t("refundCalcNote")}
          </p>
        </div>
      </section>

      {nothing ? (
        <section className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-5 text-sm text-amber-100">
          {t("refundNothing")}
        </section>
      ) : (
        <>
          {/* 수령 방법 */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-200/90">
              {t("refundPayoutTitle")}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MethodButton
                active={method === "BANK_TRANSFER"}
                onClick={() => setMethod("BANK_TRANSFER")}
                label={t("refundMethodBank")}
              />
              <MethodButton
                active={method === "IN_PERSON"}
                onClick={() => setMethod("IN_PERSON")}
                label={t("refundMethodInPerson")}
              />
            </div>
            {method === "BANK_TRANSFER" && (
              <div className="mt-3 space-y-2">
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

          {/* 환불 신청 동의 — 권 이름·환불 금액 명시 + 동의 입력 */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-200/90">
              {t("refundAgreeTitle")}
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-white">
                {preview.serviceName}
              </span>
              <span className="font-heading text-lg tracking-tight text-emerald-300">
                {money(preview.refundPhp)}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-300">
              {t("refundAgreeBody", {
                name: preview.serviceName,
                word: agreeWord,
              })}
            </p>
            <input
              type="text"
              value={agree}
              onChange={(e) => setAgree(e.target.value)}
              placeholder={agreeWord}
              className="mt-3 w-full rounded-lg border border-white/15 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-rose-300/50"
            />
          </section>

          {error && <div className="text-xs text-rose-400">{error}</div>}

          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit || pending}
            className="w-full rounded-full bg-gradient-to-r from-orange-500 to-pink-500 py-3 text-sm font-semibold text-white shadow-[0_4px_18px_-6px_rgba(251,146,60,0.6)] hover:brightness-110 disabled:opacity-40"
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
      <dt className="text-zinc-400">{label}</dt>
      <dd
        className={
          "tabular-nums " +
          (strong ? "font-semibold text-white" : "text-zinc-200")
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
        "rounded-xl border px-3 py-3 text-sm font-medium transition " +
        (active
          ? "border-rose-300/60 bg-rose-300/10 text-white"
          : "border-white/15 bg-white/5 text-zinc-300 hover:bg-white/10")
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
      <span className="text-[11px] text-zinc-400">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-white/15 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-rose-300/50"
      />
    </label>
  );
}
