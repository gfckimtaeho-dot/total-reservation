"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const KEY = "pwaHintDismissed";

// 한 번 닫거나 standalone(홈 화면에서 열림)이면 더 안 보임.
// 삼성 인터넷 안내 포함 — 사용자 기본 브라우저.
export function PwaCard() {
  const t = useTranslations("me");
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const standalone =
        window.matchMedia?.("(display-mode: standalone)").matches ?? false;
      if (standalone) return;
      const dismissed = window.localStorage.getItem(KEY) === "1";
      if (dismissed) return;
    } catch {
      // localStorage 차단 환경(시크릿/저장소 비활성)에서도 안내는 보이게.
    }
    setShow(true);
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      // ignore
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="relative rounded-3xl border border-orange-200/60 bg-white/90 p-6 backdrop-blur">
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("pwaCardClose")}
        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-orange-50 hover:text-orange-700"
      >
        ×
      </button>
      <h3 className="pr-8 font-heading text-sm tracking-tight text-zinc-900">
        {t("pwaCardTitle")}
      </h3>
      <p className="mt-2 pr-2 text-xs leading-relaxed text-zinc-600">
        {t("pwaCardBody")}
      </p>
    </div>
  );
}
