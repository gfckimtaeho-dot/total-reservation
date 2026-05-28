"use client";

import { useActionState, useState } from "react";
import {
  recordPayment,
  type RecordPaymentState,
} from "../actions";
import {
  DEFAULT_YEARS,
  MONTHLY_PRICE_KRW,
  YEAR_OPTIONS,
  priceForYears,
} from "@/lib/subscription/plans";

type Props = {
  gymId: string;
  vertical: "GYM" | "HOTEL";
  lang: string;
  defaultPaidAtIso: string;
};

const initial: RecordPaymentState = {};

export function PaymentForm({ gymId, vertical, lang, defaultPaidAtIso }: Props) {
  const [state, action, pending] = useActionState<
    RecordPaymentState,
    FormData
  >(recordPayment, initial);

  const [years, setYears] = useState<number>(DEFAULT_YEARS);
  const [amount, setAmount] = useState<number>(priceForYears(DEFAULT_YEARS));

  function pickYears(next: number) {
    setYears(next);
    setAmount(priceForYears(next));
  }

  return (
    <form
      action={action}
      className="space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/60">
          결제 등록 (현금·송금 확인 후 수동 입력)
        </div>
        <div className="text-xs text-zinc-500">
          월 {MONTHLY_PRICE_KRW.toLocaleString()}₩
        </div>
      </div>
      <input type="hidden" name="vertical" value={vertical} />
      <input type="hidden" name="gymId" value={gymId} />
      <input type="hidden" name="years" value={years} />
      <input type="hidden" name="amountKrw" value={amount} />

      <div className="space-y-1.5">
        <div className="text-xs font-medium text-zinc-800">년수</div>
        <div className="flex flex-wrap gap-2">
          {YEAR_OPTIONS.map((y) => {
            const active = years === y;
            return (
              <button
                key={y}
                type="button"
                onClick={() => pickYears(y)}
                className={`inline-flex h-10 min-w-[64px] items-center justify-center rounded-md px-3 text-sm font-medium transition ${
                  active
                    ? "bg-ink text-white"
                    : "bg-white text-zinc-800 ring-1 ring-zinc-300 hover:ring-ink"
                }`}
              >
                {y}년
              </button>
            );
          })}
        </div>
        {state.errors?.years && (
          <span className="text-xs text-rose-600">
            {state.errors.years.join(", ")}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-800">금액 (₩)</span>
          <input
            type="text"
            inputMode="numeric"
            value={amount.toLocaleString()}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9]/g, "");
              setAmount(raw === "" ? 0 : Number(raw));
            }}
            className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-right text-sm text-zinc-900 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
          />
          <span className="text-[10px] text-zinc-500">
            기본값 = {priceForYears(years).toLocaleString()}₩ ({years}년 × 월 {MONTHLY_PRICE_KRW.toLocaleString()}₩)
          </span>
          {state.errors?.amountKrw && (
            <span className="text-xs text-rose-600">
              {state.errors.amountKrw.join(", ")}
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-800">입금 일자</span>
          <input
            type="date"
            name="paidAt"
            defaultValue={defaultPaidAtIso}
            lang={lang}
            className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
          />
          {state.errors?.paidAt && (
            <span className="text-xs text-rose-600">
              {state.errors.paidAt.join(", ")}
            </span>
          )}
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-zinc-800">
          메모 (송금 방법·번호 등)
        </span>
        <textarea
          name="memo"
          rows={2}
          maxLength={500}
          placeholder="예) 카카오뱅크 ref 123-456 / 토스 송금"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
        />
      </label>

      {state.message && (
        <div className="text-xs text-rose-600">{state.message}</div>
      )}
      {state.ok && (
        <div className="text-xs text-emerald-700">
          결제 등록 완료. 구독이 {years}년 연장되고 매장이 ACTIVE 로 복귀합니다.
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-ink/90 disabled:opacity-60"
      >
        {pending ? "등록 중..." : `결제 등록 + 구독 ${years}년 연장`}
      </button>
    </form>
  );
}
