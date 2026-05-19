"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  copyActivationUrl,
  setMemberActive,
  sendActivationEmail,
} from "./actions";
import { MemberAddDialog } from "./MemberAddDialog";

type Tone = "normal" | "black" | "white";

const TONE_TOKENS = {
  normal: {
    rowBorder: "border-amber-200/60",
    rowHover: "hover:bg-amber-50/40",
    text: "text-ink",
    subtext: "text-zinc-600",
    pillPending: "bg-amber-100 text-amber-900/80",
    pillActive: "bg-band/60 text-ink",
    pillExpiring: "bg-rose-100 text-rose-700",
    btn: "border border-amber-200/60 bg-white text-ink hover:border-ink",
    btnPrimary: "bg-ink text-white hover:bg-ink/90",
    btnDanger: "border border-rose-300 bg-white text-rose-600 hover:bg-rose-50",
    successText: "text-emerald-700",
    errorText: "text-rose-600",
    noteIcon: "text-rose-600",
  },
  black: {
    rowBorder: "border-white/10",
    rowHover: "hover:bg-white/5",
    text: "text-white",
    subtext: "text-zinc-400",
    pillPending: "bg-amber-300/20 text-amber-300",
    pillActive: "bg-lime-300/20 text-lime-300",
    pillExpiring: "bg-rose-500/20 text-rose-300",
    btn: "border border-white/10 bg-zinc-800 text-zinc-200 hover:border-lime-300",
    btnPrimary: "bg-lime-300 text-zinc-950 hover:bg-lime-200",
    btnDanger: "border border-rose-500/40 bg-zinc-800 text-rose-300 hover:bg-rose-500/10",
    successText: "text-lime-300",
    errorText: "text-rose-400",
    noteIcon: "text-rose-300",
  },
  white: {
    rowBorder: "border-violet-100",
    rowHover: "hover:bg-violet-50",
    text: "text-ink",
    subtext: "text-zinc-600",
    pillPending: "bg-amber-100 text-amber-800",
    pillActive: "bg-violet-100 text-violet-800",
    pillExpiring: "bg-rose-100 text-rose-700",
    btn: "border border-violet-200 bg-white text-zinc-700 hover:border-violet-500",
    btnPrimary: "bg-violet-600 text-white hover:bg-violet-700",
    btnDanger: "border border-rose-300 bg-white text-rose-600 hover:bg-rose-50",
    successText: "text-emerald-700",
    errorText: "text-rose-600",
    noteIcon: "text-rose-600",
  },
} as const;

export type MemberView = {
  id: string;
  name: string;
  gender: "MALE" | "FEMALE" | null;
  phone: string | null;
  email: string | null;
  age: number | null;
  dob: string | null;
  emergencyContactPhone: string | null;
  locale: "en" | "ko";
  active: boolean;
  note: string | null;
  status: "PENDING" | "ACTIVE" | "WITHDRAWN" | "ANONYMIZED";
  nextExpiry: string | null;
  expiringSoon: boolean;
  remainingSessions: string;
};

export function MemberRow({
  slug,
  member,
  tone,
  lang,
}: {
  slug: string;
  member: MemberView;
  tone: Tone;
  lang: string;
}) {
  const t = useTranslations("members");
  const router = useRouter();
  const tk = TONE_TOKENS[tone];
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
      if (res.ok)
        showFeedback("ok", t("rowSendOk", { email: member.email ?? "" }));
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
        showFeedback("ok", t("rowCopyOk"));
      } else {
        showFeedback("err", res.message);
      }
    });
  }

  function onToggleActive() {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("slug", slug);
      fd.append("memberId", member.id);
      fd.append("active", member.active ? "false" : "true");
      await setMemberActive(fd);
      router.refresh();
    });
  }

  return (
    <tr
      className={`cursor-pointer border-b ${tk.rowBorder} ${tk.rowHover}`}
      onClick={() =>
        router.push(`/${lang}/g/${slug}/members/${member.id}`)
      }
    >
      <td className="px-4 py-3 text-left">
        <div className="flex items-center gap-1.5">
          <span className={`font-medium ${tk.text}`}>{member.name}</span>
          {member.note && (
            <span
              title={`⚠ ${member.note}`}
              className={`cursor-help text-xs ${tk.noteIcon}`}
            >
              ⚠
            </span>
          )}
          {!isActive && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] ${tk.pillPending}`}
            >
              {t("pendingPill")}
            </span>
          )}
          {!member.active && (
            <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
              {t("inactivePill")}
            </span>
          )}
        </div>
        {member.note && (
          <div className={`mt-0.5 line-clamp-1 text-xs ${tk.subtext}`}>
            {member.note}
          </div>
        )}
      </td>
      <td className={`px-4 py-3 text-right text-sm tabular-nums ${tk.text}`}>
        {member.age != null ? t("ageUnit", { age: member.age }) : "-"}
      </td>
      <td className={`px-4 py-3 text-right text-sm tabular-nums ${tk.text}`}>
        {member.phone ?? "-"}
      </td>
      <td className={`px-4 py-3 text-left text-sm ${tk.text}`}>
        {member.email ? (
          <span
            className="block max-w-[180px] truncate"
            title={member.email}
          >
            {member.email}
          </span>
        ) : (
          <span className={tk.subtext}>-</span>
        )}
      </td>
      <td className="px-4 py-3 text-center text-sm">
        {member.nextExpiry ? (
          <span
            className={`inline-flex items-center gap-1.5 ${
              member.expiringSoon ? "" : tk.text
            }`}
          >
            <span className={`tabular-nums ${tk.text}`}>
              {member.nextExpiry}
            </span>
            {member.expiringSoon && (
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${tk.pillExpiring}`}
              >
                {t("expiringPill")}
              </span>
            )}
          </span>
        ) : (
          <span className={tk.subtext}>-</span>
        )}
      </td>
      <td className={`px-4 py-3 text-right text-sm tabular-nums ${tk.text}`}>
        {member.remainingSessions !== "0.0" ? (
          <span className="font-medium">
            {t("remainingUnit", { count: member.remainingSessions })}
          </span>
        ) : (
          <span className={tk.subtext}>-</span>
        )}
      </td>
      <td
        className="px-4 py-3 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onSendEmail}
            disabled={pending || !member.email}
            title={
              member.email
                ? t("rowSendTooltip")
                : t("rowSendTooltipNoEmail")
            }
            className={`h-8 rounded-md px-3 text-xs font-medium transition disabled:opacity-50 ${tk.btnPrimary}`}
          >
            {pending && member.email ? t("rowSending") : t("rowSendEmail")}
          </button>
          <button
            type="button"
            onClick={onCopyUrl}
            disabled={pending}
            className={`h-8 rounded-md px-3 text-xs transition disabled:opacity-50 ${tk.btn}`}
          >
            {copied ? t("rowCopied") : t("rowCopyUrl")}
          </button>
          <MemberAddDialog
            slug={slug}
            tone={tone}
            lang={lang}
            mode="edit"
            member={{
              id: member.id,
              name: member.name,
              gender: member.gender,
              phone: member.phone,
              email: member.email,
              dob: member.dob,
              emergencyContactPhone: member.emergencyContactPhone,
              note: member.note,
              locale: member.locale,
            }}
          />
          <button
            type="button"
            onClick={onToggleActive}
            disabled={pending}
            className={`h-8 rounded-md px-3 text-xs transition disabled:opacity-50 ${
              member.active ? tk.btnDanger : tk.btnPrimary
            }`}
          >
            {member.active ? t("rowDeactivate") : t("rowActivate")}
          </button>
        </div>
        {feedback && (
          <div
            className={`mt-1.5 text-[11px] ${
              feedback.kind === "ok" ? tk.successText : tk.errorText
            }`}
          >
            {feedback.message}
          </div>
        )}
      </td>
    </tr>
  );
}
