"use client";

import { useActionState, useTransition, type ReactNode } from "react";
import {
  blockBusiness,
  unblockBusiness,
  type BlockState,
} from "../actions";

type Props = {
  businessId: string;
  vertical: "GYM" | "HOTEL";
  status: string;
  blockedReason: string | null;
  // 차단/재활성화 버튼 우측 액션 슬롯 (예: 비밀번호 재설정 메일 발송 버튼).
  passwordResetSlot?: ReactNode;
};

const blockInitial: BlockState = {};

export function BlockForm({
  businessId,
  vertical,
  status,
  blockedReason,
  passwordResetSlot,
}: Props) {
  const [state, blockAction, blockPending] = useActionState<
    BlockState,
    FormData
  >(blockBusiness, blockInitial);
  const [unblockPending, startUnblock] = useTransition();

  function unblock() {
    startUnblock(async () => {
      const fd = new FormData();
      fd.append("id", businessId);
      fd.append("vertical", vertical);
      await unblockBusiness(fd);
    });
  }

  if (status === "BLOCKED") {
    return (
      <div className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50 p-5">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-800">
          차단 상태
        </div>
        {blockedReason && (
          <div className="text-sm text-rose-900">
            사유: {blockedReason}
          </div>
        )}
        <p className="text-xs text-rose-800/80">
          재활성화 시 status 는 ACTIVE 로 복귀. 차단 사유 메모는 audit 차원으로 그대로 보존.
        </p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <button
            type="button"
            onClick={unblock}
            disabled={unblockPending}
            className="inline-flex h-10 items-center rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-ink/90 disabled:opacity-60"
          >
            {unblockPending ? "재활성화 중..." : "재활성화"}
          </button>
          {passwordResetSlot}
        </div>
      </div>
    );
  }

  return (
    <form
      action={blockAction}
      className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-5"
    >
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/60">
        매장 차단
      </div>
      <p className="text-xs text-zinc-600">
        차단 시 검색·예약·QR 출입이 모두 막힙니다. 사유는 audit 차원으로 영구 보존.
      </p>
      <input type="hidden" name="vertical" value={vertical} />
      <input type="hidden" name="id" value={businessId} />
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-zinc-800">차단 사유</span>
        <textarea
          name="reason"
          rows={3}
          required
          maxLength={500}
          placeholder="예) 결제 미확인 7일 초과 / 약관 위반 / 기타"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 transition focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
        />
        {state.errors?.reason && (
          <span className="text-xs text-rose-600">
            {state.errors.reason.join(", ")}
          </span>
        )}
      </label>
      {state.message && (
        <div className="text-xs text-rose-600">{state.message}</div>
      )}
      {state.ok && (
        <div className="text-xs text-emerald-700">차단 완료.</div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button
          type="submit"
          disabled={blockPending}
          className="inline-flex h-10 items-center rounded-md bg-rose-600 px-4 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-60"
        >
          {blockPending ? "차단 중..." : "차단"}
        </button>
        {passwordResetSlot}
      </div>
    </form>
  );
}
