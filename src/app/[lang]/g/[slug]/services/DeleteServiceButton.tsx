"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { deleteService } from "./actions";

type Tone = "normal" | "black" | "white";

const BUTTON_TONE = {
  normal: "text-rose-600 hover:bg-rose-50",
  black: "text-rose-400 hover:bg-rose-500/10",
  white: "text-rose-600 hover:bg-rose-50",
} as const;

const ERROR_TONE = {
  normal: "text-rose-600",
  black: "text-rose-400",
  white: "text-rose-600",
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
  const te = useTranslations("services.errors");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    if (!confirm(`${serviceName} — ${t("delete")}?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteService(slug, serviceId);
      if ("error" in res) {
        const msg =
          res.error === "hasReferences"
            ? te("hasReferences", {
                plans: res.refs.plans,
                packages: res.refs.packages,
                reservations: res.refs.reservations,
              })
            : te("permission");
        setError(msg);
      }
    });
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className={`rounded px-2 py-1 text-xs font-medium transition disabled:opacity-50 ${BUTTON_TONE[tone]}`}
      >
        {pending ? t("deleting") : t("delete")}
      </button>
      {error && (
        <div className={`mt-1 text-[10px] ${ERROR_TONE[tone]}`}>{error}</div>
      )}
    </div>
  );
}
