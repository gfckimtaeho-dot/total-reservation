"use client";

import { useActionState } from "react";
import { adminLogin, type AdminLoginState } from "./actions";

const initialState: AdminLoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(adminLogin, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800">이메일</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(state.errors?.email)}
          className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder-zinc-400 transition focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
        />
        {state.errors?.email && (
          <span className="text-xs text-red-600">
            {state.errors.email.join(", ")}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800">비밀번호</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(state.errors?.password)}
          className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder-zinc-400 transition focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
        />
        {state.errors?.password && (
          <span className="text-xs text-red-600">
            {state.errors.password.join(", ")}
          </span>
        )}
      </label>

      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input
          name="rememberMe"
          type="checkbox"
          className="h-4 w-4 rounded border-zinc-300 text-ink focus:ring-ink"
        />
        <span>로그인 유지 (90일)</span>
      </label>

      {state.message && (
        <div
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {state.message}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center rounded-md bg-ink px-8 text-sm font-medium text-white transition hover:bg-ink/90 disabled:opacity-60"
      >
        {pending ? "로그인 중..." : "관리자 로그인"}
      </button>
    </form>
  );
}
