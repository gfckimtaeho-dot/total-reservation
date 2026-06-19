"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { deletePromotion } from "./actions";

type Tone = "normal" | "black" | "white" | "indigo";

const TONE_BTN = {
  normal: "text-rose-600 hover:text-rose-700",
  black: "text-rose-400 hover:text-rose-300",
  white: "text-rose-600 hover:text-rose-700",
  indigo: "text-rose-600 hover:text-rose-700",
} as const;

export function DeletePromotionButton({
  slug,
  promotionId,
  promotionName,
  tone,
}: {
  slug: string;
  promotionId: string;
  promotionName: string;
  tone: Tone;
}) {
  const t = useTranslations("products.promotion");
  const te = useTranslations("products.promotion.errors");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    if (!confirm(t("deleteConfirm", { name: promotionName }))) return;
    setError(null);
    startTransition(async () => {
      const res = await deletePromotion(slug, promotionId);
      if (res.error) setError(te("permission"));
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
