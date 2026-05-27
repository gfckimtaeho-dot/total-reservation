"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  createTrainer,
  updateTrainer,
  type CreateTrainerState,
} from "../actions";
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
    weekdayOff: "bg-zinc-200 text-zinc-500",
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
    weekdayOff: "bg-zinc-700 text-zinc-400",
  },
  white: {
    // 섹션 bg는 인덱스에 따라 sky → amber → lime 로테이션 (WHITE_SECTIONS 사용).
    // 여기 section 값은 placeholder — 실제 렌더 시 whiteSection(idx)로 덮어씀.
    section: "rounded-2xl bg-sky-50 ring-1 ring-sky-200/50 p-6",
    sectionLabel: "text-ink/70",
    sectionTitle: "text-ink",
    field:
      "border-zinc-300 bg-white text-ink focus:border-violet-500 focus:ring-violet-500/20",
    text: "text-ink",
    subtext: "text-zinc-600",
    pillActive: "bg-violet-100 text-violet-800 ring-1 ring-violet-600",
    pillInactive:
      "bg-white text-zinc-600 ring-1 ring-zinc-300 hover:ring-violet-400",
    submit: "bg-violet-600 text-white hover:bg-violet-700",
    cancel:
      "border border-zinc-300 bg-white text-zinc-700 hover:border-violet-500",
    weekdayOn: "bg-violet-600 text-white",
    weekdayOff: "bg-zinc-200 text-zinc-500",
  },
} as const;

const initialState: CreateTrainerState = {};

// Dashboard White Pastel과 동일한 다색 섹션 카드 로테이션. 6개 섹션을 3색 순환.
const WHITE_SECTIONS = [
  "rounded-2xl bg-sky-50 ring-1 ring-sky-200/50 p-6",
  "rounded-2xl bg-amber-50 ring-1 ring-amber-200/60 p-6",
  "rounded-2xl bg-lime-50 ring-1 ring-lime-200/50 p-6",
] as const;

export type TrainerInitialValues = {
  name: string;
  gender: "MALE" | "FEMALE";
  phone: string;
  email: string;
  dob: Date | null;
  emergencyContactPhone: string;
  role: "TRAINER" | "MANAGER";
  specialties: Specialty[];
  customSpecialty: string;
  bio: string;
  career: string;
  weeklyOffDays: Weekday[];
  workStartMin: number | null;
  workEndMin: number | null;
  breakStartMin: number | null;
  breakEndMin: number | null;
  monthlyBaseSalaryPhp: number;
  note: string;
  imageUrls: string[];
  locale?: "en" | "ko";
};

// 분 ↔ "HH:MM" (native time input 포맷)
function minToTime(min: number | null | undefined): string {
  if (min == null) return "";
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(
    min % 60,
  ).padStart(2, "0")}`;
}

export function TrainerForm({
  slug,
  lang,
  tone,
  mode = "create",
  staffId,
  initialValues,
}: {
  slug: string;
  lang: string;
  tone: Tone;
  mode?: "create" | "edit";
  staffId?: string;
  initialValues?: TrainerInitialValues;
}) {
  const t = useTranslations("trainerAdd");
  const tt = useTranslations("trainers");
  const router = useRouter();
  const iv = initialValues;
  const [imageUrls, setImageUrls] = useState<string[]>(iv?.imageUrls ?? []);
  const [specs, setSpecs] = useState<Set<Specialty>>(
    new Set(iv?.specialties ?? []),
  );
  const [otherOn, setOtherOn] = useState(Boolean(iv?.customSpecialty));
  const [customSpecialty, setCustomSpecialty] = useState(
    iv?.customSpecialty ?? "",
  );
  const [offDays, setOffDays] = useState<Set<Weekday>>(
    new Set(iv?.weeklyOffDays ?? []),
  );
  // 기본 출근 10:00~22:00 — 신규 등록 + 미설정(null) 트레이너 모두 이 값으로.
  const [workStart, setWorkStart] = useState(
    iv?.workStartMin != null ? minToTime(iv.workStartMin) : "10:00",
  );
  const [workEnd, setWorkEnd] = useState(
    iv?.workEndMin != null ? minToTime(iv.workEndMin) : "22:00",
  );
  // 휴게는 기본 없음(빈 값). 입력하면 그 구간 예약 불가.
  const [breakStart, setBreakStart] = useState(
    iv?.breakStartMin != null ? minToTime(iv.breakStartMin) : "",
  );
  const [breakEnd, setBreakEnd] = useState(
    iv?.breakEndMin != null ? minToTime(iv.breakEndMin) : "",
  );
  const [role, setRole] = useState<"TRAINER" | "MANAGER">(iv?.role ?? "TRAINER");
  const [gender, setGender] = useState<"MALE" | "FEMALE">(iv?.gender ?? "MALE");
  // 등록 시 모국어 선택 → User.locale. UI 언어 결정 — 등록자가 명시
  // 선택해야 등록 가능 (default 자동 선택 금지: 외국인/한국인 구분 불가).
  const [locale, setLocale] = useState<"en" | "ko" | "">(iv?.locale ?? "");
  // Controlled text fields — auto-reset 방지 (등록 실패 시 입력값 보존).
  const [fields, setFields] = useState({
    name: iv?.name ?? "",
    phone: iv?.phone ?? "",
    email: iv?.email ?? "",
    emergencyContactPhone: iv?.emergencyContactPhone ?? "",
    bio: iv?.bio ?? "",
    career: iv?.career ?? "",
    note: iv?.note ?? "",
    monthlyBaseSalaryPhp: String(iv?.monthlyBaseSalaryPhp ?? 0),
  });
  function set<K extends keyof typeof fields>(k: K, v: string) {
    setFields((p) => ({ ...p, [k]: v }));
  }
  const action = mode === "edit" ? updateTrainer : createTrainer;
  const [state, formAction, pending] = useActionState(action, initialState);
  const tk = TONE[tone];
  const sectionClass = (idx: number) =>
    tone === "white" ? WHITE_SECTIONS[idx % 3] : tk.section;

  useEffect(() => {
    if (state.success) {
      const target =
        mode === "edit"
          ? `/${lang}/g/${slug}/trainers/${state.success.id}`
          : `/${lang}/g/${slug}/trainers`;
      router.push(target);
    }
  }, [state.success, router, lang, slug, mode]);

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
      {mode === "edit" && staffId && (
        <input type="hidden" name="staffId" value={staffId} />
      )}
      <input
        type="hidden"
        name="imageUrls"
        value={JSON.stringify(imageUrls)}
      />

      {/* Section 1 — Photos */}
      <section className={sectionClass(0)}>
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
      <section className={sectionClass(1)}>
        <SectionHead tk={tk} eyebrow="02" title={t("sectionBasic")} />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field
            tk={tk}
            label={t("name")}
            name="name"
            required
            errors={state.errors?.name}
            value={fields.name}
            onChange={(v) => set("name", v)}
          />
          <div className="flex flex-col gap-1.5">
            <span className={`text-sm font-medium ${tk.text}`}>
              {t("gender")} <span className="text-rose-500">*</span>
            </span>
            <div className="flex gap-2">
              {(["MALE", "FEMALE"] as const).map((g) => (
                <label
                  key={g}
                  className="flex flex-1 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition has-checked:border-ink"
                >
                  <input
                    type="radio"
                    name="gender"
                    value={g}
                    checked={gender === g}
                    onChange={() => setGender(g)}
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
            value={fields.phone}
            onChange={(v) => set("phone", v)}
          />
          <DobPicker
            name="dob"
            lang={lang}
            label={t("dob")}
            initialDate={iv?.dob ?? undefined}
          />
          <Field
            tk={tk}
            label={t("email")}
            name="email"
            type="email"
            placeholder={t("emailPlaceholder")}
            errors={state.errors?.email}
            hint={t("emailHint")}
            value={fields.email}
            onChange={(v) => set("email", v)}
          />
          <Field
            tk={tk}
            label={t("emergency")}
            name="emergencyContactPhone"
            placeholder={t("emergencyPlaceholder")}
            value={fields.emergencyContactPhone}
            onChange={(v) => set("emergencyContactPhone", v)}
          />
          <div className="flex flex-col gap-1.5">
            <span className={`text-sm font-medium ${tk.text}`}>
              {t("language")} <span className="text-rose-500">*</span>
            </span>
            <div className="flex gap-2">
              {(["en", "ko"] as const).map((lc) => (
                <label
                  key={lc}
                  className="flex flex-1 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition has-checked:border-ink"
                >
                  <input
                    type="radio"
                    name="locale"
                    value={lc}
                    checked={locale === lc}
                    onChange={() => setLocale(lc)}
                    className="h-4 w-4 accent-ink"
                  />
                  <span className={tk.text}>
                    {lc === "en" ? t("langEnglish") : t("langKorean")}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section 3 — Role + Specialties */}
      <section className={sectionClass(2)}>
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
            customSpecialty={customSpecialty}
            onToggleSpec={toggleSpec}
            onToggleOther={() => setOtherOn((v) => !v)}
            onChangeCustom={setCustomSpecialty}
          />
        </div>
      </section>

      {/* Section 4 — Bio + Career */}
      <section className={sectionClass(3)}>
        <SectionHead tk={tk} eyebrow="04" title={t("sectionBio")} />
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <TextArea
            tk={tk}
            label={t("bio")}
            name="bio"
            placeholder={t("bioPlaceholder")}
            rows={5}
            value={fields.bio}
            onChange={(v) => set("bio", v)}
          />
          <TextArea
            tk={tk}
            label={t("career")}
            name="career"
            placeholder={t("careerPlaceholder")}
            rows={5}
            value={fields.career}
            onChange={(v) => set("career", v)}
          />
        </div>
      </section>

      {/* Section 5 — Schedule */}
      <section className={sectionClass(4)}>
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

        <div className="mt-6">
          <div className="text-xs font-medium opacity-70">
            {t("workTimeLabel")}
          </div>
          <div className="mt-2 flex items-center gap-3">
            <input
              type="time"
              name="workStart"
              lang={lang}
              step={3600}
              value={workStart}
              onChange={(e) => setWorkStart(e.target.value)}
              className={`h-9 rounded-md border px-3 text-sm transition focus:outline-none focus:ring-2 ${tk.field}`}
            />
            <span className="text-sm opacity-60">~</span>
            <input
              type="time"
              name="workEnd"
              lang={lang}
              step={3600}
              value={workEnd}
              onChange={(e) => setWorkEnd(e.target.value)}
              className={`h-9 rounded-md border px-3 text-sm transition focus:outline-none focus:ring-2 ${tk.field}`}
            />
          </div>
          <p className="mt-1.5 text-xs opacity-60">{t("workTimeHint")}</p>
        </div>

        <div className="mt-5">
          <div className="text-xs font-medium opacity-70">
            {t("breakTimeLabel")}
          </div>
          <div className="mt-2 flex items-center gap-3">
            <input
              type="time"
              name="breakStart"
              lang={lang}
              step={3600}
              value={breakStart}
              onChange={(e) => setBreakStart(e.target.value)}
              className={`h-9 rounded-md border px-3 text-sm transition focus:outline-none focus:ring-2 ${tk.field}`}
            />
            <span className="text-sm opacity-60">~</span>
            <input
              type="time"
              name="breakEnd"
              lang={lang}
              step={3600}
              value={breakEnd}
              onChange={(e) => setBreakEnd(e.target.value)}
              className={`h-9 rounded-md border px-3 text-sm transition focus:outline-none focus:ring-2 ${tk.field}`}
            />
          </div>
          <p className="mt-1.5 text-xs opacity-60">{t("breakTimeHint")}</p>
        </div>
      </section>

      {/* Section 6 — Monthly base salary */}
      <section className={sectionClass(5)}>
        <SectionHead
          tk={tk}
          eyebrow="06"
          title={t("sectionSalary")}
          hint={t("monthlyBaseSalaryHint")}
        />
        <div className="mt-5 sm:max-w-xs">
          <label className="flex flex-col gap-1.5">
            <span className={`text-sm font-medium ${tk.text}`}>
              {t("monthlyBaseSalary")}
            </span>
            <input
              type="hidden"
              name="monthlyBaseSalaryPhp"
              value={fields.monthlyBaseSalaryPhp}
            />
            <input
              type="text"
              inputMode="numeric"
              placeholder={t("monthlyBaseSalaryPlaceholder")}
              value={
                fields.monthlyBaseSalaryPhp
                  ? Number(fields.monthlyBaseSalaryPhp).toLocaleString("en-US")
                  : ""
              }
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d]/g, "");
                set("monthlyBaseSalaryPhp", raw);
              }}
              className={`h-11 rounded-md border px-3 text-sm tabular-nums transition focus:outline-none focus:ring-2 ${tk.field}`}
            />
          </label>
        </div>
      </section>

      {/* Section 7 — Memo */}
      <section className={sectionClass(6)}>
        <SectionHead tk={tk} eyebrow="07" title={t("sectionMemo")} />
        <div className="mt-5">
          <TextArea
            tk={tk}
            label={t("note")}
            name="note"
            placeholder={t("notePlaceholder")}
            rows={3}
            value={fields.note}
            onChange={(v) => set("note", v)}
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
          onClick={() =>
            router.push(
              mode === "edit" && staffId
                ? `/${lang}/g/${slug}/trainers/${staffId}`
                : `/${lang}/g/${slug}/trainers`,
            )
          }
          className={`h-11 rounded-md px-5 text-sm transition ${tk.cancel}`}
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          disabled={pending || !locale}
          className={`h-11 rounded-md px-6 text-sm font-medium transition disabled:opacity-60 ${tk.submit}`}
        >
          {mode === "edit"
            ? pending
              ? t("editSubmitting")
              : t("editSubmit")
            : pending
              ? t("submitting")
              : t("submit")}
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
  value,
  onChange,
}: {
  tk: (typeof TONE)[Tone];
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  errors?: string[];
  hint?: string;
  value: string;
  onChange: (v: string) => void;
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
  value,
  onChange,
}: {
  tk: (typeof TONE)[Tone];
  label: string;
  name: string;
  placeholder?: string;
  rows?: number;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={`text-sm font-medium ${tk.text}`}>{label}</span>
      <textarea
        name={name}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
  customSpecialty,
  onToggleSpec,
  onToggleOther,
  onChangeCustom,
}: {
  t: (k: string) => string;
  tk: (typeof TONE)[Tone];
  specs: Set<Specialty>;
  otherOn: boolean;
  customSpecialty: string;
  onToggleSpec: (s: Specialty) => void;
  onToggleOther: () => void;
  onChangeCustom: (v: string) => void;
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
          value={customSpecialty}
          onChange={(e) => onChangeCustom(e.target.value)}
          className={`mt-2 h-9 rounded-md border px-3 text-sm transition focus:outline-none focus:ring-2 ${tk.field}`}
        />
      )}
    </div>
  );
}
