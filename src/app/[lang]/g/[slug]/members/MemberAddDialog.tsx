"use client";

import { useActionState, useEffect, useState } from "react";
import { createMember, type CreateMemberState } from "./actions";

const initialState: CreateMemberState = {};

type Tone = "normal" | "black" | "white";

const TONE_TOKENS = {
  normal: {
    overlay: "bg-ink/40",
    panel: "bg-white ring-1 ring-amber-200/60",
    primaryBtn: "bg-ink text-white hover:bg-ink/90",
    cancelBtn: "border border-amber-200/60 bg-white text-zinc-700 hover:border-ink",
    fieldBorder: "border-amber-200/60",
    fieldFocus: "focus:border-ink focus:ring-ink/20",
    radioActive: "border-ink bg-band/40",
    radioInactive: "border-amber-200/60 bg-white",
  },
  black: {
    overlay: "bg-black/70",
    panel: "bg-zinc-900 ring-1 ring-white/10",
    primaryBtn: "bg-lime-300 text-zinc-950 hover:bg-lime-200",
    cancelBtn: "border border-white/10 bg-zinc-800 text-zinc-300 hover:border-lime-300",
    fieldBorder: "border-white/10 bg-zinc-800 text-zinc-100",
    fieldFocus: "focus:border-lime-300 focus:ring-lime-300/20",
    radioActive: "border-lime-300 bg-lime-300/10 text-white",
    radioInactive: "border-white/10 bg-zinc-800 text-zinc-300",
  },
  white: {
    overlay: "bg-zinc-900/40",
    panel: "bg-white ring-1 ring-zinc-200",
    primaryBtn: "bg-ink text-white hover:bg-ink/90",
    cancelBtn: "border border-zinc-300 bg-white text-zinc-700 hover:border-ink",
    fieldBorder: "border-zinc-300",
    fieldFocus: "focus:border-ink focus:ring-ink/20",
    radioActive: "border-ink bg-sky-100",
    radioInactive: "border-zinc-300 bg-white",
  },
} as const;

export function MemberAddDialog({
  slug,
  tone,
}: {
  slug: string;
  tone: Tone;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    createMember,
    initialState,
  );
  const t = TONE_TOKENS[tone];

  useEffect(() => {
    if (state.success) {
      setOpen(false);
    }
  }, [state.success]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex h-10 items-center rounded-md px-4 text-sm font-medium transition ${t.primaryBtn}`}
      >
        + 회원 추가
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className={`absolute inset-0 ${t.overlay}`}
            onClick={() => setOpen(false)}
          />
          <div
            className={`relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6 ${t.panel}`}
          >
            <h2 className="font-heading text-xl tracking-tight">
              <span className={tone === "black" ? "text-white" : "text-ink"}>
                회원 추가
              </span>
            </h2>
            <form action={formAction} className="mt-5 space-y-4">
              <input type="hidden" name="slug" value={slug} />

              <Field
                t={t}
                tone={tone}
                label="이름"
                name="name"
                required
                errors={state.errors?.name}
              />

              <div>
                <span
                  className={`text-sm font-medium ${tone === "black" ? "text-zinc-200" : "text-zinc-800"}`}
                >
                  성별 <span className="text-rose-500">*</span>
                </span>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(["MALE", "FEMALE"] as const).map((g, i) => (
                    <label
                      key={g}
                      className={`flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm transition has-[:checked]:${t.radioActive} ${t.radioInactive}`}
                    >
                      <input
                        type="radio"
                        name="gender"
                        value={g}
                        defaultChecked={i === 0}
                        className="h-4 w-4 accent-ink"
                      />
                      {g === "MALE" ? "남" : "여"}
                    </label>
                  ))}
                </div>
              </div>

              <Field
                t={t}
                tone={tone}
                label="핸드폰 번호"
                name="phone"
                required
                placeholder="+63 ..."
                errors={state.errors?.phone}
                hint="매장 내 회원 식별자 (중복 불가)"
              />

              <Field
                t={t}
                tone={tone}
                label="이메일 (옵셔널)"
                name="email"
                type="email"
                placeholder="없으면 비워두세요"
                errors={state.errors?.email}
                hint="이메일이 있으면 설치 URL을 자동 발송할 수 있습니다"
              />

              <Field
                t={t}
                tone={tone}
                label="생년월일 (옵셔널)"
                name="dob"
                type="date"
                errors={state.errors?.dob}
              />

              <Field
                t={t}
                tone={tone}
                label="비상연락처 (옵셔널)"
                name="emergencyContactPhone"
                placeholder="가족·보호자 번호"
                errors={state.errors?.emergencyContactPhone}
              />

              <label className="flex flex-col gap-1.5">
                <span
                  className={`text-sm font-medium ${tone === "black" ? "text-zinc-200" : "text-zinc-800"}`}
                >
                  메모 / 특이사항 (옵셔널)
                </span>
                <textarea
                  name="note"
                  rows={3}
                  placeholder="허리 디스크, 임산부, 알러지 등 — 트레이너·테라피스트가 봐야 할 정보"
                  className={`rounded-md border ${t.fieldBorder} px-3 py-2 text-sm transition focus:outline-none focus:ring-2 ${t.fieldFocus}`}
                />
                {state.errors?.note && (
                  <span className="text-xs text-rose-500">
                    {state.errors.note.join(", ")}
                  </span>
                )}
              </label>

              <div className="flex items-center justify-end gap-2 border-t border-zinc-100 pt-5 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className={`h-10 rounded-md px-4 text-sm transition ${t.cancelBtn}`}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className={`h-10 rounded-md px-5 text-sm font-medium transition disabled:opacity-60 ${t.primaryBtn}`}
                >
                  {pending ? "등록 중..." : "회원 추가"}
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
  t,
  tone,
  label,
  name,
  type = "text",
  placeholder,
  required,
  errors,
  hint,
}: {
  t: (typeof TONE_TOKENS)[Tone];
  tone: Tone;
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
      <span
        className={`text-sm font-medium ${tone === "black" ? "text-zinc-200" : "text-zinc-800"}`}
      >
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </span>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        aria-invalid={Boolean(errors)}
        className={`h-11 rounded-md border ${t.fieldBorder} px-3 text-sm transition focus:outline-none focus:ring-2 ${t.fieldFocus}`}
      />
      {hint && !errors && (
        <span
          className={`text-xs ${tone === "black" ? "text-zinc-500" : "text-zinc-500"}`}
        >
          {hint}
        </span>
      )}
      {errors && (
        <span className="text-xs text-rose-500">{errors.join(", ")}</span>
      )}
    </label>
  );
}
