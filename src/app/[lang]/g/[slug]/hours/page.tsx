import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { logout } from "@/lib/auth/actions";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { getTheme } from "@/lib/theme";
import { SidebarNav } from "../dashboard/SidebarNav";
import { HoursForm } from "./HoursForm";
import { ClosureManager } from "./ClosureManager";
import { ymd } from "@/lib/hours/status";

const PAGE_BG = {
  normal: "bg-amber-50/50",
  black: "bg-zinc-950 text-zinc-200",
  white: "bg-white",
} as const;

const SIDEBAR_BG = {
  normal: "bg-band",
  black: "bg-black",
  white: "border-r border-zinc-100 bg-white",
} as const;

const SIDEBAR_BORDER = {
  normal: "border-ink/10",
  black: "border-white/5",
  white: "border-zinc-100",
} as const;

const SIDEBAR_LABEL = {
  normal: "text-ink/70",
  black: "text-lime-300/80",
  white: "text-ink/60",
} as const;

const SIDEBAR_NAME = {
  normal: "text-ink",
  black: "text-white",
  white: "text-ink",
} as const;

const HEADER_BORDER = {
  normal: "border-amber-200/60",
  black: "border-white/5",
  white: "border-zinc-100",
} as const;

const TITLE = {
  normal: "text-ink",
  black: "text-white",
  white: "text-ink",
} as const;

const EYEBROW = {
  normal: "text-ink/60",
  black: "text-lime-300/80",
  white: "text-ink/60",
} as const;

function fmtTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default async function GymHoursPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const auth = await requireGymStaff(slug);
  const business = auth.business!;
  const theme = await getTheme();
  const t = await getTranslations("hours");
  const tn = await getTranslations("nav");

  const [rows, closureRows] = await Promise.all([
    prisma.businessHours.findMany({ where: { gymId: business.id } }),
    prisma.businessClosure.findMany({
      where: { gymId: business.id },
      orderBy: { date: "asc" },
    }),
  ]);

  const initialDays = rows.map((r) => ({
    weekday: r.weekday,
    open: true,
    openTime: fmtTime(r.openMinute),
    closeTime: fmtTime(r.closeMinute),
    breakStartTime: r.breakStartMin != null ? fmtTime(r.breakStartMin) : "",
    breakEndTime: r.breakEndMin != null ? fmtTime(r.breakEndMin) : "",
  }));

  const initialClosures = closureRows.map((c) => ({
    id: c.id,
    date: ymd(c.date),
    kind: c.kind,
    openMinute: c.openMinute,
    closeMinute: c.closeMinute,
    reason: c.reason,
  }));

  return (
    <div className={`flex min-h-screen ${PAGE_BG[theme]}`}>
      <aside
        className={`hidden w-60 shrink-0 flex-col lg:flex ${SIDEBAR_BG[theme]}`}
      >
        <div className={`border-b px-6 py-6 ${SIDEBAR_BORDER[theme]}`}>
          <span
            className={`text-xs font-semibold uppercase tracking-[0.22em] ${SIDEBAR_LABEL[theme]}`}
          >
            {tn("studio")}
          </span>
          <div
            className={`mt-1 font-heading text-lg tracking-tight ${SIDEBAR_NAME[theme]}`}
          >
            {business.name}
          </div>
          <div
            className={`mt-0.5 text-xs ${
              theme === "normal" ? "text-ink/60" : "text-zinc-500"
            }`}
          >
            /g/{slug}
          </div>
        </div>
        <SidebarNav tone={theme} />
        <div className={`border-t px-3 py-4 ${SIDEBAR_BORDER[theme]}`}>
          <form action={logout.bind(null, `/${lang}/g/${slug}/login`)}>
            <button
              className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm ${
                theme === "black"
                  ? "text-zinc-400 hover:bg-white/5"
                  : theme === "white"
                    ? "text-zinc-700 hover:bg-zinc-50"
                    : "text-ink/80 hover:bg-white/40"
              }`}
            >
              {tn("logout")}
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <header
          className={`flex items-center justify-between border-b px-8 py-5 ${HEADER_BORDER[theme]}`}
        >
          <div>
            <span
              className={`text-xs font-semibold uppercase tracking-[0.22em] ${EYEBROW[theme]}`}
            >
              HOURS
            </span>
            <h1
              className={`font-heading text-xl tracking-tight ${TITLE[theme]}`}
            >
              {t("pageTitle")}
            </h1>
          </div>
          <Link
            href={`/${lang}/g/${slug}/dashboard`}
            className={`text-sm transition ${
              theme === "black"
                ? "text-zinc-400 hover:text-lime-300"
                : "text-zinc-600 hover:text-ink"
            }`}
          >
            ← {tn("dashboard")}
          </Link>
        </header>

        <div className="mx-auto w-full max-w-6xl space-y-5 p-6">
          <HoursForm
            lang={lang}
            slug={slug}
            tone={theme}
            initialDays={initialDays}
          />
          <ClosureManager
            lang={lang}
            slug={slug}
            tone={theme}
            initialClosures={initialClosures}
          />
        </div>
      </main>
    </div>
  );
}
