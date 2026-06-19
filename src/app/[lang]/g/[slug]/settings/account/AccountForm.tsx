"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  updateMyBasic,
  changeMyPassword,
  type UpdateBasicState,
  type ChangePasswordState,
} from "./actions";

type Initial = {
  name: string;
  loginId: string;
  email: string;
  phone: string;
  locale: "en" | "ko";
};

export function AccountForm({
  slug,
  initial,
}: {
  slug: string;
  initial: Initial;
}) {
  const t = useTranslations("settings.account");

  // ─── Basic info form ───
  const [basicState, basicAction, basicPending] = useActionState(
    updateMyBasic,
    {} as UpdateBasicState,
  );
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [locale, setLocale] = useState<"en" | "ko">(initial.locale);

  // 저장 완료 시 toast 효과 (3초 후 success flag clear). 성공 시 즉시 표시 +
  // 재저장 시 재표시를 위해 effect 안 동기 setState 가 필요한 의도된 패턴.
  const [basicSavedFlash, setBasicSavedFlash] = useState(false);
  useEffect(() => {
    if (basicState.success) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 저장 성공 토스트(의도된 동기 set)
      setBasicSavedFlash(true);
      const tm = setTimeout(() => setBasicSavedFlash(false), 3000);
      return () => clearTimeout(tm);
    }
  }, [basicState.success]);

  // ─── Password form ───
  const [pwState, pwAction, pwPending] = useActionState(
    changeMyPassword,
    {} as ChangePasswordState,
  );
  const [pwSavedFlash, setPwSavedFlash] = useState(false);
  useEffect(() => {
    if (pwState.success) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 비번 변경 성공 토스트(의도된 동기 set)
      setPwSavedFlash(true);
      const tm = setTimeout(() => setPwSavedFlash(false), 3000);
      return () => clearTimeout(tm);
    }
  }, [pwState.success]);

  return (
    <div className="space-y-8">
      {/* Basic info */}
      <form action={basicAction} className="space-y-5">
        <input type="hidden" name="slug" value={slug} />

        <h2 className="text-xl font-semibold tracking-tight text-zinc-900">
          {t("sectionBasic")}
        </h2>

        {/* 이름·아이디는 read-only 표시 (self-service 변경 금지) */}
        <dl className="grid grid-cols-1 gap-4 rounded-md border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
              {t("fName")}
            </dt>
            <dd className="mt-1 text-sm font-medium text-zinc-900">
              {initial.name}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
              {t("fLoginId")}
            </dt>
            <dd className="mt-1 text-sm font-medium text-zinc-900">
              {initial.loginId}
            </dd>
          </div>
        </dl>

        <Field
          label={t("fEmail")}
          name="email"
          type="email"
          value={email}
          onChange={setEmail}
          hint={t("fEmailHint")}
          errors={basicState.errors?.email}
        />

        <Field
          label={t("fPhone")}
          name="phone"
          value={phone}
          onChange={setPhone}
          errors={basicState.errors?.phone}
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-800">
            {t("fLanguage")} <span className="text-rose-500">*</span>
          </span>
          <div className="grid grid-cols-2 gap-2">
            {(["en", "ko"] as const).map((lc) => (
              <label
                key={lc}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm transition has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50"
              >
                <input
                  type="radio"
                  name="locale"
                  value={lc}
                  checked={locale === lc}
                  onChange={() => setLocale(lc)}
                  required
                  className="h-4 w-4 accent-indigo-600"
                />
                {lc === "en" ? t("langEnglish") : t("langKorean")}
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={basicPending}
            className="inline-flex h-11 items-center justify-center rounded-md bg-indigo-600 px-5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {basicPending ? t("savingBasic") : t("saveBasic")}
          </button>
          {basicSavedFlash && (
            <span className="text-sm text-emerald-600">{t("savedBasic")}</span>
          )}
          {basicState.message && !basicState.success && (
            <span className="text-sm text-rose-600">{basicState.message}</span>
          )}
        </div>
      </form>

      <hr className="border-zinc-200" />

      {/* Password change */}
      <form action={pwAction} className="space-y-5">
        <input type="hidden" name="slug" value={slug} />

        <h2 className="text-xl font-semibold tracking-tight text-zinc-900">
          {t("sectionPassword")}
        </h2>

        <PasswordField
          label={t("fCurrentPw")}
          name="currentPassword"
          required
          errors={pwState.errors?.currentPassword?.map((k) =>
            k === "errCurrentPw" ? t("errCurrentPw") : k,
          )}
        />
        <PasswordField
          label={t("fNewPw")}
          name="newPassword"
          required
          minLength={6}
          hint={t("fNewPwHint")}
          errors={pwState.errors?.newPassword}
        />
        <PasswordField
          label={t("fNewPwConfirm")}
          name="newPasswordConfirm"
          required
          errors={pwState.errors?.newPasswordConfirm?.map((k) =>
            k === "errNewPwConfirm" ? t("errNewPwConfirm") : k,
          )}
        />

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={pwPending}
            className="inline-flex h-11 items-center justify-center rounded-md bg-indigo-600 px-5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {pwPending ? t("savingPassword") : t("savePassword")}
          </button>
          {pwSavedFlash && (
            <span className="text-sm text-emerald-600">
              {t("savedPassword")}
            </span>
          )}
          {pwState.message && !pwState.success && (
            <span className="text-sm text-rose-600">{pwState.message}</span>
          )}
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  value,
  onChange,
  required,
  hint,
  errors,
}: {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  hint?: string;
  errors?: string[];
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-800">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </span>
      <input
        type={type}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
      />
      {hint && !errors && <span className="text-xs text-zinc-500">{hint}</span>}
      {errors && (
        <span className="text-xs text-rose-600">{errors.join(", ")}</span>
      )}
    </label>
  );
}

function PasswordField({
  label,
  name,
  required,
  minLength,
  hint,
  errors,
}: {
  label: string;
  name: string;
  required?: boolean;
  minLength?: number;
  hint?: string;
  errors?: string[];
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-800">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </span>
      <input
        type="password"
        name={name}
        autoComplete="new-password"
        required={required}
        minLength={minLength}
        className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
      />
      {hint && !errors && <span className="text-xs text-zinc-500">{hint}</span>}
      {errors && (
        <span className="text-xs text-rose-600">{errors.join(", ")}</span>
      )}
    </label>
  );
}
