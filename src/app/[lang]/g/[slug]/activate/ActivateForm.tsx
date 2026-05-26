"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { activateAccount, type ActivateState } from "./actions";
import { normalizeLoginId, LOGIN_ID_PATTERN } from "@/lib/auth/normalize";

const initialState: ActivateState = {};

type AvailState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok" }
  | { kind: "taken" }
  | { kind: "invalid" };

export function ActivateForm({ slug, token }: { slug: string; token: string }) {
  const t = useTranslations("activate");
  const [state, formAction, pending] = useActionState(
    activateAccount,
    initialState,
  );

  const [loginIdRaw, setLoginIdRaw] = useState("");
  const loginId = normalizeLoginId(loginIdRaw);
  const [avail, setAvail] = useState<AvailState>({ kind: "idle" });

  // 디바운스 중복 검증. 형식 통과 시에만 API 호출.
  useEffect(() => {
    if (loginId.length === 0) {
      setAvail({ kind: "idle" });
      return;
    }
    if (!LOGIN_ID_PATTERN.test(loginId)) {
      setAvail({ kind: "invalid" });
      return;
    }
    setAvail({ kind: "checking" });
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/auth/check-login-id?slug=${encodeURIComponent(
            slug,
          )}&loginId=${encodeURIComponent(loginId)}`,
          { cache: "no-store", signal: ctrl.signal },
        );
        if (!res.ok) return;
        const j = (await res.json()) as { available: boolean };
        setAvail({ kind: j.available ? "ok" : "taken" });
      } catch {
        // 무시 (abort 또는 네트워크) — 사용자가 다시 타이핑하면 재시도
      }
    }, 300);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [loginId, slug]);

  const canSubmit =
    avail.kind === "ok" && !pending;

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="token" value={token} />

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800">
          {t("loginIdLabel")} <span className="text-rose-500">*</span>
        </span>
        <input
          type="text"
          name="loginId"
          value={loginIdRaw}
          onChange={(e) => setLoginIdRaw(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          minLength={3}
          maxLength={30}
          pattern="[a-zA-Z0-9_\-]{3,30}"
          className="h-11 rounded-md border border-amber-200/60 bg-white px-3 text-sm focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
        />
        <span className="text-xs text-zinc-500">{t("loginIdHint")}</span>
        {avail.kind === "checking" && (
          <span className="text-xs text-zinc-500">{t("loginIdChecking")}</span>
        )}
        {avail.kind === "invalid" && (
          <span className="text-xs text-rose-600">
            {t("loginIdInvalid")}
          </span>
        )}
        {avail.kind === "taken" && (
          <span className="text-xs text-rose-600">{t("loginIdTaken")}</span>
        )}
        {avail.kind === "ok" && (
          <span className="text-xs text-emerald-600">{t("loginIdOk")}</span>
        )}
        {state.errors?.loginId && (
          <span className="text-xs text-rose-600">
            {state.errors.loginId.join(", ")}
          </span>
        )}
      </label>

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
        disabled={!canSubmit}
        className="inline-flex h-12 w-full items-center justify-center rounded-md bg-ink px-6 text-sm font-medium text-white transition hover:bg-ink/90 disabled:opacity-60"
      >
        {pending ? t("submitting") : t("submit")}
      </button>

      <p className="text-xs leading-relaxed text-zinc-500">{t("pwaTip")}</p>
    </form>
  );
}
