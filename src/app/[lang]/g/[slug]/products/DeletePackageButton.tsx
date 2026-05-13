"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { deletePackagePlan } from "./actions";

type Tone = "normal" | "black" | "white";

const TONE_BTN = {
  normal: "text-rose-600 hover:text-rose-700",
  black: "text-rose-400 hover:text-rose-300",
  white: "text-rose-600 hover:text-rose-700",
} as const;

export function DeletePackageButton({
  slug,
  planId,
  planName,
  tone,
}: {
  slug: string;
  planId: string;
  planName: string;
  tone: Tone;
}) {
  const t = useTranslations("products.package");
  const te = useTranslations("products.package.errors");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    if (!confirm(t("deleteConfirm", { name: planName }))) return;
    setError(null);
    startTransition(async () => {
      const res = await deletePackagePlan(slug, planId);
      if (res.error === "hasInComboPlan") setError(te("hasInComboPlan"));
      else if (res.error) setError(te("permission"));
    });
  }

  return (
    <span className="inline-flex flex-col gap-0.5">
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className={`text-xs font-medium transition disabled:opacity-50 ${TONE_BTN[tone]}`}
      >
        {t("delete")}
      </button>
      {error && <span className="text-[10px] text-rose-600">{error}</span>}
    </span>
  );
}
