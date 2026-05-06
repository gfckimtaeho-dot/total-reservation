"use client";

import { useState, useTransition } from "react";
import {
  copyActivationUrl,
  deleteMember,
  sendActivationEmail,
} from "./actions";

type Tone = "normal" | "black" | "white";

const TONE_TOKENS = {
  normal: {
    rowBorder: "border-amber-200/60",
    rowHover: "hover:bg-amber-50/40",
    text: "text-ink",
    subtext: "text-zinc-600",
    pillPending: "bg-amber-100 text-amber-900/80",
    pillActive: "bg-band/60 text-ink",
    btn: "border border-amber-200/60 bg-white text-ink hover:border-ink",
    btnPrimary: "bg-ink text-white hover:bg-ink/90",
    btnDanger: "border border-rose-300 bg-white text-rose-600 hover:bg-rose-50",
    successText: "text-emerald-700",
    errorText: "text-rose-600",
  },
  black: {
    rowBorder: "border-white/10",
    rowHover: "hover:bg-white/5",
    text: "text-white",
    subtext: "text-zinc-400",
    pillPending: "bg-amber-300/20 text-amber-300",
    pillActive: "bg-lime-300/20 text-lime-300",
    btn: "border border-white/10 bg-zinc-800 text-zinc-200 hover:border-lime-300",
    btnPrimary: "bg-lime-300 text-zinc-950 hover:bg-lime-200",
    btnDanger: "border border-rose-500/40 bg-zinc-800 text-rose-300 hover:bg-rose-500/10",
    successText: "text-lime-300",
    errorText: "text-rose-400",
  },
  white: {
    rowBorder: "border-zinc-200",
    rowHover: "hover:bg-zinc-50",
    text: "text-ink",
    subtext: "text-zinc-600",
    pillPending: "bg-amber-100 text-amber-800",
    pillActive: "bg-sky-100 text-sky-900",
    btn: "border border-zinc-300 bg-white text-zinc-700 hover:border-ink",
    btnPrimary: "bg-ink text-white hover:bg-ink/90",
    btnDanger: "border border-rose-300 bg-white text-rose-600 hover:bg-rose-50",
    successText: "text-emerald-700",
    errorText: "text-rose-600",
  },
} as const;

const GENDER_LABEL = { MALE: "남", FEMALE: "여" } as const;
const STATUS_LABEL = {
  PENDING: "초대 대기",
  ACTIVE: "활성",
  WITHDRAWN: "탈퇴",
  ANONYMIZED: "익명화",
} as const;

export type MemberView = {
  id: string;
  name: string;
  gender: "MALE" | "FEMALE" | null;
  phone: string | null;
  email: string | null;
  dob: string | null;
  note: string | null;
  emergencyContactPhone: string | null;
  status: "PENDING" | "ACTIVE" | "WITHDRAWN" | "ANONYMIZED";
  createdAt: string;
};

export function MemberRow({
  slug,
  member,
  tone,
}: {
  slug: string;
  member: MemberView;
  tone: Tone;
}) {
  const t = TONE_TOKENS[tone];
  const [feedback, setFeedback] = useState<{
    kind: "ok" | "err";
    message: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const isActive = member.status === "ACTIVE";

  function showFeedback(kind: "ok" | "err", message: string) {
    setFeedback({ kind, message });
    setTimeout(() => setFeedback(null), 3500);
  }

  function onSendEmail() {
    if (!member.email) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.append("slug", slug);
      fd.append("memberId", member.id);
      const res = await sendActivationEmail(fd);
      if (res.ok) showFeedback("ok", `이메일 발송 완료 → ${member.email}`);
      else showFeedback("err", res.message);
    });
  }

  function onCopyUrl() {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("slug", slug);
      fd.append("memberId", member.id);
      const res = await copyActivationUrl(fd);
      if (res.ok) {
        await navigator.clipboard.writeText(res.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        showFeedback("ok", "URL 복사됨 — 카톡·SMS로 보내세요");
      } else {
        showFeedback("err", res.message);
      }
    });
  }

  function onDelete() {
    if (!confirm(`${member.name} 회원을 정말 삭제하시겠어요?`)) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.append("slug", slug);
      fd.append("memberId", member.id);
      await deleteMember(fd);
    });
  }

  return (
    <tr className={`border-b ${t.rowBorder} ${t.rowHover}`}>
      <td className="px-4 py-3">
        <div className={`font-medium ${t.text}`}>{member.name}</div>
        {member.note && (
          <div className={`mt-0.5 line-clamp-1 text-xs ${t.subtext}`}>
            ⚠ {member.note}
          </div>
        )}
      </td>
      <td className={`px-4 py-3 text-sm ${t.text}`}>
        {member.gender ? GENDER_LABEL[member.gender] : "-"}
      </td>
      <td className={`px-4 py-3 text-sm tabular-nums ${t.text}`}>
        {member.phone ?? "-"}
      </td>
      <td className={`px-4 py-3 text-sm ${t.subtext}`}>
        {member.email ?? <span className="italic">없음</span>}
      </td>
      <td className="px-4 py-3">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] ${
            isActive ? t.pillActive : t.pillPending
          }`}
        >
          {STATUS_LABEL[member.status]}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {!isActive && (
            <>
              <button
                type="button"
                onClick={onSendEmail}
                disabled={pending || !member.email}
                title={
                  member.email
                    ? "Gmail로 활성화 URL 자동 발송"
                    : "이메일이 없는 회원은 URL 복사로 전달"
                }
                className={`h-8 rounded-md px-3 text-xs font-medium transition disabled:opacity-50 ${t.btnPrimary}`}
              >
                {pending && member.email ? "발송 중..." : "메일 발송"}
              </button>
              <button
                type="button"
                onClick={onCopyUrl}
                disabled={pending}
                className={`h-8 rounded-md px-3 text-xs transition disabled:opacity-50 ${t.btn}`}
              >
                {copied ? "✓ 복사됨" : "URL 복사"}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className={`h-8 rounded-md px-3 text-xs transition disabled:opacity-50 ${t.btnDanger}`}
          >
            삭제
          </button>
        </div>
        {feedback && (
          <div
            className={`mt-1.5 text-[11px] ${
              feedback.kind === "ok" ? t.successText : t.errorText
            }`}
          >
            {feedback.message}
          </div>
        )}
      </td>
    </tr>
  );
}
