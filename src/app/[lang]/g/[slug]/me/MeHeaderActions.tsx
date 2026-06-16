"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Box, QrCode, X } from "lucide-react";
import type { AccessQrResult } from "./actions";

export function MeHeaderActions({
  slug,
  lang,
  memberName,
  qrInitial,
}: {
  slug: string;
  lang: string;
  memberName: string;
  // 페이지 렌더(SSR) 시점에 미리 발급된 QR — 탭 즉시 표시용.
  qrInitial: AccessQrResult;
}) {
  const t = useTranslations("me");
  const [qrOpen, setQrOpen] = useState(false);

  const btnCls =
    "inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full border border-orange-200 bg-white px-4 py-2 text-xs font-medium text-orange-700 transition hover:bg-orange-50 active:scale-95";

  return (
    <>
      <div className="flex shrink-0 items-center gap-2">
        <Link href={`/${lang}/g/${slug}/me/holdings`} className={btnCls}>
          <Box size={16} />
          <span>{t("holdingsButton")}</span>
        </Link>
        <button type="button" onClick={() => setQrOpen(true)} className={btnCls}>
          <QrCode size={16} />
          <span>{t("qrButton")}</span>
        </button>
      </div>

      {qrOpen && (
        <Portal>
          <QrDialog
            result={qrInitial}
            memberName={memberName}
            onClose={() => setQrOpen(false)}
          />
        </Portal>
      )}
    </>
  );
}

// 헤더의 backdrop-blur가 CSS containing block을 만들어 fixed가 헤더에 갇히는
// 문제를 회피 — dialog를 document.body에 portal로 띄움.
function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

function QrDialog({
  result,
  memberName,
  onClose,
}: {
  result: AccessQrResult;
  memberName: string;
  onClose: () => void;
}) {
  const t = useTranslations("me");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-3xl border border-orange-200/80 bg-white p-5 shadow-[0_30px_80px_-20px_rgba(249,115,22,0.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-600">
            {t("qrTitle")}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-zinc-500 hover:bg-orange-50 hover:text-orange-700"
            aria-label="close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-3 flex flex-col items-center">
          {result.ok ? (
            <>
              <div className="rounded-2xl bg-gradient-to-br from-orange-50 to-rose-50 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={result.qr}
                  alt="Access QR"
                  className="block h-72 w-72"
                />
              </div>
              <div className="mt-3 text-center">
                <div className="font-heading text-lg font-bold tracking-tight text-zinc-900">
                  {memberName}
                </div>
                <div className="mt-1 text-[11px] text-zinc-500">
                  {t("qrHint")}
                </div>
                <div className="mt-0.5 text-[10px] tabular-nums text-orange-600">
                  {t("qrExpires", { date: result.expiresYmd })}
                </div>
              </div>
            </>
          ) : (
            <div className="py-2 text-center">
              <div className="font-heading text-sm tracking-tight text-amber-700">
                {t("qrNoAccessTitle")}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                {t("qrNoAccessBody")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
