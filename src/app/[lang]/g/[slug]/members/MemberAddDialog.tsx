"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  createMember,
  updateMember,
  type CreateMemberState,
} from "./actions";
import { DobPicker } from "./DobPicker";

const initialState: CreateMemberState = {};

export type EditMember = {
  id: string;
  name: string;
  gender: "MALE" | "FEMALE" | null;
  phone: string | null;
  email: string | null;
  dob: string | null;
  emergencyContactPhone: string | null;
  note: string | null;
  locale: "en" | "ko";
};

const TK = {
  overlay: "bg-zinc-900/40",
  panel: "bg-white ring-1 ring-violet-100",
  primaryBtn: "bg-violet-600 text-white hover:bg-violet-700",
  cancelBtn:
    "border border-violet-200 bg-white text-zinc-700 hover:border-violet-500",
  fieldBorder: "border-violet-200",
  fieldFocus: "focus:border-violet-500 focus:ring-violet-500/20",
  radioActive: "border-violet-600 bg-violet-100",
  radioInactive: "border-violet-200 bg-white",
} as const;

export function MemberAddDialog({
  slug,
  lang,
  mode = "create",
  member,
}: {
  slug: string;
  lang: string;
  mode?: "create" | "edit";
  member?: EditMember;
}) {
  const t = useTranslations("memberAdd");
  const isEdit = mode === "edit";
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    isEdit ? updateMember : createMember,
    initialState,
  );

  useEffect(() => {
    if (state.success) {
      setOpen(false);
    }
  }, [state.success]);

  return (
    <>
      {isEdit ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`h-8 rounded-md px-3 text-xs transition ${TK.cancelBtn}`}
        >
          {t("rowEdit")}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`inline-flex h-10 items-center rounded-md px-4 text-sm font-medium transition ${TK.primaryBtn}`}
        >
          + {t("title")}
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className={`absolute inset-0 ${TK.overlay}`}
            onClick={() => setOpen(false)}
          />
          <div
            className={`relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6 ${TK.panel}`}
          >
            <h2 className="font-heading text-xl tracking-tight">
              <span className="text-ink">
                {isEdit ? t("editTitle") : t("title")}
              </span>
            </h2>
            <form action={formAction} className="mt-5 space-y-4">
              <input type="hidden" name="slug" value={slug} />
              {isEdit && member && (
                <input type="hidden" name="memberId" value={member.id} />
              )}

              <Field
                label={t("name")}
                name="name"
                required
                errors={state.errors?.name}
                defaultValue={member?.name ?? ""}
              />

              <div>
                <span className="text-sm font-medium text-zinc-800">
                  {t("gender")} <span className="text-rose-500">*</span>
                </span>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(["MALE", "FEMALE"] as const).map((g, i) => (
                    <label
                      key={g}
                      className={`flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm transition has-[:checked]:${TK.radioActive} ${TK.radioInactive}`}
                    >
                      <input
                        type="radio"
                        name="gender"
                        value={g}
                        defaultChecked={
                          member?.gender ? member.gender === g : i === 0
                        }
                        className="h-4 w-4 accent-ink"
                      />
                      {g === "MALE" ? t("genderMale") : t("genderFemale")}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-sm font-medium text-zinc-800">
                  {t("language")} <span className="text-rose-500">*</span>
                </span>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(["en", "ko"] as const).map((lc, i) => (
                    <label
                      key={lc}
                      className={`flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm transition has-[:checked]:${TK.radioActive} ${TK.radioInactive}`}
                    >
                      <input
                        type="radio"
                        name="locale"
                        value={lc}
                        defaultChecked={
                          member?.locale ? member.locale === lc : i === 0
                        }
                        className="h-4 w-4 accent-ink"
                      />
                      {lc === "en" ? t("langEnglish") : t("langKorean")}
                    </label>
                  ))}
                </div>
              </div>

              <Field
                label={t("phone")}
                name="phone"
                required
                placeholder={t("phonePlaceholder")}
                errors={state.errors?.phone}
                hint={t("phoneHint")}
                defaultValue={member?.phone ?? ""}
              />

              <DobPicker
                name="dob"
                lang={lang}
                label={t("dob")}
                initialDate={
                  member?.dob ? new Date(member.dob) : undefined
                }
              />
              {state.errors?.dob && (
                <span className="text-xs text-rose-500">
                  {state.errors.dob.join(", ")}
                </span>
              )}

              <Field
                label={t("email")}
                name="email"
                type="email"
                placeholder={t("emailPlaceholder")}
                errors={state.errors?.email}
                hint={t("emailHint")}
                defaultValue={member?.email ?? ""}
              />

              <Field
                label={t("emergency")}
                name="emergencyContactPhone"
                placeholder={t("emergencyPlaceholder")}
                errors={state.errors?.emergencyContactPhone}
                defaultValue={member?.emergencyContactPhone ?? ""}
              />

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-zinc-800">
                  {t("note")}
                </span>
                <textarea
                  name="note"
                  rows={3}
                  placeholder={t("notePlaceholder")}
                  defaultValue={member?.note ?? ""}
                  className={`rounded-md border ${TK.fieldBorder} px-3 py-2 text-sm transition focus:outline-none focus:ring-2 ${TK.fieldFocus}`}
                />
                {state.errors?.note && (
                  <span className="text-xs text-rose-500">
                    {state.errors.note.join(", ")}
                  </span>
                )}
              </label>

              {state.errors &&
                Object.keys(state.errors).length > 0 && (
                  <p className="text-sm font-medium text-rose-500">
                    {t("formHasErrors")}
                  </p>
                )}

              <div className="flex items-center justify-end gap-2 border-t border-zinc-100 pt-5 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className={`h-10 rounded-md px-4 text-sm transition ${TK.cancelBtn}`}
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className={`h-10 rounded-md px-5 text-sm font-medium transition disabled:opacity-60 ${TK.primaryBtn}`}
                >
                  {pending
                    ? isEdit
                      ? t("editSubmitting")
                      : t("submitting")
                    : isEdit
                      ? t("editSubmit")
                      : t("submit")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required,
  errors,
  hint,
  lang,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  errors?: string[];
  hint?: string;
  lang?: string;
  defaultValue?: string;
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
        placeholder={placeholder}
        lang={lang}
        defaultValue={defaultValue}
        aria-invalid={Boolean(errors)}
        className={`h-11 rounded-md border ${TK.fieldBorder} px-3 text-sm transition focus:outline-none focus:ring-2 ${TK.fieldFocus}`}
      />
      {hint && !errors && (
        <span className="text-xs text-zinc-500">{hint}</span>
      )}
      {errors && (
        <span className="text-xs text-rose-500">{errors.join(", ")}</span>
      )}
    </label>
  );
}
