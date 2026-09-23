"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateMemberRefundRate, type SavePriceState } from "./actions";

// 회원 변심 환불 비율(%) 입력 + 저장. 0~100 정수. 매장 귀책 환불(100%)엔 영향 없음.
export function MemberRefundRateForm({
  slug,
  current,
}: {
  slug: string;
  current: number;
}) {
  const t = useTranslations("settings");
  const [state, formAction, pending] = useActionState<SavePriceState, FormData>(
    updateMemberRefundRate.bind(null, slug),
    { status: "idle" },
  );

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          type="number"
          name="rate"
          min={0}
          max={100}
          step={1}
          inputMode="numeric"
          required
          defaultValue={current}
          className="w-28 rounded-md border border-zinc-300 px-3 py-2 text-sm tabular-nums focus:border-indigo-500 focus:outline-none"
        />
        <span className="text-sm text-zinc-500">%</span>
        <span className="ml-2 text-xs text-zinc-500">{t("refundRate.unit")}</span>
        <button
          type="submit"
          disabled={pending}
          className="ml-2 rounded-md bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {pending ? t("refundRate.saving") : t("refundRate.save")}
        </button>
      </div>
      <p className="text-xs text-zinc-500">
        {t("refundRate.example", {
          rate: current,
          amount: Math.ceil((10 * 500 * current) / 100).toLocaleString(),
        })}
      </p>

      {state.status === "saved" && (
        <p className="text-xs text-emerald-600">{t("refundRate.saved")}</p>
      )}
      {state.status === "error" && (
        <p className="text-xs text-rose-600">
          {t(`refundRate.err_${state.message}`)}
        </p>
      )}
    </form>
  );
}
