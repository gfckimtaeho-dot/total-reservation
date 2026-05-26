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

const TK = {
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
  remainingPerService: {
    name: string;
    isGroup: boolean;
    count: string;
  }[];
};

export function MemberRow({
  slug,
  member,
  lang,
}: {
  slug: string;
  member: MemberView;
  lang: string;
}) {
  const t = useTranslations("members");
  const router = useRouter();
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
      className={`cursor-pointer border-b ${TK.rowBorder} ${TK.rowHover}`}
      onClick={() =>
        router.push(`/${lang}/g/${slug}/members/${member.id}`)
      }
    >
      <td className="whitespace-nowrap px-4 py-3 text-left">
        <div className="flex flex-nowrap items-center gap-1.5">
          <span className={`whitespace-nowrap font-medium ${TK.text}`}>
            {member.name}
          </span>
          {member.note && (
            <span className="group relative inline-flex shrink-0">
              <span
                aria-label={member.note}
                className={`cursor-help text-sm leading-none ${TK.noteIcon}`}
              >
                📝
              </span>
              <span
                role="tooltip"
                className="pointer-events-none invisible absolute left-1/2 top-full z-20 mt-1 w-max max-w-xs -translate-x-1/2 whitespace-pre-wrap break-words rounded-md bg-ink px-2.5 py-1.5 text-left text-xs font-normal normal-case tracking-normal text-white opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100"
              >
                {member.note}
              </span>
            </span>
          )}
          {!isActive && (
            <span
              className={`shrink-0 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] ${TK.pillPending}`}
            >
              {t("pendingPill")}
            </span>
          )}
          {!member.active && (
            <span className="shrink-0 whitespace-nowrap rounded-full bg-zinc-200 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
              {t("inactivePill")}
            </span>
          )}
        </div>
        {member.note && (
          <div className={`mt-0.5 line-clamp-1 text-xs md:hidden ${TK.subtext}`}>
            {member.note}
          </div>
        )}
      </td>
      <td className={`px-4 py-3 text-right text-sm tabular-nums ${TK.text}`}>
        {member.age != null ? t("ageUnit", { age: member.age }) : "-"}
      </td>
      <td className={`px-4 py-3 text-right text-sm tabular-nums ${TK.text}`}>
        {member.phone ?? "-"}
      </td>
      <td className={`px-4 py-3 text-left text-sm ${TK.text}`}>
        {member.email ? (
          <span
            className="block max-w-[180px] truncate"
            title={member.email}
          >
            {member.email}
          </span>
        ) : (
          <span className={TK.subtext}>-</span>
        )}
      </td>
      <td className="px-4 py-3 text-center text-sm">
        {member.nextExpiry ? (
          <span
            className={`inline-flex items-center gap-1.5 ${
              member.expiringSoon ? "" : TK.text
            }`}
          >
            <span className={`tabular-nums ${TK.text}`}>
              {member.nextExpiry}
            </span>
            {member.expiringSoon && (
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${TK.pillExpiring}`}
              >
                {t("expiringPill")}
              </span>
            )}
          </span>
        ) : (
          <span className={TK.subtext}>-</span>
        )}
      </td>
      <td
        className={`min-w-[16rem] px-4 py-3 text-right text-sm ${TK.text}`}
      >
        {member.remainingPerService.length === 0 ? (
          <span className={TK.subtext}>-</span>
        ) : (
          <div className="flex flex-wrap justify-end gap-x-3 gap-y-0.5">
            {member.remainingPerService.map((it, i) => (
              <span
                key={i}
                className="whitespace-nowrap font-medium tabular-nums"
              >
                {t(
                  it.isGroup
                    ? "remainingItemGroup"
                    : "remainingItemPersonal",
                  { service: it.name, count: it.count },
                )}
              </span>
            ))}
          </div>
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
            className={`h-8 rounded-md px-3 text-xs font-medium transition disabled:opacity-50 ${TK.btnPrimary}`}
          >
            {pending && member.email ? t("rowSending") : t("rowSendEmail")}
          </button>
          <button
            type="button"
            onClick={onCopyUrl}
            disabled={pending}
            className={`h-8 rounded-md px-3 text-xs transition disabled:opacity-50 ${TK.btn}`}
          >
            {copied ? t("rowCopied") : t("rowCopyUrl")}
          </button>
          <MemberAddDialog
            slug={slug}
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
              member.active ? TK.btnDanger : TK.btnPrimary
            }`}
          >
            {member.active ? t("rowDeactivate") : t("rowActivate")}
          </button>
        </div>
        {feedback && (
          <div
            className={`mt-1.5 text-[11px] ${
              feedback.kind === "ok" ? TK.successText : TK.errorText
            }`}
          >
            {feedback.message}
          </div>
        )}
      </td>
    </tr>
  );
}
