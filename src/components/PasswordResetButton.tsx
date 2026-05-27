"use client";

import { useState, useTransition } from "react";
import { copyText } from "@/lib/clipboard";

// 비번 재설정 URL 발급 + 복사. 회원/트레이너 공용.
// action: copyPasswordResetUrl (회원) / copyTrainerPasswordResetUrl (트레이너).
// idField: server action 이 formData.get(idField) 로 받음 ("memberId" or "staffId").
type ActionResult =
  | { ok: true; url: string; emailedTo?: string }
  | { ok: false; message: string };

export function PasswordResetButton({
  slug,
  id,
  idField,
  action,
  label,
  copyLabel,
  copiedLabel,
  hint,
  sentLabel,
  alwaysShowUrl = false,
}: {
  slug: string;
  id: string;
  idField: "memberId" | "staffId";
  action: (formData: FormData) => Promise<ActionResult>;
  label: string;
  copyLabel: string;
  copiedLabel: string;
  hint: string;
  /** "메일 발송됨" — emailedTo 가 뒤에 concat */
  sentLabel: string;
  /** true 면 메일 발송 성공해도 URL 도 같이 노출. 트레이너 db /intake 처럼
   *  본인 폰으로 카톡 전달도 동시에 가능해야 하는 흐름에 사용. */
  alwaysShowUrl?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [emailedTo, setEmailedTo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  function onIssue() {
    setErr(null);
    setCopied(false);
    start(async () => {
      const fd = new FormData();
      fd.set("slug", slug);
      fd.set(idField, id);
      const r = await action(fd);
      if (r.ok) {
        setUrl(r.url);
        setEmailedTo(r.emailedTo ?? null);
      } else {
        setErr(r.message ?? "발급 실패");
      }
    });
  }

  async function onCopy() {
    if (!url) return;
    const ok = await copyText(url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (!url) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={onIssue}
          disabled={pending}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-ink hover:text-ink disabled:opacity-60"
        >
          {pending ? "..." : label}
        </button>
        {err && <span className="text-xs text-rose-600">{err}</span>}
      </div>
    );
  }

  // alwaysShowUrl=false (기본, 사장 db) + 메일 발송 성공 → URL 숨김, "발송됨" 만.
  // alwaysShowUrl=true (트레이너 db /intake) → 메일 발송 결과 + URL 둘 다.
  // 이메일 없거나 발송 실패 → URL 만 (둘 다 공통).
  return (
    <div className="flex flex-col items-stretch gap-1.5 sm:min-w-[360px]">
      {emailedTo && (
        <span className="self-end rounded-md bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
          {sentLabel} → {emailedTo}
        </span>
      )}
      {(alwaysShowUrl || !emailedTo) && (
        <>
          <div className="flex items-stretch gap-2">
            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-800"
            />
            <button
              type="button"
              onClick={onCopy}
              className="shrink-0 rounded-md bg-ink px-3 text-xs font-medium text-white transition hover:bg-ink/90"
            >
              {copied ? copiedLabel : copyLabel}
            </button>
          </div>
          <span className="text-[11px] text-zinc-500">{hint}</span>
        </>
      )}
    </div>
  );
}
