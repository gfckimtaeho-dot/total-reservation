"use client";

import { useEffect } from "react";

// 15초 주기로 /api/auth/ping-active 호출. 사장이 비활성화하면 다음 ping 때
// 401 받고 즉시 login 으로 이동. 트레이너 화면에 남은 옛 QR 도 함께 사라짐.
export function ActiveSessionGuard({
  pingUrl,
  logoutUrl,
  intervalMs = 15000,
}: {
  pingUrl: string;
  logoutUrl: string;
  intervalMs?: number;
}) {
  useEffect(() => {
    let cancelled = false;
    async function ping() {
      try {
        const res = await fetch(pingUrl, {
          credentials: "include",
          cache: "no-store",
        });
        if (!cancelled && res.status === 401) {
          window.location.href = logoutUrl;
        }
      } catch {
        // 네트워크 일시 오류는 무시 — 다음 tick 에 재시도
      }
    }
    void ping();
    const timer = setInterval(ping, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pingUrl, logoutUrl, intervalMs]);
  return null;
}
