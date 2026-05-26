"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { gymLogin, type GymLoginState } from "./actions";

const initialState: GymLoginState = {};

export function GymLoginForm({
  slug,
  initialLoginId = "",
}: {
  slug: string;
  initialLoginId?: string;
}) {
  const t = useTranslations("login.gym");
  const [state, formAction, pending] = useActionState(gymLogin, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="slug" value={slug} />

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800">
          {t("loginIdLabel")}
        </span>
        <input
          name="loginId"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          defaultValue={initialLoginId}
          required
          aria-invalid={Boolean(state.errors?.loginId)}
          onInvalid={(e) =>
            e.currentTarget.setCustomValidity(t("errors.loginId"))
          }
          onInput={(e) => e.currentTarget.setCustomValidity("")}
          className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder-zinc-400 transition focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
        />
        {state.errors?.loginId && (
          <span className="text-xs text-red-600">
            {state.errors.loginId.join(", ")}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800">
          {t("passwordLabel")}
        </span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(state.errors?.password)}
          onInvalid={(e) =>
            e.currentTarget.setCustomValidity(t("errors.password"))
          }
          onInput={(e) => e.currentTarget.setCustomValidity("")}
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
        <span>{t("rememberMe")}</span>
      </label>

      {state.message && (
        <div
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {t(state.message)}
        </div>
      )}

      {state.debug && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 font-mono whitespace-pre-wrap break-all">
          <div className="font-semibold mb-1">[DEBUG — 임시 진단]</div>
          <div>입력 loginId bytes: {state.debug.rawLoginIdBytes}</div>
          <div>입력 loginId hex:   {state.debug.rawLoginIdHex}</div>
          <div>정규화 후 loginId:  {state.debug.normalizedLoginId}</div>
          <div>입력 slug bytes:    {state.debug.rawSlugBytes}</div>
          <div>입력 slug hex:      {state.debug.rawSlugHex}</div>
          <div>
            DB에 있는 비슷한 ID:{" "}
            {state.debug.similarLoginIds.length > 0
              ? state.debug.similarLoginIds.join(", ")
              : "(없음)"}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center rounded-md bg-ink px-8 text-sm font-medium text-white transition hover:bg-ink/90 disabled:opacity-60"
      >
        {pending ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
