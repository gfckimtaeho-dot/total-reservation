"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export type SidebarTone = "normal" | "black" | "white";

type Item = {
  key: "members" | "trainers" | "hours" | "services" | "revenue" | "settings";
  href: string | null;
};

function items(lang: string, slug: string): Item[] {
  return [
    { key: "members", href: `/${lang}/g/${slug}/members` },
    { key: "trainers", href: `/${lang}/g/${slug}/trainers` },
    { key: "hours", href: `/${lang}/g/${slug}/hours` },
    { key: "services", href: null },
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

type ActiveKey =
  | "dashboard"
  | "settings"
  | "members"
  | "trainers"
  | "hours";

function keyFromHref(href: string): ActiveKey | null {
  if (href.endsWith("/dashboard")) return "dashboard";
  if (href.endsWith("/members")) return "members";
  if (href.endsWith("/trainers")) return "trainers";
  if (href.endsWith("/hours")) return "hours";
  if (href.endsWith("/settings")) return "settings";
  return null;
}

export function SidebarNav({
  lang,
  slug,
  activeKey,
  tone,
}: {
  lang: string;
  slug: string;
  activeKey: ActiveKey;
  tone: SidebarTone;
}) {
  const t = useTranslations("nav");
  const tk = TONE[tone];
  const list = items(lang, slug);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<ActiveKey | null>(null);

  // 모바일은 hover prefetch가 안 됨 — sidebar mount 시 모든 라우트를
  // 명시적으로 prefetch해 두면 첫 클릭이 캐시 히트로 전환됨.
  useEffect(() => {
    router.prefetch(`/${lang}/g/${slug}/dashboard`);
    for (const item of list) {
      if (item.href) router.prefetch(item.href);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, slug]);

  // Optimistic active: 클릭 즉시 pendingKey가 적용되어 server response 기다리지
  // 않고 highlight가 옮겨감. transition이 끝나면 pendingKey가 클리어되고
  // server-rendered activeKey가 그대로 일치하는 상태가 됨.
  const effectiveKey: ActiveKey = pendingKey ?? activeKey;

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
          (effectiveKey === "settings" && n.key === "settings") ||
          (effectiveKey === "members" && n.key === "members") ||
          (effectiveKey === "trainers" && n.key === "trainers") ||
          (effectiveKey === "hours" && n.key === "hours");
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
        const isPendingThis =
          pending &&
          pendingKey != null &&
          ((pendingKey === "members" && n.key === "members") ||
            (pendingKey === "trainers" && n.key === "trainers") ||
            (pendingKey === "hours" && n.key === "hours") ||
            (pendingKey === "settings" && n.key === "settings"));
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
