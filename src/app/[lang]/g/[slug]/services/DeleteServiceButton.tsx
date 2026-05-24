"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ServiceDeleteDialog } from "./ServiceDeleteDialog";

type Tone = "normal" | "black" | "white";

const BUTTON_TONE = {
  normal: "text-rose-600 hover:bg-rose-50",
  black: "text-rose-400 hover:bg-rose-500/10",
  white: "text-rose-600 hover:bg-rose-50",
} as const;

export function DeleteServiceButton({
  slug,
  serviceId,
  serviceName,
  tone,
}: {
  slug: string;
  serviceId: string;
  serviceName: string;
  tone: Tone;
}) {
  const t = useTranslations("services.list");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onDeleted() {
    setOpen(false);
    startTransition(() => {
      // 서버 액션이 revalidatePath 로 무효화한 뒤 페이지가 자동 갱신되도록 transition 으로 묶음.
      // dialog 닫힘 + state flush 가 같은 batch 에 진행.
    });
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending}
        className={`rounded px-2 py-1 text-xs font-medium transition disabled:opacity-50 ${BUTTON_TONE[tone]}`}
      >
        {t("delete")}
      </button>
      {open && (
        <ServiceDeleteDialog
          slug={slug}
          serviceId={serviceId}
          serviceName={serviceName}
          onClose={() => setOpen(false)}
          onDeleted={onDeleted}
        />
      )}
    </div>
  );
}
