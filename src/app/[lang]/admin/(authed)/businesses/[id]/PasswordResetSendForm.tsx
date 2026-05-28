"use client";

import { useState, useTransition } from "react";
import {
  sendOwnerPasswordReset,
  type PasswordResetSendResult,
} from "../actions";

type Props = {
  businessId: string;
  vertical: "GYM" | "HOTEL";
  ownerName: string | null;
  ownerEmail: string | null;
  storeName: string;
};

export function PasswordResetSendForm({
  businessId,
  vertical,
  ownerName,
  ownerEmail,
  storeName,
}: Props) {
  const [pending, start] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<PasswordResetSendResult | null>(null);

  const disabledReason: string | null = !ownerEmail
    ? "사장 이메일 미등록"
    : null;

  function trigger() {
    setResult(null);
    setConfirmOpen(false);
    start(async () => {
      const fd = new FormData();
      fd.set("vertical", vertical);
      fd.set("id", businessId);
      const r = await sendOwnerPasswordReset(fd);
      setResult(r);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={pending || disabledReason !== null}
        title={disabledReason ?? undefined}
        className="inline-flex h-10 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 transition hover:border-ink hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "발송 중..." : "비밀번호 재설정 메일"}
      </button>
      {result?.ok && (
        <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
          발송됨 - {result.emailedTo}
        </span>
      )}
      {result && !result.ok && (
        <span className="rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
          {result.message}
        </span>
      )}

      {confirmOpen && (
        <div
          role="dialog"
          aria-modal
          className="fixed inset-0 z-50 grid place-items-center bg-zinc-900/50 px-4"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-ink">
              비밀번호 재설정 메일 발송
            </h3>
            <dl className="mt-3 space-y-1 text-sm text-zinc-700">
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">매장</dt>
                <dd className="text-right">{storeName}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">사장</dt>
                <dd className="text-right">{ownerName ?? "-"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">받는 메일</dt>
                <dd className="truncate text-right font-mono text-xs">
                  {ownerEmail ?? "-"}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-zinc-600">
              사장 메일로 1회용 재설정 링크가 발송됩니다. 링크는 7일간 유효
              하며, 사용 즉시 기존 다른 링크는 모두 무효화됩니다. 발송 후 10
              분간 재발송이 제한됩니다.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:border-ink hover:bg-zinc-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={trigger}
                className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/90"
              >
                발송
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
