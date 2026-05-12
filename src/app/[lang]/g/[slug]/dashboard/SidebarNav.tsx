"use client";

import { useEffect, useState, useTransition, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";

export type SidebarTone = "normal" | "black" | "white";

type ActiveKey =
  | "dashboard"
  | "members"
  | "trainers"
  | "hours"
  | "services"
  | "revenue"
  | "settings";

type Item = {
  key: Exclude<ActiveKey, "dashboard">;
  href: string | null;
};

function items(lang: string, slug: string): Item[] {
  return [
    { key: "members", href: `/${lang}/g/${slug}/members` },
    { key: "trainers", href: `/${lang}/g/${slug}/trainers` },
    { key: "hours", href: `/${lang}/g/${slug}/hours` },
    { key: "services", href: `/${lang}/g/${slug}/services` },
    { key: "revenue", href: null },
    { key: "settings", href: `/${lang}/g/${slug}/settings` },
  ];
}

const TONE = {
  normal: {
    activeDash: "bg-ink text-white",
    inactive: "text-ink/80 hover:bg-white/40",
    soonBadge: "bg-white/40 text-ink/60",
    spinner: "border-white/40 border-t-white",
  },
  black: {
    activeDash: "bg-lime-300 text-zinc-950",
    inactive: "text-zinc-400 hover:bg-white/5 hover:text-lime-300",
    soonBadge: "bg-white/5 text-zinc-500",
    spinner: "border-zinc-950/30 border-t-zinc-950",
  },
  white: {
    activeDash: "bg-zinc-100 text-ink",
    inactive: "text-zinc-700 hover:bg-zinc-50",
    soonBadge: "bg-zinc-100 text-zinc-500",
    spinner: "border-ink/30 border-t-ink",
  },
} as const;

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
  else if (section === "services") key = "services";
  else if (section === "revenue") key = "revenue";
  else if (section === "settings") key = "settings";
  return { lang, slug, activeKey: key };
}

function keyFromHref(href: string): ActiveKey | null {
  if (href.endsWith("/dashboard")) return "dashboard";
  if (href.endsWith("/members")) return "members";
  if (href.endsWith("/trainers")) return "trainers";
  if (href.endsWith("/hours")) return "hours";
  if (href.endsWith("/services")) return "services";
  if (href.endsWith("/settings")) return "settings";
  return null;
}

export function SidebarNav({ tone }: { tone: SidebarTone }) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const tk = TONE[tone];
  const pathname = usePathname() ?? "";
  const { lang, slug, activeKey } = useMemo(
    () => parsePathname(pathname, locale),
    [pathname, locale],
  );
  const list = useMemo(() => items(lang, slug), [lang, slug]);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<ActiveKey | null>(null);

  // pathname이 바뀌면 (= navigation 완료) pendingKey 클리어. transition이
  // 빠르게 끝나도 router.push가 즉시 pathname을 업데이트하므로 안전.
  useEffect(() => {
    setPendingKey(null);
  }, [pathname]);

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

  return (
    <nav className="flex-1 px-3 py-4">
      <button
        type="button"
        onClick={() => navigate(dashHref)}
        disabled={pending}
        className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${
          dashActive ? `${tk.activeDash} font-medium` : tk.inactive
        } ${dimWhilePending(dashActive)}`}
      >
        <span>{t("dashboard")}</span>
        {pendingKey === "dashboard" && pending && (
          <Spinner className={tk.spinner} />
        )}
      </button>
      {list.map((n) => {
        const isActive =
          effectiveKey != null &&
          (n.key === "members" ||
            n.key === "trainers" ||
            n.key === "hours" ||
            n.key === "services" ||
            n.key === "settings") &&
          effectiveKey === n.key;
        if (!n.href) {
          return (
            <span
              key={n.key}
              className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${tk.inactive} cursor-default`}
            >
              <span>{t(n.key)}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] ${tk.soonBadge}`}
              >
                {t("soon")}
              </span>
            </span>
          );
        }
        const href = n.href;
        const isPendingThis = pending && pendingKey === n.key;
        return (
          <button
            key={n.key}
            type="button"
            onClick={() => navigate(href)}
            disabled={pending}
            className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${
              isActive ? `${tk.activeDash} font-medium` : tk.inactive
            } ${dimWhilePending(isActive)}`}
          >
            <span>{t(n.key)}</span>
            {isPendingThis && <Spinner className={tk.spinner} />}
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
