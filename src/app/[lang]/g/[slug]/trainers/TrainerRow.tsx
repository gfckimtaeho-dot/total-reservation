"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  copyTrainerActivationUrl,
  deleteTrainer,
  sendTrainerActivationEmail,
} from "./actions";

type Tone = "normal" | "black" | "white";
type Weekday = "SUN" | "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";

const TONE = {
  normal: {
    rowBorder: "border-amber-200/60",
    rowHover: "hover:bg-amber-50/40",
    text: "text-ink",
    subtext: "text-zinc-600",
    pillTrainer: "bg-band/60 text-ink",
    pillManager: "bg-amber-100 text-amber-900/80",
    statusWorking: "bg-emerald-100 text-emerald-800",
    statusOff: "bg-rose-100 text-rose-800",
    statusLeave: "bg-rose-100 text-rose-700",
    weekdayOn: "bg-emerald-500 text-white",
    weekdayOff: "bg-rose-200 text-rose-800",
    btn: "border border-amber-200/60 bg-white text-ink hover:border-ink",
    btnPrimary: "bg-ink text-white hover:bg-ink/90",
    btnDanger: "border border-rose-300 bg-white text-rose-600 hover:bg-rose-50",
    successText: "text-emerald-700",
    errorText: "text-rose-600",
    photoFallback: "bg-amber-100 text-amber-900/60",
  },
  black: {
    rowBorder: "border-white/10",
    rowHover: "hover:bg-white/5",
    text: "text-white",
    subtext: "text-zinc-400",
    pillTrainer: "bg-lime-300/20 text-lime-300",
    pillManager: "bg-amber-300/20 text-amber-300",
    statusWorking: "bg-lime-300/20 text-lime-300",
    statusOff: "bg-rose-500/20 text-rose-300",
    statusLeave: "bg-rose-500/20 text-rose-300",
    weekdayOn: "bg-lime-300 text-zinc-950",
    weekdayOff: "bg-rose-500/30 text-rose-200",
    btn: "border border-white/10 bg-zinc-800 text-zinc-200 hover:border-lime-300",
    btnPrimary: "bg-lime-300 text-zinc-950 hover:bg-lime-200",
    btnDanger:
      "border border-rose-500/40 bg-zinc-800 text-rose-300 hover:bg-rose-500/10",
    successText: "text-lime-300",
    errorText: "text-rose-400",
    photoFallback: "bg-zinc-800 text-zinc-500",
  },
  white: {
    rowBorder: "border-zinc-200",
    rowHover: "hover:bg-zinc-50",
    text: "text-ink",
    subtext: "text-zinc-600",
    pillTrainer: "bg-sky-100 text-sky-900",
    pillManager: "bg-amber-100 text-amber-800",
    statusWorking: "bg-emerald-100 text-emerald-800",
    statusOff: "bg-rose-100 text-rose-800",
    statusLeave: "bg-rose-100 text-rose-700",
    weekdayOn: "bg-sky-700 text-white",
    weekdayOff: "bg-rose-200 text-rose-800",
    btn: "border border-zinc-300 bg-white text-zinc-700 hover:border-ink",
    btnPrimary: "bg-ink text-white hover:bg-ink/90",
    btnDanger: "border border-rose-300 bg-white text-rose-600 hover:bg-rose-50",
    successText: "text-emerald-700",
    errorText: "text-rose-600",
    photoFallback: "bg-zinc-100 text-zinc-500",
  },
} as const;

const ALL_WEEKDAYS: Weekday[] = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
];

export type TrainerView = {
  staffId: string;
  userId: string;
  name: string;
  role: "TRAINER" | "MANAGER";
  phone: string | null;
  email: string | null;
  primaryPhotoUrl: string | null;
  specialties: ("HEALTH" | "YOGA" | "PILATES" | "DANCE")[];
  customSpecialty: string | null;
  weeklyOffDays: Weekday[];
  todayStatus: "WORKING" | "REGULAR_OFF" | "PERSONAL_OFF";
  status: "PENDING" | "ACTIVE" | "WITHDRAWN" | "ANONYMIZED";
};

export function TrainerRow({
  lang,
  slug,
  trainer,
  tone,
}: {
  lang: string;
  slug: string;
  trainer: TrainerView;
  tone: Tone;
}) {
  const t = useTranslations("trainers");
  const router = useRouter();
  const tk = TONE[tone];
  const [feedback, setFeedback] = useState<{
    kind: "ok" | "err";
    message: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const isActive = trainer.status === "ACTIVE";

  function showFeedback(kind: "ok" | "err", message: string) {
    setFeedback({ kind, message });
    setTimeout(() => setFeedback(null), 3500);
  }

  function onSendEmail() {
    if (!trainer.email) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.append("slug", slug);
      fd.append("staffId", trainer.staffId);
      const res = await sendTrainerActivationEmail(fd);
      if (res.ok)
        showFeedback("ok", t("rowSendOk", { email: trainer.email ?? "" }));
      else showFeedback("err", res.message);
    });
  }

  function onCopyUrl() {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("slug", slug);
      fd.append("staffId", trainer.staffId);
      const res = await copyTrainerActivationUrl(fd);
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

  function onDelete() {
    if (!confirm(t("rowDeleteConfirm", { name: trainer.name }))) return;
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.append("slug", slug);
        fd.append("staffId", trainer.staffId);
        const res = await deleteTrainer(fd);
        if (res && !res.ok) {
          showFeedback("err", res.message ?? "삭제 실패");
          return;
        }
        router.refresh();
      } catch (err) {
        const m = err instanceof Error ? err.message : "삭제 실패";
        showFeedback("err", m);
      }
    });
  }

  const allSpecs = [
    ...trainer.specialties.map((s) => t(`specialty.${s}`)),
    ...(trainer.customSpecialty ? [trainer.customSpecialty] : []),
  ].join(" / ");

  const offSet = new Set(trainer.weeklyOffDays);

  const statusKey =
    trainer.todayStatus === "WORKING"
      ? "statusWorking"
      : trainer.todayStatus === "REGULAR_OFF"
        ? "statusOff"
        : "statusLeave";
  const statusClass =
    trainer.todayStatus === "WORKING"
      ? tk.statusWorking
      : trainer.todayStatus === "REGULAR_OFF"
        ? tk.statusOff
        : tk.statusLeave;

  return (
    <tr
      className={`cursor-pointer border-b ${tk.rowBorder} ${tk.rowHover}`}
      onClick={() => router.push(`/${lang}/g/${slug}/trainers/${trainer.staffId}`)}
    >
      <td className="px-4 py-3 text-center">
        {trainer.primaryPhotoUrl ? (
          <img
            src={trainer.primaryPhotoUrl}
            alt={trainer.name}
            className="mx-auto h-10 w-10 rounded-full object-cover ring-1 ring-zinc-300"
          />
        ) : (
          <div
            className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full text-xs font-medium ${tk.photoFallback}`}
          >
            {trainer.name.slice(0, 1)}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-left">
        <span className={`font-medium ${tk.text}`}>{trainer.name}</span>
        {!isActive && (
          <span
            className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] ${tk.statusOff}`}
          >
            PEND
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            trainer.role === "MANAGER" ? tk.pillManager : tk.pillTrainer
          }`}
        >
          {t(trainer.role === "MANAGER" ? "roleManager" : "roleTrainer")}
        </span>
      </td>
      <td className={`px-4 py-3 text-center text-xs ${tk.subtext}`}>
        {allSpecs || "-"}
      </td>
      <td className="px-4 py-3 text-center">
        <div className="inline-flex gap-0.5">
          {ALL_WEEKDAYS.map((w) => {
            const isOff = offSet.has(w);
            return (
              <span
                key={w}
                className={`flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold ${
                  isOff ? tk.weekdayOff : tk.weekdayOn
                }`}
                title={t(`weekday.${w}`)}
              >
                {t(`weekday.${w}`)}
              </span>
            );
          })}
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClass}`}
        >
          {t(statusKey)}
        </span>
      </td>
      <td className={`px-4 py-3 text-right text-sm tabular-nums ${tk.text}`}>
        {trainer.phone ?? "-"}
      </td>
      <td className="px-4 py-3 text-left" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onSendEmail}
            disabled={pending || !trainer.email}
            className={`h-8 rounded-md px-3 text-xs font-medium transition disabled:opacity-50 ${tk.btnPrimary}`}
          >
            {pending && trainer.email ? t("rowSending") : t("rowSendEmail")}
          </button>
          <button
            type="button"
            onClick={onCopyUrl}
            disabled={pending}
            className={`h-8 rounded-md px-3 text-xs transition disabled:opacity-50 ${tk.btn}`}
          >
            {copied ? t("rowCopied") : t("rowCopyUrl")}
          </button>
          <Link
            href={`/${lang}/g/${slug}/trainers/${trainer.staffId}/edit`}
            className={`inline-flex h-8 items-center rounded-md px-3 text-xs transition ${tk.btn}`}
          >
            {t("rowEdit")}
          </Link>
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className={`h-8 rounded-md px-3 text-xs transition disabled:opacity-50 ${tk.btnDanger}`}
          >
            {t("rowDelete")}
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
