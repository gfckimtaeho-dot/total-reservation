"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { requestAccessQr, type AccessQrResult } from "./actions";

// 상시 렌더는 자리만 차지 — 큰 버튼 1개, 탭하면 큰 모달(고객 스펙).
export function MeAccessQr({ slug }: { slug: string }) {
  const t = useTranslations("me");
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<AccessQrResult | null>(null);
  const [pending, startTransition] = useTransition();

  function onOpen() {
    setOpen(true);
    setResult(null);
    startTransition(async () => {
      const r = await requestAccessQr(slug);
      setResult(r);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center justify-center rounded-2xl bg-ink px-6 py-6 text-lg font-semibold text-white transition hover:bg-ink/90"
      >
        {t("qrButton")}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center ring-1 ring-amber-200/60">
            {pending || !result ? (
              <div className="py-16 text-sm text-zinc-500">
                {t("qrLoading")}
              </div>
            ) : result.ok ? (
              <>
                <h2 className="font-heading text-xl tracking-tight text-ink">
                  {t("qrTitle")}
                </h2>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={result.qr}
                  alt="Access QR"
                  className="mx-auto mt-4 block h-64 w-64"
                />
                <p className="mt-3 text-sm text-zinc-700">{t("qrHint")}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {t("qrExpires", { date: result.expiresYmd })}
                </p>
              </>
            ) : (
              <>
                <h2 className="font-heading text-lg tracking-tight text-ink">
                  {t("qrNoAccessTitle")}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-zinc-600">
                  {t("qrNoAccessBody")}
                </p>
              </>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-6 h-10 w-full rounded-md border border-amber-200/60 bg-white text-sm text-zinc-700 transition hover:border-ink"
            >
              {t("qrClose")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
