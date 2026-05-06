"use client";

import { useActionState } from "react";
import { activateAccount, type ActivateState } from "./actions";

const initialState: ActivateState = {};

export function ActivateForm({ slug, token }: { slug: string; token: string }) {
  const [state, formAction, pending] = useActionState(
    activateAccount,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="token" value={token} />

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800">
          비밀번호 <span className="text-rose-500">*</span>
        </span>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          className="h-11 rounded-md border border-amber-200/60 bg-white px-3 text-sm focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
        />
        <span className="text-xs text-zinc-500">6자 이상</span>
        {state.errors?.password && (
          <span className="text-xs text-rose-600">
            {state.errors.password.join(", ")}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800">
          비밀번호 확인 <span className="text-rose-500">*</span>
        </span>
        <input
          type="password"
          name="passwordConfirm"
          autoComplete="new-password"
          required
          className="h-11 rounded-md border border-amber-200/60 bg-white px-3 text-sm focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
        />
        {state.errors?.passwordConfirm && (
          <span className="text-xs text-rose-600">
            {state.errors.passwordConfirm.join(", ")}
          </span>
        )}
      </label>

      {state.message && (
        <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.message}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center rounded-md bg-ink px-6 text-sm font-medium text-white transition hover:bg-ink/90 disabled:opacity-60"
      >
        {pending ? "활성화 중..." : "비밀번호 설정 + 로그인"}
      </button>

      <p className="text-xs leading-relaxed text-zinc-500">
        📌 폰 브라우저 메뉴에서 <strong>"홈 화면에 추가"</strong>를 누르면 앱처럼 사용할 수 있습니다.
      </p>
    </form>
  );
}
