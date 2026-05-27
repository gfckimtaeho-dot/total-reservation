"use client";

import { useActionState, useState } from "react";
import {
  refundPayment,
  type RefundPaymentState,
} from "../actions";

type Props = {
  gymId: string;
  suggestedAmount: number;
};

const initial: RefundPaymentState = {};

export function RefundForm({ gymId, suggestedAmount }: Props) {
  const [state, action, pending] = useActionState<
    RefundPaymentState,
    FormData
  >(refundPayment, initial);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number>(suggestedAmount);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3 text-xs text-zinc-700 transition hover:border-ink"
      >
        환불 기록 추가
      </button>
    );
  }

  return (
    <form
      action={action}
      className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-5"
    >
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-900">
          환불 기록 (시스템은 기록만, 실제 입금은 매장 직접 처리)
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-amber-900/70 hover:text-amber-900"
        >
          닫기
        </button>
      </div>
      <p className="text-xs text-amber-900/80">
        남은 기간 50% 권장 금액 = <strong>{suggestedAmount.toLocaleString()}₩</strong>.
        실제 협의 금액으로 수정 가능.
      </p>
      <input type="hidden" name="gymId" value={gymId} />
      <input type="hidden" name="amountKrw" value={amount} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-amber-900">
            환불 금액 (₩)
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={amount.toLocaleString()}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9]/g, "");
              setAmount(raw === "" ? 0 : Number(raw));
            }}
            className="h-10 rounded-md border border-amber-300 bg-white px-3 text-right text-sm text-zinc-900 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
          {state.errors?.amountKrw && (
            <span className="text-xs text-rose-600">
              {state.errors.amountKrw.join(", ")}
            </span>
          )}
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-amber-900">환불 메모</span>
        <textarea
          name="memo"
          rows={2}
          required
          maxLength={500}
          placeholder="예) 사장 요청, 남은 60일 50% 환불 / BPI 송금 ref 123"
          className="rounded-md border border-amber-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200"
        />
        {state.errors?.memo && (
          <span className="text-xs text-rose-600">
            {state.errors.memo.join(", ")}
          </span>
        )}
      </label>

      {state.message && (
        <div className="text-xs text-rose-600">{state.message}</div>
      )}
      {state.ok && (
        <div className="text-xs text-emerald-800">
          환불 기록 추가됨. 결제 이력에 음수 row 로 노출.
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center rounded-md bg-amber-700 px-4 text-sm font-medium text-white transition hover:bg-amber-800 disabled:opacity-60"
      >
        {pending ? "기록 중..." : "환불 기록 추가"}
      </button>
    </form>
  );
}
