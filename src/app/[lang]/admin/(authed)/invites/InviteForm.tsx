"use client";

import { useActionState, useState, useTransition } from "react";
import { createInvite, emailInvite, type CreateInviteState } from "./actions";
import { copyText } from "@/lib/clipboard";

const initialState: CreateInviteState = {};

function buildMessage(businessName: string, url: string) {
  const subject = "예약가즈아 매장 등록 초대";
  const body = `${businessName} 사장님 안녕하세요.

예약가즈아 매장 등록 링크입니다.
아래 링크를 7일 안에 클릭해 매장 정보를 입력해 주세요.

${url}`;
  return { subject, body };
}

export function InviteForm() {
  const [state, formAction, pending] = useActionState(
    createInvite,
    initialState,
  );
  const [copied, setCopied] = useState<string | null>(null);
  const [sendStatus, setSendStatus] = useState<
    "idle" | "sending" | "ok" | "error"
  >("idle");
  const [sendMessage, setSendMessage] = useState<string>("");
  const [sendPending, startSend] = useTransition();

  async function copy(key: string, text: string) {
    await copyText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  function sendEmail() {
    if (!state.created) return;
    setSendStatus("sending");
    setSendMessage("");
    startSend(async () => {
      const fd = new FormData();
      fd.append("tokenId", state.created!.id);
      const res = await emailInvite(fd);
      if (res.ok) {
        setSendStatus("ok");
        setSendMessage(`발송 완료 → ${state.created!.ownerEmail}`);
      } else {
        setSendStatus("error");
        setSendMessage(res.message ?? "발송 실패");
      }
    });
  }

  const businessName = state.created?.businessName ?? "";
  const url = state.created?.url ?? "";
  const { subject, body } = state.created
    ? buildMessage(businessName, url)
    : { subject: "", body: "" };

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
            label="사장 이메일"
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
        <div className="space-y-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/60">
            발급 완료 · 7일 유효
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-700">
              초대 URL
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <code className="flex-1 break-all rounded-md bg-white px-3 py-2 text-sm text-zinc-800 ring-1 ring-zinc-200">
                {url}
              </code>
              <button
                type="button"
                onClick={() => copy("url", url)}
                className="inline-flex h-9 shrink-0 items-center rounded-md border border-zinc-300 bg-white px-3 text-xs text-zinc-800 transition hover:border-ink"
              >
                {copied === "url" ? "복사됨" : "URL 복사"}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-700">
              메시지 제목 (메일·카톡·문자에 그대로 사용)
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                readOnly
                value={subject}
                className="flex-1 rounded-md bg-white px-3 py-2 text-sm text-zinc-800 ring-1 ring-zinc-200"
              />
              <button
                type="button"
                onClick={() => copy("subject", subject)}
                className="inline-flex h-9 shrink-0 items-center rounded-md border border-zinc-300 bg-white px-3 text-xs text-zinc-800 transition hover:border-ink"
              >
                {copied === "subject" ? "복사됨" : "제목 복사"}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-700">
              메시지 본문 (사장님께 그대로 전달)
            </label>
            <textarea
              readOnly
              value={body}
              rows={7}
              className="block w-full rounded-md bg-white px-3 py-2 text-sm text-zinc-800 ring-1 ring-zinc-200"
            />
            <button
              type="button"
              onClick={() => copy("body", body)}
              className="inline-flex h-9 items-center rounded-md bg-ink px-3 text-xs font-medium text-white transition hover:bg-ink/90"
            >
              {copied === "body" ? "복사됨" : "본문 복사"}
            </button>
          </div>

          <div className="space-y-2 border-t border-zinc-200 pt-5">
            <label className="text-xs font-medium text-zinc-700">
              자동 메일 발송 ({state.created.ownerEmail})
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={sendEmail}
                disabled={
                  sendPending ||
                  sendStatus === "ok" ||
                  !state.created.ownerEmail
                }
                className="inline-flex h-9 items-center rounded-md bg-ink px-4 text-xs font-medium text-white transition hover:bg-ink/90 disabled:opacity-60"
              >
                {sendPending
                  ? "발송 중..."
                  : sendStatus === "ok"
                    ? "✓ 발송됨"
                    : "메일 자동 발송"}
              </button>
              {sendMessage && (
                <span
                  className={`text-xs ${
                    sendStatus === "ok"
                      ? "text-emerald-700"
                      : "text-rose-600"
                  }`}
                >
                  {sendMessage}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500">
              위 본문을 직접 카톡·문자로 보내거나, 이메일 자동 발송 버튼으로 한 번에 전달.
            </p>
          </div>
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
