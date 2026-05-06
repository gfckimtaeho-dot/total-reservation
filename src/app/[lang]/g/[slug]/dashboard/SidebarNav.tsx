import Link from "next/link";

export type SidebarTone = "normal" | "black" | "white";

type Item = {
  key: string;
  label: string;
  href: string | null;
};

function items(lang: string, slug: string): Item[] {
  return [
    { key: "members", label: "회원관리", href: null },
    { key: "trainers", label: "트레이너 관리", href: null },
    { key: "hours", label: "영업일", href: null },
    { key: "services", label: "서비스", href: null },
    { key: "revenue", label: "매출현황", href: null },
    {
      key: "settings",
      label: "설정",
      href: `/${lang}/g/${slug}/settings`,
    },
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
  activeKey: "dashboard" | "settings";
  tone: SidebarTone;
}) {
  const t = TONE[tone];
  const list = items(lang, slug);

  return (
    <nav className="flex-1 px-3 py-4">
      <Link
        href={`/${lang}/g/${slug}/dashboard`}
        className={`flex items-center rounded-md px-3 py-2 text-sm transition ${
          activeKey === "dashboard"
            ? `${t.activeDash} font-medium`
            : t.inactive
        }`}
      >
        대시보드
      </Link>
      {list.map((n) => {
        const isActive =
          activeKey === "settings" && n.key === "settings";
        if (!n.href) {
          return (
            <span
              key={n.key}
              className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${t.inactive} cursor-default`}
            >
              <span>{n.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] ${t.soonBadge}`}
              >
                soon
              </span>
            </span>
          );
        }
        return (
          <Link
            key={n.key}
            href={n.href}
            className={`flex items-center rounded-md px-3 py-2 text-sm transition ${
              isActive ? `${t.activeDash} font-medium` : t.inactive
            }`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
