"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // dev 에서는 서비스 워커를 등록하지 않는다 — SW 캐시가 코드 수정을 가려
    // "고쳤는데 화면이 안 바뀐다"를 유발한다. 이미 등록된 SW·캐시가 있으면
    // 해제·삭제해 옛 캐시가 계속 서빙되는 것도 막는다.
    // (운영 빌드에서는 아래처럼 정상 등록 — PWA 동작)
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())));
      if ("caches" in window) {
        void caches
          .keys()
          .then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
      }
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((err) => {
        console.warn("[sw] registration failed:", err);
      });
  }, []);

  return null;
}
