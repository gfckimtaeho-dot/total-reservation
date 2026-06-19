"use client";

import { useEffect, useState, useTransition, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { getPendingRefundCount } from "../refunds/actions";

type ActiveKey =
  | "dashboard"
  | "members"
  | "trainers"
  | "hours"
  | "products"
  | "services"
  | "revenue"
  | "visits"
  | "refunds"
  | "scan"
  | "chat"
  | "settings";

type Item = {
  key: Exclude<ActiveKey, "dashboard">;
  href: string | null;
};

function items(lang: string, slug: string): Item[] {
  // /services는 /products?tab=service로 흡수 — 사이드바에서 제거.
  // (라우트는 유지 — 기존 북마크나 revalidatePath 호환)
  return [
    { key: "members", href: `/${lang}/g/${slug}/members` },
    { key: "trainers", href: `/${lang}/g/${slug}/trainers` },
    { key: "hours", href: `/${lang}/g/${slug}/hours` },
    { key: "products", href: `/${lang}/g/${slug}/products` },
    { key: "revenue", href: `/${lang}/g/${slug}/revenue` },
    { key: "visits", href: `/${lang}/g/${slug}/visits` },
    { key: "refunds", href: `/${lang}/g/${slug}/refunds` },
    { key: "scan", href: `/${lang}/g/${slug}/scan` },
    { key: "chat", href: `/${lang}/g/${slug}/chat` },
    { key: "settings", href: `/${lang}/g/${slug}/settings` },
  ];
}

// pathname에서 lang/slug/active key를 모두 derive. props로 안 받아도
// loading.tsx 같은 곳에서 그대로 mount할 수 있음.
function parsePathname(
  pathname: string,
  fallbackLocale: string,
): {
  lang: string;
  slug: string;
  activeKey: ActiveKey | null;
} {
  // /{lang}/g/{slug}/{section}/... — 'g' literal 다음을 slug로 anchor.
  // 단순 인덱스 접근은 lang이 i18n 미들웨어로 prepend되지 않은 edge case에서
  // slug 자리가 'g' 자체로 derive되는 사고를 일으킬 수 있음.
  // lang fallback도 parts[0]에 의존하면 'g'가 lang으로 잘못 derive되어
  // href가 `/g/g/{slug}/...`로 망가짐 — next-intl locale로 anchor.
  const parts = pathname.split("/").filter(Boolean);
  const gIdx = parts.indexOf("g");
  const lang = gIdx > 0 ? parts[gIdx - 1]! : fallbackLocale;
  const slug = gIdx >= 0 ? (parts[gIdx + 1] ?? "") : "";
  const section = gIdx >= 0 ? (parts[gIdx + 2] ?? "") : "";
  let key: ActiveKey | null = null;
  if (section === "dashboard") key = "dashboard";
  else if (section === "members") key = "members";
  else if (section === "trainers") key = "trainers";
  else if (section === "hours") key = "hours";
  else if (section === "products") key = "products";
  else if (section === "services") key = "services";
  else if (section === "revenue") key = "revenue";
  else if (section === "visits") key = "visits";
  else if (section === "refunds") key = "refunds";
  else if (section === "scan") key = "scan";
  else if (section === "chat") key = "chat";
  else if (section === "settings") key = "settings";
  return { lang, slug, activeKey: key };
}

function keyFromHref(href: string): ActiveKey | null {
  if (href.endsWith("/dashboard")) return "dashboard";
  if (href.endsWith("/members")) return "members";
  if (href.endsWith("/trainers")) return "trainers";
  if (href.endsWith("/hours")) return "hours";
  if (href.endsWith("/products")) return "products";
  if (href.endsWith("/services")) return "services";
  if (href.endsWith("/revenue")) return "revenue";
  if (href.endsWith("/visits")) return "visits";
  if (href.endsWith("/refunds")) return "refunds";
  if (href.endsWith("/scan")) return "scan";
  if (href.endsWith("/chat")) return "chat";
  if (href.endsWith("/settings")) return "settings";
  return null;
}

export function SidebarNav({
  orientation = "side",
}: {
  // "side" = 세로 사이드바(기존, 사장 영역 공용). "top" = 상단 가로 메뉴바(대시보드).
  orientation?: "side" | "top";
} = {}) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname() ?? "";
  const { lang, slug, activeKey } = useMemo(
    () => parsePathname(pathname, locale),
    [pathname, locale],
  );
  const list = useMemo(() => items(lang, slug), [lang, slug]);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<ActiveKey | null>(null);
  // 미지급 환불 카운트 — refunds 메뉴 우측 뱃지. pathname 바뀔 때마다
  // refetch 해서 /refunds 에서 처리 완료 후 dashboard 등 다른 메뉴로
  // 이동하면 즉시 갱신.
  const [pendingRefund, setPendingRefund] = useState<number>(0);
  // 채팅 unread — 5초 폴링. visibilityState hidden 시 30초로 늘림.
  const [chatUnread, setChatUnread] = useState<number>(0);

  // pathname이 바뀌면 (= navigation 완료) pendingKey 클리어. transition이
  // 빠르게 끝나도 router.push가 즉시 pathname을 업데이트하므로 안전.
  useEffect(() => {
    setPendingKey(null);
  }, [pathname]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    function refetch() {
      void getPendingRefundCount(slug).then((n) => {
        if (!cancelled) setPendingRefund(n);
      });
    }
    refetch();
    // 환불 완료 등 도메인 이벤트 직후 즉시 갱신 — RefundsTable 등 호출처에서
    // `pending-refund-changed` 커스텀 이벤트 dispatch.
    window.addEventListener("pending-refund-changed", refetch);
    return () => {
      cancelled = true;
      window.removeEventListener("pending-refund-changed", refetch);
    };
  }, [slug, pathname]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function tick() {
      try {
        const res = await fetch("/api/chat/unread", { cache: "no-store" });
        if (res.ok) {
          const j = (await res.json()) as { total: number };
          if (!cancelled) setChatUnread(j.total);
        }
      } catch {
        // 네트워크 일시 끊김은 무시 — 다음 tick 에서 재시도.
      }
      if (cancelled) return;
      const delay = document.visibilityState === "visible" ? 5000 : 30000;
      timer = setTimeout(tick, delay);
    }
    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [slug]);

  // 모바일은 hover prefetch가 안 됨 — sidebar mount 시 모든 라우트를
  // 명시적으로 prefetch해 두면 첫 클릭이 캐시 히트로 전환됨.
  useEffect(() => {
    if (!slug) return;
    router.prefetch(`/${lang}/g/${slug}/dashboard`);
    for (const item of list) {
      if (item.href) router.prefetch(item.href);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, slug]);

  const effectiveKey: ActiveKey | null = pendingKey ?? activeKey;

  function navigate(href: string) {
    const k = keyFromHref(href);
    if (k) setPendingKey(k);
    // 메뉴 클릭 자체로 환불 카운트 refetch — /refunds 안에서 완료 처리한 직후
    // 같은 /refunds 메뉴를 다시 누르면 pathname 안 바뀌어 useEffect 가 안 도는
    // 회귀 fix(뱃지 stale).
    if (slug) {
      void getPendingRefundCount(slug).then((n) => setPendingRefund(n));
    }
    startTransition(() => {
      router.push(href);
    });
  }

  function dimWhilePending(isActive: boolean): string {
    if (!pending) return "";
    return isActive ? "opacity-90" : "opacity-60";
  }

  const dashHref = `/${lang}/g/${slug}/dashboard`;
  const dashActive = effectiveKey === "dashboard";

  const isTop = orientation === "top";
  // 상단 가로 모드는 한 줄 wrap 알약(indigo 활성), 세로 모드는 기존 사이드바 리스트.
  const navCls = isTop
    ? "flex flex-wrap items-center gap-2"
    : "flex-1 px-3 py-4";
  const btnBase = isTop
    ? "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm transition"
    : "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition";
  const activeCls = isTop
    ? "bg-indigo-600 text-white font-medium"
    : "bg-zinc-100 text-ink font-medium";
  const idleCls = isTop
    ? "text-zinc-600 hover:bg-indigo-50"
    : "text-zinc-700 hover:bg-zinc-50";

  return (
    <nav className={navCls}>
      <button
        type="button"
        onClick={() => navigate(dashHref)}
        disabled={pending}
        className={`${btnBase} ${dashActive ? activeCls : idleCls} ${dimWhilePending(dashActive)}`}
      >
        <span>{t("dashboard")}</span>
        {pendingKey === "dashboard" && pending && (
          <Spinner className="border-ink/30 border-t-ink" />
        )}
      </button>
      {list.map((n) => {
        const isActive =
          effectiveKey != null &&
          (n.key === "members" ||
            n.key === "trainers" ||
            n.key === "hours" ||
            n.key === "products" ||
            n.key === "services" ||
            n.key === "revenue" ||
            n.key === "visits" ||
            n.key === "refunds" ||
            n.key === "scan" ||
            n.key === "chat" ||
            n.key === "settings") &&
          effectiveKey === n.key;
        if (!n.href) {
          return (
            <span
              key={n.key}
              className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 cursor-default"
            >
              <span>{t(n.key)}</span>
              <span className="rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] bg-zinc-100 text-zinc-500">
                {t("soon")}
              </span>
            </span>
          );
        }
        const href = n.href;
        const isPendingThis = pending && pendingKey === n.key;
        const showRefundBadge = n.key === "refunds" && pendingRefund > 0;
        const showChatBadge = n.key === "chat" && chatUnread > 0;
        return (
          <button
            key={n.key}
            type="button"
            onClick={() => navigate(href)}
            disabled={pending}
            className={`${btnBase} ${isActive ? activeCls : idleCls} ${dimWhilePending(isActive)}`}
          >
            <span>{t(n.key)}</span>
            <span className="flex items-center gap-1.5">
              {showRefundBadge && (
                <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white tabular-nums">
                  {pendingRefund > 99 ? "99+" : pendingRefund}
                </span>
              )}
              {showChatBadge && (
                <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white tabular-nums">
                  {chatUnread > 99 ? "99+" : chatUnread}
                </span>
              )}
              {isPendingThis && (
                <Spinner className="border-ink/30 border-t-ink" />
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function Spinner({ className }: { className: string }) {
  return (
    <span
      className={`inline-block h-3 w-3 animate-spin rounded-full border-2 ${className}`}
      aria-hidden
    />
  );
}
