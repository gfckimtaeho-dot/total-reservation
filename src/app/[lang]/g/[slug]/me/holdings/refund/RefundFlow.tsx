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
      <section className="rounded-3xl border border-orange-200/60 bg-white/90 p-5 backdrop-blur">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-600">
          {t("refundBreakdownTitle")}
        </div>
        <div className="mt-2 font-heading text-base font-bold tracking-tight text-zinc-900">
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

        <div className="mt-3 border-t border-orange-100 pt-3">
          <div className="text-[11px] font-semibold text-zinc-700">
            {t("refundCalcLabel")}
          </div>
          <div className="mt-1.5 text-xs leading-relaxed text-zinc-700">
            ({money(preview.paidPhp)} ÷ {preview.totalUnits}) ×{" "}
            {preview.refundUnits} × 50%
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xs text-zinc-500">=</span>
            <span className="font-heading text-xl font-bold tracking-tight text-emerald-700">
              {money(preview.refundPhp)}
            </span>
            {wasRounded && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600">
                {t("refundRounded")}
              </span>
            )}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
            {t("refundCalcNote")}
          </p>
        </div>
      </section>

      {/* 정가 기준 50% 안내 — 회원 분쟁 방지용 명시 강조 박스(rose tone). */}
      <section className="rounded-3xl border-2 border-rose-300 bg-rose-50/80 p-5 shadow-[0_15px_40px_-20px_rgba(244,63,94,0.35)] backdrop-blur">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-700">
          {t("refundPriceBaseTitle")}
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-rose-900">
          {t("refundPriceBaseBody")}
        </p>
      </section>

      {nothing ? (
        <section className="rounded-3xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-800">
          {t("refundNothing")}
        </section>
      ) : (
        <>
          <section className="rounded-3xl border border-orange-200/60 bg-white/90 p-5 backdrop-blur">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-600">
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

          <section className="rounded-3xl border border-orange-200/60 bg-white/90 p-5 backdrop-blur">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-600">
              {t("refundAgreeTitle")}
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-zinc-900">
                {preview.serviceName}
              </span>
              <span className="font-heading text-lg font-bold tracking-tight text-emerald-700">
                {money(preview.refundPhp)}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-700">
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
              className="mt-3 w-full rounded-lg border border-orange-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-orange-400"
            />
          </section>

          {error && <div className="text-xs text-rose-700">{error}</div>}

          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit || pending}
            className="w-full rounded-full bg-gradient-to-r from-orange-500 to-rose-500 py-3 text-sm font-semibold text-white shadow-[0_15px_40px_-15px_rgba(249,115,22,0.55)] hover:brightness-110 disabled:opacity-40"
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
        "rounded-xl border px-3 py-3 text-sm font-medium transition " +
        (active
          ? "border-orange-400 bg-orange-50 text-zinc-900"
          : "border-orange-200 bg-white text-zinc-700 hover:bg-orange-50")
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
      <span className="text-[11px] text-zinc-500">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-orange-400"
      />
    </label>
  );
}
