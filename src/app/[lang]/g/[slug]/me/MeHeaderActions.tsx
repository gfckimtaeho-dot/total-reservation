"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Box, QrCode, X } from "lucide-react";
import { requestAccessQr, type AccessQrResult } from "./actions";

export function MeHeaderActions({
  slug,
  lang,
  memberName,
}: {
  slug: string;
  lang: string;
  memberName: string;
}) {
  const t = useTranslations("me");
  const [qrOpen, setQrOpen] = useState(false);
  const [qrResult, setQrResult] = useState<AccessQrResult | null>(null);
  const [qrPending, startQr] = useTransition();

  function openQr() {
    setQrOpen(true);
    setQrResult(null);
    startQr(async () => {
      const r = await requestAccessQr(slug);
      setQrResult(r);
    });
  }

  const btnCls =
    "inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-zinc-100 backdrop-blur-md transition hover:bg-white/10 active:scale-95";

  return (
    <>
      <div className="flex shrink-0 items-center gap-2">
        <Link href={`/${lang}/g/${slug}/me/holdings`} className={btnCls}>
          <Box size={16} />
          <span>{t("holdingsButton")}</span>
        </Link>
        <button type="button" onClick={openQr} className={btnCls}>
          <QrCode size={16} />
          <span>{t("qrButton")}</span>
        </button>
      </div>

      {qrOpen && (
        <Portal>
          <QrDialog
            result={qrResult}
            pending={qrPending}
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
  pending,
  memberName,
  onClose,
}: {
  result: AccessQrResult | null;
  pending: boolean;
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
      <div className="absolute inset-0 bg-zinc-950/75 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xs rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] ring-1 ring-rose-300/30"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-200/90">
            {t("qrTitle")}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
            aria-label="close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-3 flex flex-col items-center">
          {pending || !result ? (
            <div className="py-12 text-sm text-zinc-400">{t("qrLoading")}</div>
          ) : result.ok ? (
            <>
              <div className="rounded-2xl bg-white p-3 shadow-[0_0_40px_-10px_rgba(252,165,165,0.4)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={result.qr}
                  alt="Access QR"
                  className="block h-48 w-48"
                />
              </div>
              <div className="mt-3 text-center">
                <div className="font-heading text-lg tracking-tight text-white">
                  {memberName}
                </div>
                <div className="mt-1 text-[11px] text-zinc-400">
                  {t("qrHint")}
                </div>
                <div className="mt-0.5 text-[10px] text-zinc-500">
                  {t("qrExpires", { date: result.expiresYmd })}
                </div>
              </div>
            </>
          ) : (
            <div className="py-2 text-center">
              <div className="font-heading text-sm tracking-tight text-amber-200">
                {t("qrNoAccessTitle")}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-300">
                {t("qrNoAccessBody")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
