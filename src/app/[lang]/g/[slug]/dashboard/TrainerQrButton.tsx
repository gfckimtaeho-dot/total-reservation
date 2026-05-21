"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { QrCode, X } from "lucide-react";

// 트레이너 출입 QR — 핸드폰 전용(버튼 자체가 md:hidden, 태블릿엔 노출 X).
// QR 이미지는 서버(DashboardTrainer)에서 영구 accessToken 으로 미리 생성해
// 내려받으므로, 버튼은 화면폭과 무관하게 누르면 즉시 모달로 QR 을 띄운다.
export function TrainerQrButton({
  qrDataUrl,
  trainerName,
}: {
  qrDataUrl: string;
  trainerName: string;
}) {
  const t = useTranslations("dashboard");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500/20 to-teal-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-100 ring-1 ring-emerald-400/40 transition hover:from-emerald-500/30 hover:to-teal-500/30 md:hidden"
      >
        <QrCode size={16} />
        <span>{t("trainerQrBtn")}</span>
      </button>

      {open && (
        <Portal>
          <QrDialog
            qrDataUrl={qrDataUrl}
            trainerName={trainerName}
            onClose={() => setOpen(false)}
          />
        </Portal>
      )}
    </>
  );
}

// 헤더 backdrop-blur 가 CSS containing block 을 만들어 fixed 가 갇히는 문제
// 회피 — dialog 를 document.body 로 portal.
function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

function QrDialog({
  qrDataUrl,
  trainerName,
  onClose,
}: {
  qrDataUrl: string;
  trainerName: string;
  onClose: () => void;
}) {
  const t = useTranslations("dashboard");

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
      <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xs overflow-hidden rounded-3xl p-[1.5px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500" />
        <div className="relative rounded-[calc(1.5rem-1.5px)] bg-zinc-950 p-5">
          <div className="flex items-center justify-between">
            <div className="bg-gradient-to-r from-orange-300 to-pink-300 bg-clip-text font-heading text-base tracking-tight text-transparent">
              {t("trainerQrTitle")}
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
            <div className="rounded-xl bg-white p-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="Access QR"
                className="block h-48 w-48"
              />
            </div>
            <div className="mt-3 font-heading text-lg tracking-tight text-white">
              {trainerName}
            </div>
            <p className="mt-2 whitespace-pre-line text-center text-[11px] leading-relaxed text-zinc-400">
              {t("trainerQrHint")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
