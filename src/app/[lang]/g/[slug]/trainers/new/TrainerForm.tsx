"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createTrainer, type CreateTrainerState } from "../actions";
import { PhotoUploader } from "./PhotoUploader";
import { DobPicker } from "../../members/DobPicker";

type Tone = "normal" | "black" | "white";
type Specialty = "HEALTH" | "YOGA" | "PILATES" | "DANCE";
type Weekday = "SUN" | "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";

const ALL_SPEC: Specialty[] = ["HEALTH", "YOGA", "PILATES", "DANCE"];
const ALL_WEEKDAYS: Weekday[] = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
];

const TONE = {
  normal: {
    section: "rounded-2xl bg-white ring-1 ring-amber-200/60 p-6",
    sectionLabel: "text-ink/70",
    sectionTitle: "text-ink",
    field: "border-amber-200/60 bg-white text-ink focus:border-ink focus:ring-ink/20",
    text: "text-ink",
    subtext: "text-zinc-600",
    pillActive: "bg-band/40 text-ink ring-1 ring-ink",
    pillInactive: "bg-white text-zinc-600 ring-1 ring-amber-200/60 hover:ring-ink/40",
    submit: "bg-ink text-white hover:bg-ink/90",
    cancel: "border border-amber-200/60 bg-white text-zinc-700 hover:border-ink",
    weekdayOn: "bg-emerald-500 text-white",
    weekdayOff: "bg-rose-200 text-rose-800",
  },
  black: {
    section: "rounded-2xl bg-zinc-900 ring-1 ring-white/10 p-6",
    sectionLabel: "text-zinc-400",
    sectionTitle: "text-white",
    field: "border-white/10 bg-zinc-800 text-zinc-100 focus:border-lime-300 focus:ring-lime-300/20",
    text: "text-white",
    subtext: "text-zinc-400",
    pillActive: "bg-lime-300/20 text-lime-300 ring-1 ring-lime-300",
    pillInactive: "bg-zinc-800 text-zinc-400 ring-1 ring-white/10 hover:ring-lime-300/40",
    submit: "bg-lime-300 text-zinc-950 hover:bg-lime-200",
    cancel: "border border-white/10 bg-zinc-800 text-zinc-300 hover:border-lime-300",
    weekdayOn: "bg-lime-300 text-zinc-950",
    weekdayOff: "bg-rose-500/30 text-rose-200",
  },
  white: {
    section: "rounded-2xl bg-white ring-1 ring-zinc-200 p-6",
    sectionLabel: "text-ink/70",
    sectionTitle: "text-ink",
    field: "border-zinc-300 bg-white text-ink focus:border-ink focus:ring-ink/20",
    text: "text-ink",
    subtext: "text-zinc-600",
    pillActive: "bg-sky-100 text-sky-900 ring-1 ring-sky-700",
    pillInactive: "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:ring-ink/40",
    submit: "bg-ink text-white hover:bg-ink/90",
    cancel: "border border-zinc-300 bg-white text-zinc-700 hover:border-ink",
    weekdayOn: "bg-sky-700 text-white",
    weekdayOff: "bg-rose-200 text-rose-800",
  },
} as const;

const initialState: CreateTrainerState = {};

export function TrainerForm({
  slug,
  lang,
  tone,
}: {
  slug: string;
  lang: string;
  tone: Tone;
}) {
  const t = useTranslations("trainerAdd");
  const tt = useTranslations("trainers");
  const router = useRouter();
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [specs, setSpecs] = useState<Set<Specialty>>(new Set());
  const [otherOn, setOtherOn] = useState(false);
  const [offDays, setOffDays] = useState<Set<Weekday>>(new Set());
  const [role, setRole] = useState<"TRAINER" | "MANAGER">("TRAINER");
  const [state, formAction, pending] = useActionState(
    createTrainer,
    initialState,
  );
  const tk = TONE[tone];

  useEffect(() => {
    if (state.success) {
      router.push(`/${lang}/g/${slug}/trainers`);
    }
  }, [state.success, router, lang, slug]);

  function toggleSpec(s: Specialty) {
    setSpecs((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  function toggleOff(w: Weekday) {
    setOffDays((prev) => {
      const next = new Set(prev);
      if (next.has(w)) next.delete(w);
      else next.add(w);
      return next;
    });
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="slug" value={slug} />

      {/* Section 1 — Photos */}
      <section className={tk.section}>
        <SectionHead
          tk={tk}
          eyebrow="01"
          title={t("sectionPhotos")}
          hint={t("sectionPhotosHint")}
        />
        <div className="mt-5">
          <PhotoUploader
            slug={slug}
            urls={imageUrls}
            onChange={setImageUrls}
            tone={tone}
          />
        </div>
      </section>

      {/* Section 2 — Basic */}
      <section className={tk.section}>
        <SectionHead tk={tk} eyebrow="02" title={t("sectionBasic")} />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field
            tk={tk}
            label={t("name")}
            name="name"
            required
            errors={state.errors?.name}
          />
          <div className="flex flex-col gap-1.5">
            <span className={`text-sm font-medium ${tk.text}`}>
              {t("gender")} <span className="text-rose-500">*</span>
            </span>
            <div className="flex gap-2">
              {(["MALE", "FEMALE"] as const).map((g, i) => (
                <label
                  key={g}
                  className="flex flex-1 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition has-checked:border-ink"
                >
                  <input
                    type="radio"
                    name="gender"
                    value={g}
                    defaultChecked={i === 0}
                    className="h-4 w-4 accent-ink"
                  />
                  <span className={tk.text}>
                    {g === "MALE" ? t("genderMale") : t("genderFemale")}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <Field
            tk={tk}
            label={t("phone")}
            name="phone"
            required
            placeholder={t("phonePlaceholder")}
            errors={state.errors?.phone}
            hint={t("phoneHint")}
          />
          <DobPicker
            name="dob"
            lang={lang}
            label={t("dob")}
            tone={tone}
          />
          <Field
            tk={tk}
            label={t("email")}
            name="email"
            type="email"
            placeholder={t("emailPlaceholder")}
            errors={state.errors?.email}
            hint={t("emailHint")}
          />
          <Field
            tk={tk}
            label={t("emergency")}
            name="emergencyContactPhone"
            placeholder={t("emergencyPlaceholder")}
          />
        </div>
      </section>

      {/* Section 3 — Role + Specialties */}
      <section className={tk.section}>
        <SectionHead tk={tk} eyebrow="03" title={t("sectionRoleSpec")} />
        <div className="mt-5 space-y-5">
          <div>
            <span className={`text-sm font-medium ${tk.text}`}>
              {t("role")} <span className="text-rose-500">*</span>
            </span>
            <div className="mt-2 flex gap-2">
              {(["TRAINER", "MANAGER"] as const).map((r) => (
                <label
                  key={r}
                  className={`cursor-pointer rounded-md px-3 py-1.5 text-sm transition ${
                    role === r ? tk.pillActive : tk.pillInactive
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r}
                    checked={role === r}
                    onChange={() => setRole(r)}
                    className="sr-only"
                  />
                  {r === "TRAINER" ? tt("roleTrainer") : tt("roleManager")}
                </label>
              ))}
            </div>
          </div>
          <SpecialtyPicker
            t={t}
            tk={tk}
            specs={specs}
            otherOn={otherOn}
            onToggleSpec={toggleSpec}
            onToggleOther={() => setOtherOn((v) => !v)}
          />
        </div>
      </section>

      {/* Section 4 — Bio + Career */}
      <section className={tk.section}>
        <SectionHead tk={tk} eyebrow="04" title={t("sectionBio")} />
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <TextArea
            tk={tk}
            label={t("bio")}
            name="bio"
            placeholder={t("bioPlaceholder")}
            rows={5}
          />
          <TextArea
            tk={tk}
            label={t("career")}
            name="career"
            placeholder={t("careerPlaceholder")}
            rows={5}
          />
        </div>
      </section>

      {/* Section 5 — Schedule */}
      <section className={tk.section}>
        <SectionHead
          tk={tk}
          eyebrow="05"
          title={t("sectionSchedule")}
          hint={t("scheduleHint")}
        />
        <div className="mt-5 flex flex-wrap gap-2">
          {ALL_WEEKDAYS.map((w) => {
            const isOff = offDays.has(w);
            return (
              <button
                key={w}
                type="button"
                onClick={() => toggleOff(w)}
                className={`flex h-12 w-12 items-center justify-center rounded-md text-sm font-bold transition ${
                  isOff ? tk.weekdayOff : tk.weekdayOn
                }`}
              >
                {tt(`weekday.${w}`)}
              </button>
            );
          })}
        </div>
        {Array.from(offDays).map((w) => (
          <input key={w} type="hidden" name="weeklyOffDays" value={w} />
        ))}
      </section>

      {/* Section 6 — Memo */}
      <section className={tk.section}>
        <SectionHead tk={tk} eyebrow="06" title={t("sectionMemo")} />
        <div className="mt-5">
          <TextArea
            tk={tk}
            label={t("note")}
            name="note"
            placeholder={t("notePlaceholder")}
            rows={3}
          />
        </div>
      </section>

      {/* Error summary — submit 근처에서 위쪽 필드 에러까지 한 번에 요약 */}
      {(state.message ||
        (state.errors && Object.keys(state.errors).length > 0)) && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.message && <div className="font-medium">{state.message}</div>}
          {state.errors && Object.keys(state.errors).length > 0 && (
            <ul className={`list-disc space-y-0.5 pl-5 ${state.message ? "mt-1.5" : ""}`}>
              {Object.entries(state.errors).flatMap(([key, msgs]) =>
                (msgs ?? []).map((m, i) => <li key={`${key}-${i}`}>{m}</li>),
              )}
            </ul>
          )}
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push(`/${lang}/g/${slug}/trainers`)}
          className={`h-11 rounded-md px-5 text-sm transition ${tk.cancel}`}
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          disabled={pending}
          className={`h-11 rounded-md px-6 text-sm font-medium transition disabled:opacity-60 ${tk.submit}`}
        >
          {pending ? t("submitting") : t("submit")}
        </button>
      </div>

      {/* Hidden inputs for state */}
      {Array.from(specs).map((s) => (
        <input key={s} type="hidden" name="specialties" value={s} />
      ))}
    </form>
  );
}

function SectionHead({
  tk,
  eyebrow,
  title,
  hint,
}: {
  tk: (typeof TONE)[Tone];
  eyebrow: string;
  title: string;
  hint?: string;
}) {
  return (
    <div>
      <span
        className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${tk.sectionLabel}`}
      >
        {eyebrow}
      </span>
      <h2
        className={`font-heading text-lg tracking-tight ${tk.sectionTitle}`}
      >
        {title}
      </h2>
      {hint && <p className={`mt-1 text-xs ${tk.subtext}`}>{hint}</p>}
    </div>
  );
}

function Field({
  tk,
  label,
  name,
  type = "text",
  placeholder,
  required,
  errors,
  hint,
}: {
  tk: (typeof TONE)[Tone];
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  errors?: string[];
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={`text-sm font-medium ${tk.text}`}>
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </span>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        aria-invalid={Boolean(errors)}
        className={`h-11 rounded-md border px-3 text-sm transition focus:outline-none focus:ring-2 ${tk.field}`}
      />
      {hint && !errors && (
        <span className={`text-xs ${tk.subtext}`}>{hint}</span>
      )}
      {errors && (
        <span className="text-xs text-rose-500">{errors.join(", ")}</span>
      )}
    </label>
  );
}

function TextArea({
  tk,
  label,
  name,
  placeholder,
  rows = 3,
}: {
  tk: (typeof TONE)[Tone];
  label: string;
  name: string;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={`text-sm font-medium ${tk.text}`}>{label}</span>
      <textarea
        name={name}
        rows={rows}
        placeholder={placeholder}
        className={`rounded-md border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 ${tk.field}`}
      />
    </label>
  );
}

function SpecialtyPicker({
  t,
  tk,
  specs,
  otherOn,
  onToggleSpec,
  onToggleOther,
}: {
  t: (k: string) => string;
  tk: (typeof TONE)[Tone];
  specs: Set<Specialty>;
  otherOn: boolean;
  onToggleSpec: (s: Specialty) => void;
  onToggleOther: () => void;
}) {
  const ts = useTranslations("trainers");
  return (
    <div>
      <span className={`text-sm font-medium ${tk.text}`}>{t("specialties")}</span>
      <div className="mt-2 flex flex-wrap gap-2">
        {ALL_SPEC.map((s) => {
          const isOn = specs.has(s);
          return (
            <label
              key={s}
              className={`cursor-pointer rounded-md px-3 py-1.5 text-sm transition ${
                isOn ? tk.pillActive : tk.pillInactive
              }`}
            >
              <input
                type="checkbox"
                checked={isOn}
                onChange={() => onToggleSpec(s)}
                className="sr-only"
              />
              {ts(`specialty.${s}`)}
            </label>
          );
        })}
        <label
          className={`cursor-pointer rounded-md px-3 py-1.5 text-sm transition ${
            otherOn ? tk.pillActive : tk.pillInactive
          }`}
        >
          <input
            type="checkbox"
            checked={otherOn}
            onChange={onToggleOther}
            className="sr-only"
          />
          {t("specialtyOther")}
        </label>
      </div>
      {otherOn && (
        <input
          type="text"
          name="customSpecialty"
          placeholder={t("specialtyOtherPlaceholder")}
          className={`mt-2 h-9 rounded-md border px-3 text-sm transition focus:outline-none focus:ring-2 ${tk.field}`}
        />
      )}
    </div>
  );
}
