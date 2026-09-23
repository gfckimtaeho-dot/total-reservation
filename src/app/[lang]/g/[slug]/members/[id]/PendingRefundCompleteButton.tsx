"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { completeMemberPendingRefund } from "../actions";

// 수업 폐지 자동 환불(매장 귀책 100%, PENDING) — 카운터 지급 후 "환불 완료" 마감.
// /refunds 화면 폐기(2026-09-24)로 회원 상세 보유 상품 안에서 처리.
export function PendingRefundCompleteButton({
  slug,
  refundId,
}: {
  slug: string;
  refundId: string;
}) {
  const t = useTranslations("memberDetail");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    startTransition(async () => {
      const r = await completeMemberPendingRefund(slug, refundId);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? t("refundSubmitting") : t("refundCompleteBtn")}
      </button>
      {error && <span className="text-xs text-rose-700">{error}</span>}
    </span>
  );
}
