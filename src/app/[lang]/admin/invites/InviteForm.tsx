"use client";

import { useActionState, useState } from "react";
import {
  createInvite,
  emailInvite,
  type CreateInviteState,
} from "./actions";

const initialState: CreateInviteState = {};

export function InviteForm() {
  const [state, formAction, pending] = useActionState(
    createInvite,
    initialState,
  );
  const [copied, setCopied] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [emailing, setEmailing] = useState(false);

  async function handleCopy(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleEmail(tokenId: string) {
    setEmailing(true);
    setEmailMsg(null);
    const fd = new FormData();
    fd.set("tokenId", tokenId);
    const r = await emailInvite(fd);
    setEmailMsg(r.ok ? "메일 발송 완료." : r.message ?? "발송 실패");
    setEmailing(false);
  }

  return (
    <div className="space-y-8">
      <form action={formAction} className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            label="예상 매장명"
            name="expectedBusinessName"
            placeholder="예) 스트롱헬스 케손"
            required
            errors={state.errors?.expectedBusinessName}
          />
          <Field
            label="사장 이메일 (발송용)"
            name="expectedOwnerEmail"
            type="email"
            placeholder="owner@example.com"
            required
            errors={state.errors?.expectedOwnerEmail}
          />
          <Field
            label="사장 전화"
            name="expectedOwnerPhone"
            placeholder="+63 ..."
            required
            errors={state.errors?.expectedOwnerPhone}
          />
          <div className="hidden sm:block" />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center justify-center rounded-md bg-ink px-6 text-sm font-medium text-white transition hover:bg-ink/90 disabled:opacity-60"
        >
          {pending ? "발급 중..." : "Invite 링크 발급"}
        </button>
      </form>

      {state.created && (
        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/60">
            발급 완료 · 7일 유효
          </div>
          <code className="block break-all rounded-md bg-white px-3 py-2 text-sm text-zinc-800 ring-1 ring-zinc-200">
            {state.created.url}
          </code>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleCopy(state.created!.url)}
              type="button"
              className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3 text-xs text-zinc-800 transition hover:border-ink"
            >
              {copied ? "복사됨" : "URL 복사"}
            </button>
            {state.created.ownerEmail ? (
              <button
                onClick={() => handleEmail(state.created!.id)}
                type="button"
                disabled={emailing}
                className="inline-flex h-9 items-center rounded-md bg-ink px-3 text-xs font-medium text-white transition hover:bg-ink/90 disabled:opacity-60"
              >
                {emailing
                  ? "발송 중..."
                  : `${state.created.ownerEmail}로 메일 발송`}
              </button>
            ) : (
              <span className="text-xs text-zinc-500">
                메일 발송하려면 사장 이메일을 입력하고 다시 발급
              </span>
            )}
          </div>
          {emailMsg && (
            <div className="text-xs text-zinc-700">{emailMsg}</div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
  hint,
  errors,
  required,
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  hint?: string;
  errors?: string[];
  required?: boolean;
}) {
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
        aria-invalid={Boolean(errors)}
        aria-required={required}
        className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder-zinc-400 transition focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
      />
      {hint && !errors && (
        <span className="text-xs text-zinc-500">{hint}</span>
      )}
      {errors && (
        <span className="text-xs text-red-600">{errors.join(", ")}</span>
      )}
    </label>
  );
}
