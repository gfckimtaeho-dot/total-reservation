"use client";

import { useEffect, useState } from "react";

type DeferredPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInstallCard() {
  const [deferred, setDeferred] = useState<DeferredPrompt | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as DeferredPrompt);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function onInstall() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setDeferred(null);
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
      <h3 className="font-heading text-xl tracking-tight text-ink">
        홈 화면에 추가
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600">
        브라우저 메뉴에서 &ldquo;홈 화면에 추가&rdquo;를 눌러 매장 운영 앱처럼
        사용하세요. 풀스크린·아이콘이 활성화되며 V1 출시 후엔 푸시 알림도
        받습니다.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {installed ? (
          <span className="text-xs font-medium text-emerald-700">
            ✓ 설치됨
          </span>
        ) : deferred ? (
          <button
            onClick={onInstall}
            className="inline-flex h-9 items-center rounded-md bg-ink px-4 text-xs font-medium text-white transition hover:bg-ink/90"
          >
            홈 화면에 추가
          </button>
        ) : (
          <span className="text-xs text-zinc-500">
            설치 가능 신호 대기 중 — 브라우저 메뉴(공유·점 3개)에서도 수동 추가
            가능
          </span>
        )}
      </div>
    </div>
  );
}
