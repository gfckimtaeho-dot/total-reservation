"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { regenerateTrainerAccessToken } from "../actions";

type Tone = "normal" | "black" | "white";

const BTN = {
  normal: "border border-amber-200/60 bg-white text-ink hover:border-ink",
  black:
    "border border-white/10 bg-zinc-800 text-zinc-200 hover:border-lime-300",
  white: "border border-zinc-300 bg-white text-zinc-700 hover:border-ink",
} as const;

export function RegenerateQrButton({
  slug,
  staffId,
  tone,
}: {
  slug: string;
  staffId: string;
  tone: Tone;
}) {
  const t = useTranslations("trainers");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    kind: "ok" | "err";
    message: string;
  } | null>(null);

  function onClick() {
    if (!confirm(t("qrRegenerateConfirm"))) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.append("slug", slug);
      fd.append("staffId", staffId);
      const res = await regenerateTrainerAccessToken(fd);
      if (res.ok) {
        setFeedback({ kind: "ok", message: t("qrRegenerateOk") });
        router.refresh();
      } else {
        setFeedback({
          kind: "err",
          message: res.message ?? t("qrRegenerateErr"),
        });
      }
      setTimeout(() => setFeedback(null), 3500);
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className={`h-9 rounded-md px-3 text-xs transition disabled:opacity-50 ${BTN[tone]}`}
      >
        {pending ? t("qrRegenerating") : t("qrRegenerate")}
      </button>
      {feedback && (
        <span
          className={`text-[11px] ${
            feedback.kind === "ok"
              ? tone === "black"
                ? "text-lime-300"
                : "text-emerald-700"
              : tone === "black"
                ? "text-rose-400"
                : "text-rose-600"
          }`}
        >
          {feedback.message}
        </span>
      )}
    </div>
  );
}
