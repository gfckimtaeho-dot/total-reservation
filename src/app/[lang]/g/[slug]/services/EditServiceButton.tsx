"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ServiceForm, type ServiceInitial } from "./ServiceForm";

type Tone = "normal" | "black" | "white";

const BUTTON_TONE = {
  normal: "text-ink/70 hover:bg-ink/5",
  black: "text-lime-300 hover:bg-white/5",
  white: "text-violet-700 hover:bg-violet-50",
} as const;

const DIALOG_CARD = {
  normal: "bg-amber-50 border-amber-200/60 text-ink",
  black: "bg-zinc-900 border-white/5 text-zinc-200",
  white: "bg-white border-violet-100 text-ink",
} as const;

const CLOSE_TONE = {
  normal: "text-ink/60 hover:bg-ink/5",
  black: "text-zinc-400 hover:bg-white/5",
  white: "text-zinc-600 hover:bg-zinc-50",
} as const;

export function EditServiceButton({
  slug,
  service,
  tone,
}: {
  slug: string;
  service: ServiceInitial;
  tone: Tone;
}) {
  const t = useTranslations("services.list");
  const tf = useTranslations("services.form");
  const [open, setOpen] = useState(false);

  // ESC 키로 닫기 + body scroll lock — 모달 동안 본문 스크롤 방지.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`rounded px-2 py-1 text-xs font-medium transition ${BUTTON_TONE[tone]}`}
      >
        {t("edit")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            // backdrop 클릭으로 닫기. 내부 click은 propagation stop.
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className={`w-full max-w-2xl overflow-hidden rounded-2xl border shadow-2xl ${DIALOG_CARD[tone]}`}
          >
            <div
              className={`flex items-center justify-between px-6 py-4 ${
                tone === "black"
                  ? "border-b border-white/5"
                  : tone === "white"
                    ? "border-b border-zinc-100"
                    : "border-b border-amber-200/60"
              }`}
            >
              <h2 className="font-heading text-base tracking-tight">
                {tf("editHeading", { name: service.name })}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="close"
                className={`rounded px-2 py-1 text-lg leading-none ${CLOSE_TONE[tone]}`}
              >
                ×
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto p-6">
              <ServiceForm
                slug={slug}
                tone={tone}
                mode="edit"
                service={service}
                onSuccess={() => setOpen(false)}
                hideCard
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
