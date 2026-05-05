"use client";

import {
  type FormEvent,
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslations } from "next-intl";
import { checkSlug, registerBusiness, type RegisterState } from "./actions";

const initialState: RegisterState = {};

export type CityWithBarangays = {
  id: string;
  name: string;
  barangays: { id: string; name: string }[];
};

export function RegisterForm({
  token,
  cities,
}: {
  token: string;
  cities: CityWithBarangays[];
}) {
  const t = useTranslations("register.form");
  const [state, formAction, pending] = useActionState(
    registerBusiness,
    initialState,
  );
  const [cityId, setCityId] = useState("");
  const [category, setCategory] = useState<"GYM" | "MASSAGE">("GYM");
  const formRef = useRef<HTMLFormElement>(null);
  const barangays = useMemo(
    () => cities.find((c) => c.id === cityId)?.barangays ?? [],
    [cities, cityId],
  );

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    const pw = form.elements.namedItem("ownerPassword") as HTMLInputElement;
    const pw2 = form.elements.namedItem(
      "ownerPasswordConfirm",
    ) as HTMLInputElement;
    if (pw.value !== pw2.value) {
      pw2.setCustomValidity(t("errors.ownerPasswordConfirm"));
      pw2.reportValidity();
      e.preventDefault();
    }
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      className="space-y-14"
      noValidate={false}
    >
      <input type="hidden" name="token" value={token} />

      <section>
        <h2 className="font-heading mb-6 text-2xl tracking-tight text-ink">
          {t("sectionStore")}
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            label={t("storeName")}
            name="storeName"
            placeholder={t("storeNamePlaceholder")}
            required
            errorMessage={t("errors.storeName")}
            errors={state.errors?.storeName}
          />
          <SlugField errors={state.errors?.slug} />
          <Field
            label={t("storePhone")}
            name="storePhone"
            placeholder={t("storePhonePlaceholder")}
            required
            errorMessage={t("errors.storePhone")}
            errors={state.errors?.storePhone}
          />
          <Select
            label={t("category")}
            name="category"
            placeholder={t("selectCategory")}
            value={category}
            onValueChange={(v) => setCategory(v as "GYM" | "MASSAGE")}
            options={[
              { value: "GYM", label: t("categoryGym") },
              { value: "MASSAGE", label: t("categoryMassage") },
            ]}
            required
            errorMessage={t("errors.category")}
            errors={state.errors?.category}
          />
          <Select
            label={t("city")}
            name="cityId"
            placeholder={t("selectCity")}
            value={cityId}
            onValueChange={setCityId}
            options={cities.map((c) => ({ value: c.id, label: c.name }))}
            required
            errorMessage={t("errors.city")}
            errors={state.errors?.cityId}
          />
          <Select
            label={t("barangay")}
            name="barangayId"
            placeholder={t("selectBarangay")}
            options={barangays.map((b) => ({ value: b.id, label: b.name }))}
            disabled={!cityId}
            required
            errorMessage={t("errors.barangay")}
            errors={state.errors?.barangayId}
          />
        </div>
      </section>

      <section>
        <h2 className="font-heading mb-6 text-2xl tracking-tight text-ink">
          {t("sectionOwner")}
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            label={t("ownerName")}
            name="ownerName"
            required
            errorMessage={t("errors.ownerName")}
            errors={state.errors?.ownerName}
          />
          <Field
            label={t("ownerEmail")}
            name="ownerEmail"
            type="email"
            required
            errorMessage={t("errors.ownerEmail")}
            errors={state.errors?.ownerEmail}
          />
          <Field
            label={t("ownerPhone")}
            name="ownerPhone"
            placeholder={t("phonePlaceholder")}
            required
            errorMessage={t("errors.ownerPhone")}
            errors={state.errors?.ownerPhone}
          />
          <div className="hidden sm:block" />
          <Field
            label={t("ownerPassword")}
            name="ownerPassword"
            type="password"
            hint={t("passwordHint")}
            required
            minLength={6}
            errorMessage={t("errors.ownerPassword")}
            errors={state.errors?.ownerPassword}
          />
          <Field
            label={t("ownerPasswordConfirm")}
            name="ownerPasswordConfirm"
            type="password"
            required
            errorMessage={t("errors.ownerPasswordConfirm")}
            errors={state.errors?.ownerPasswordConfirm}
          />
        </div>
      </section>

      {state.message && (
        <div
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {state.message}
        </div>
      )}

      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-12 items-center justify-center rounded-md bg-ink px-8 text-sm font-medium text-white transition hover:bg-ink/90 disabled:opacity-60"
        >
          {pending ? t("submitting") : t("submit")}
        </button>
      </div>
    </form>
  );
}

type SlugStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available" }
  | { kind: "unavailable"; reason: "format" | "reserved" | "taken" };

function SlugField({ errors }: { errors?: string[] }) {
  const t = useTranslations("register.form");
  const tStatus = useTranslations("register.form.slugStatus");
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<SlugStatus>({ kind: "idle" });

  useEffect(() => {
    if (!value) {
      setStatus({ kind: "idle" });
      return;
    }
    let cancelled = false;
    setStatus({ kind: "checking" });
    const timer = setTimeout(async () => {
      const result = await checkSlug(value);
      if (cancelled) return;
      setStatus(
        result.available
          ? { kind: "available" }
          : { kind: "unavailable", reason: result.reason },
      );
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value]);

  let statusText: string | null = null;
  let tone = "text-zinc-500";
  if (status.kind === "checking") {
    statusText = tStatus("checking");
  } else if (status.kind === "available") {
    statusText = tStatus("available");
    tone = "text-emerald-700";
  } else if (status.kind === "unavailable") {
    statusText = tStatus(status.reason);
    tone = "text-rose-600";
  }

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-800">
        {t("slug")}
        <span className="ml-0.5 text-rose-600">*</span>
      </span>
      <input
        name="slug"
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          e.currentTarget.setCustomValidity("");
        }}
        placeholder={t("slugPlaceholder")}
        required
        minLength={2}
        maxLength={40}
        pattern="^[a-z0-9]+(-[a-z0-9]+)*$"
        aria-invalid={Boolean(errors) || status.kind === "unavailable"}
        aria-required
        onInvalid={(e) => {
          e.currentTarget.setCustomValidity(t("errors.slug"));
        }}
        className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder-zinc-400 transition focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
      />
      {statusText ? (
        <span className={`text-xs ${tone}`}>{statusText}</span>
      ) : (
        <span className="text-xs text-zinc-500">{t("slugHint")}</span>
      )}
      {errors && (
        <span className="text-xs text-red-600">{errors.join(", ")}</span>
      )}
    </label>
  );
}

type FieldProps = {
  label: string;
  name: string;
  placeholder?: string;
  hint?: string;
  type?: string;
  required?: boolean;
  minLength?: number;
  pattern?: string;
  errorMessage: string;
  errors?: string[];
};

function Field({
  label,
  name,
  placeholder,
  hint,
  type = "text",
  required,
  minLength,
  pattern,
  errorMessage,
  errors,
}: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-800">
        {label}
        {required && <span className="ml-0.5 text-rose-600">*</span>}
      </span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        pattern={pattern}
        aria-invalid={Boolean(errors)}
        aria-required={required}
        onInvalid={(e) => {
          e.currentTarget.setCustomValidity(errorMessage);
        }}
        onInput={(e) => {
          e.currentTarget.setCustomValidity("");
        }}
        className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder-zinc-400 transition focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
      />
      {hint && !errors && (
        <span className="text-xs text-zinc-500">{hint}</span>
      )}
      {errors && <span className="text-xs text-red-600">{errors.join(", ")}</span>}
    </label>
  );
}

type SelectProps = {
  label: string;
  name: string;
  placeholder: string;
  value?: string;
  onValueChange?: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  required?: boolean;
  errorMessage: string;
  errors?: string[];
};

function Select({
  label,
  name,
  placeholder,
  value,
  onValueChange,
  options,
  disabled,
  required,
  errorMessage,
  errors,
}: SelectProps) {
  const controlled = value !== undefined;
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-800">
        {label}
        {required && <span className="ml-0.5 text-rose-600">*</span>}
      </span>
      <select
        name={name}
        {...(controlled
          ? { value, onChange: (e) => onValueChange?.(e.target.value) }
          : { defaultValue: "" })}
        disabled={disabled}
        required={required}
        aria-invalid={Boolean(errors)}
        aria-required={required}
        onInvalid={(e) => {
          e.currentTarget.setCustomValidity(errorMessage);
        }}
        onChange={(e) => {
          e.currentTarget.setCustomValidity("");
          if (controlled) onValueChange?.(e.target.value);
        }}
        className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 transition focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20 disabled:bg-zinc-50 disabled:text-zinc-400"
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {errors && <span className="text-xs text-red-600">{errors.join(", ")}</span>}
    </label>
  );
}
