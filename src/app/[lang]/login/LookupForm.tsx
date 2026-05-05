"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { unifiedLogin, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm({ initialEmail = "" }: { initialEmail?: string }) {
  const t = useTranslations("login.unified");
  const [state, formAction, pending] = useActionState(
    unifiedLogin,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800">
          {t("emailLabel")}
        </span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={initialEmail}
          required
          aria-invalid={Boolean(state.errors?.email)}
          onInvalid={(e) =>
            e.currentTarget.setCustomValidity(t("errors.email"))
          }
          onInput={(e) => e.currentTarget.setCustomValidity("")}
          className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder-zinc-400 transition focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
        />
        {state.errors?.email && (
          <span className="text-xs text-red-600">
            {state.errors.email.join(", ")}
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
