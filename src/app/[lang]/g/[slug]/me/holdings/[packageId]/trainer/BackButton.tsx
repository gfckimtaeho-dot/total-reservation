"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

// 다중 진입 라우트의 뒤로가기 — 브라우저 history 있으면 그쪽 우선,
// deep link/PWA cold start 등 history 비면 fallbackHref 로.
export function BackButton({
  fallbackHref,
  ariaLabel,
}: {
  fallbackHref: string;
  ariaLabel: string;
}) {
  const router = useRouter();

  function onClick() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-orange-200 bg-white text-orange-700 hover:bg-orange-50"
      aria-label={ariaLabel}
    >
      <ChevronLeft size={18} />
    </button>
  );
}
