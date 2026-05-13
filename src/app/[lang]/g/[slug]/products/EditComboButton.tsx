"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ComboPlanForm,
  type ComboPlanInitial,
  type ComboMembershipOption,
  type ComboPackageOption,
} from "./ComboPlanForm";

type Tone = "normal" | "black" | "white";

const TONE_BTN = {
  normal: "text-ink/70 hover:text-ink",
  black: "text-zinc-400 hover:text-lime-300",
  white: "text-zinc-600 hover:text-violet-700",
} as const;

const TONE_PANEL = {
  normal: "bg-white border-amber-200/60",
  black: "bg-zinc-900 border-white/10",
  white: "bg-lime-50 border-lime-200/50",
} as const;

export function EditComboButton({
  slug,
  plan,
  membershipPlans,
  packagePlans,
  tone,
}: {
  slug: string;
  plan: ComboPlanInitial;
  membershipPlans: ComboMembershipOption[];
  packagePlans: ComboPackageOption[];
  tone: Tone;
}) {
  const t = useTranslations("products.combo");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-xs font-medium transition ${TONE_BTN[tone]}`}
      >
        {t("edit")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className={`w-full max-w-xl overflow-hidden rounded-2xl border ${TONE_PANEL[tone]}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-current/10 px-5 py-4">
              <h3 className="font-heading text-base tracking-tight">
                {t("editHeading")}
              </h3>
            </div>
            <div className="max-h-[80vh] overflow-y-auto p-5">
              <ComboPlanForm
                slug={slug}
                tone={tone}
                membershipPlans={membershipPlans}
                packagePlans={packagePlans}
                mode="edit"
                plan={plan}
                hideCard
                onSuccess={() => setOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
