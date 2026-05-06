"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { activateAccount, type ActivateState } from "./actions";

const initialState: ActivateState = {};

export function ActivateForm({ slug, token }: { slug: string; token: string }) {
  const t = useTranslations("activate");
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
          {t("passwordLabel")} <span className="text-rose-500">*</span>
        </span>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          className="h-11 rounded-md border border-amber-200/60 bg-white px-3 text-sm focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
        />
        <span className="text-xs text-zinc-500">{t("passwordHint")}</span>
        {state.errors?.password && (
          <span className="text-xs text-rose-600">
            {state.errors.password.join(", ")}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800">
          {t("passwordConfirmLabel")} <span className="text-rose-500">*</span>
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
        {pending ? t("submitting") : t("submit")}
      </button>

      <p className="text-xs leading-relaxed text-zinc-500">{t("pwaTip")}</p>
    </form>
  );
}
