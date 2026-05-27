"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = {
  href: string;
  label: string;
  enabled: boolean;
  hint?: string;
};

export function AdminSidebar({ lang }: { lang: string }) {
  const pathname = usePathname();

  const tabs: Tab[] = [
    { href: `/${lang}/admin/invites`, label: "Invite", enabled: true },
    {
      href: `/${lang}/admin/businesses`,
      label: "가맹점",
      enabled: true,
    },
    {
      href: `/${lang}/admin/subscriptions`,
      label: "구독",
      enabled: true,
    },
    {
      href: `/${lang}/admin/stats`,
      label: "통계",
      enabled: false,
      hint: "준비중",
    },
  ];

  return (
    <nav className="sticky top-4 space-y-1">
      <div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-ink/50">
        Operator
      </div>
      {tabs.map((t) => {
        const active = pathname?.startsWith(t.href);
        if (!t.enabled) {
          return (
            <div
              key={t.href}
              className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-zinc-400"
              title={t.hint}
            >
              <span>{t.label}</span>
              {t.hint && (
                <span className="text-[10px] uppercase tracking-wider text-zinc-400">
                  {t.hint}
                </span>
              )}
            </div>
          );
        }
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`block rounded-md px-3 py-2 text-sm transition ${
              active
                ? "bg-ink text-white"
                : "text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
