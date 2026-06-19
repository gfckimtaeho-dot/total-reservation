"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { NativePickerInput } from "@/components/NativePickerInput";
import { addLeave, removeLeave } from "../actions";

type Leave = {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
};

type Tone = "normal" | "black" | "white" | "indigo";

const TONE = {
  normal: {
    addBtn: "bg-ink text-white hover:bg-ink/90",
    deleteBtn: "text-zinc-500 hover:text-red-600",
    modalBg: "bg-white",
    modalRing: "ring-amber-200/60",
    title: "text-ink",
    label: "text-ink",
    subtle: "text-zinc-600",
    input:
      "h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20",
    cancelBtn: "text-zinc-600 hover:text-ink",
    submitBtn: "bg-ink text-white hover:bg-ink/90",
    error: "text-red-600",
  },
  black: {
    addBtn: "bg-amber-300 text-zinc-950 hover:bg-amber-200",
    deleteBtn: "text-zinc-500 hover:text-red-400",
    modalBg: "bg-zinc-900",
    modalRing: "ring-white/10",
    title: "text-white",
    label: "text-zinc-100",
    subtle: "text-zinc-400",
    input:
      "h-10 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30 [color-scheme:dark]",
    cancelBtn: "text-zinc-400 hover:text-zinc-100",
    submitBtn: "bg-amber-300 text-zinc-950 hover:bg-amber-200",
    error: "text-red-400",
  },
  white: {
    addBtn: "bg-violet-600 text-white hover:bg-violet-700",
    deleteBtn: "text-zinc-500 hover:text-red-600",
    modalBg: "bg-white",
    modalRing: "ring-violet-100",
    title: "text-ink",
    label: "text-ink",
    subtle: "text-zinc-600",
    input:
      "h-10 rounded-md border border-violet-200 bg-white px-3 text-sm text-zinc-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20",
    cancelBtn: "text-zinc-600 hover:text-violet-600",
    submitBtn: "bg-violet-600 text-white hover:bg-violet-700",
    error: "text-red-600",
  },
  indigo: {
    addBtn: "bg-indigo-600 text-white hover:bg-indigo-700",
    deleteBtn: "text-zinc-500 hover:text-red-600",
    modalBg: "bg-white",
    modalRing: "ring-zinc-200",
    title: "text-zinc-900",
    label: "text-zinc-900",
    subtle: "text-zinc-500",
    input:
      "h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20",
    cancelBtn: "text-zinc-600 hover:text-indigo-600",
    submitBtn: "bg-indigo-600 text-white hover:bg-indigo-700",
    error: "text-red-600",
  },
} as const;

export function LeaveManager({
  lang,
  slug,
  staffId,
  tone,
  leaves,
}: {
  lang: string;
  slug: string;
  staffId: string;
  tone: Tone;
  leaves: Leave[];
}) {
  const t = useTranslations("trainers");
  const tk = TONE[tone];

  const [open, setOpen] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    if (!start || !end) {
      setError(t("leaveDateInvalid"));
      return;
    }
    if (end < start) {
      setError(t("leaveDateInvalid"));
      return;
    }
    const fd = new FormData();
    fd.set("slug", slug);
    fd.set("staffId", staffId);
    fd.set("startDate", start);
    fd.set("endDate", end);
    fd.set("reason", reason);
    startTransition(async () => {
      const res = await addLeave(undefined, fd);
      if (res?.errors) {
        const first = Object.values(res.errors)[0]?.[0];
        if (first) setError(first);
        return;
      }
      setOpen(false);
      setStart("");
      setEnd("");
      setReason("");
    });
  }

  function deleteLeave(leaveId: string) {
    const fd = new FormData();
    fd.set("slug", slug);
    fd.set("leaveId", leaveId);
    startTransition(async () => {
      await removeLeave(fd);
    });
  }

  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={`text-lg font-semibold tracking-tight ${tk.title}`}>
          {t("detailLeaves")}
        </h2>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`inline-flex h-9 items-center rounded-md px-3 text-xs font-medium transition ${tk.addBtn}`}
        >
          {t("leaveAdd")}
        </button>
      </div>

      {leaves.length === 0 ? (
        <p className={`mt-4 text-sm ${tk.subtle}`}>{t("detailNoLeaves")}</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {leaves.map((l) => (
            <li
              key={l.id}
              className={`flex items-center justify-between rounded-md px-3 py-2 ${
                tone === "black" ? "bg-zinc-950/60" : "bg-zinc-50"
              }`}
            >
              <span className={`tabular-nums ${tk.label}`}>
                {l.startDate} ~ {l.endDate}
                {l.reason && (
                  <span className={`ml-2 text-xs ${tk.subtle}`}>
                    · {l.reason}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => deleteLeave(l.id)}
                disabled={pending}
                className={`text-xs ${tk.deleteBtn} disabled:opacity-50`}
              >
                {t("leaveDelete")}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className={`w-full max-w-md rounded-2xl p-6 ring-1 ${tk.modalBg} ${tk.modalRing}`}
          >
            <h3 className={`text-lg font-semibold tracking-tight ${tk.title}`}>
              {t("leaveModalTitle")}
            </h3>

            <div className="mt-5 space-y-4">
              <label className="flex flex-col gap-1.5">
                <span className={`text-xs font-medium ${tk.label}`}>
                  {t("leaveStartDate")}
                </span>
                <NativePickerInput
                  type="date"
                  lang={lang}
                  value={start}
                  onChange={(e) => setStart(e.currentTarget.value)}
                  className={tk.input}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className={`text-xs font-medium ${tk.label}`}>
                  {t("leaveEndDate")}
                </span>
                <NativePickerInput
                  type="date"
                  lang={lang}
                  value={end}
                  onChange={(e) => setEnd(e.currentTarget.value)}
                  className={tk.input}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className={`text-xs font-medium ${tk.label}`}>
                  {t("leaveReason")}
                </span>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.currentTarget.value)}
                  placeholder={t("leaveReasonPlaceholder")}
                  className={tk.input}
                />
              </label>

              {error && <p className={`text-xs ${tk.error}`}>{error}</p>}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className={`text-sm transition ${tk.cancelBtn} disabled:opacity-50`}
              >
                {t("leaveCancel")}
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className={`inline-flex h-10 items-center rounded-md px-5 text-sm font-medium transition ${tk.submitBtn} disabled:opacity-50`}
              >
                {pending ? t("leaveSaving") : t("leaveSave")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
