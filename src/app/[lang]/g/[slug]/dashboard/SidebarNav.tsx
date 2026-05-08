"use client";

import Link from "next/link";
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
  },
  black: {
    activeDash: "bg-lime-300 text-zinc-950",
    inactive: "text-zinc-400 hover:bg-white/5 hover:text-lime-300",
    soonBadge: "bg-white/5 text-zinc-500",
  },
  white: {
    activeDash: "bg-zinc-100 text-ink",
    inactive: "text-zinc-700 hover:bg-zinc-50",
    soonBadge: "bg-zinc-100 text-zinc-500",
  },
} as const;

export function SidebarNav({
  lang,
  slug,
  activeKey,
  tone,
}: {
  lang: string;
  slug: string;
  activeKey: "dashboard" | "settings" | "members" | "trainers" | "hours";
  tone: SidebarTone;
}) {
  const t = useTranslations("nav");
  const tk = TONE[tone];
  const list = items(lang, slug);

  return (
    <nav className="flex-1 px-3 py-4">
      <Link
        href={`/${lang}/g/${slug}/dashboard`}
        className={`flex items-center rounded-md px-3 py-2 text-sm transition ${
          activeKey === "dashboard"
            ? `${tk.activeDash} font-medium`
            : tk.inactive
        }`}
      >
        {t("dashboard")}
      </Link>
      {list.map((n) => {
        const isActive =
          (activeKey === "settings" && n.key === "settings") ||
          (activeKey === "members" && n.key === "members") ||
          (activeKey === "trainers" && n.key === "trainers") ||
          (activeKey === "hours" && n.key === "hours");
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
        return (
          <Link
            key={n.key}
            href={n.href}
            className={`flex items-center rounded-md px-3 py-2 text-sm transition ${
              isActive ? `${tk.activeDash} font-medium` : tk.inactive
            }`}
          >
            {t(n.key)}
          </Link>
        );
      })}
    </nav>
  );
}
