import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { logout } from "@/lib/auth/actions";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { SidebarNav } from "../dashboard/SidebarNav";
import { HoursForm } from "./HoursForm";
import { ClosureManager } from "./ClosureManager";
import { ymd } from "@/lib/hours/status";

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
    <div className="flex min-h-screen bg-white">
      <aside className="hidden w-60 shrink-0 flex-col lg:flex border-r border-violet-100 bg-violet-50">
        <div className="border-b px-6 py-6 border-violet-100">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
            {tn("studio")}
          </span>
          <div className="mt-1 font-heading text-lg tracking-tight text-ink">
            {business.name}
          </div>
          <div className="mt-0.5 text-xs text-zinc-500">/g/{slug}</div>
        </div>
        <SidebarNav />
        <div className="border-t px-3 py-4 border-violet-100">
          <form action={logout.bind(null, `/${lang}/g/${slug}/login`)}>
            <button className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50">
              {tn("logout")}
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <header className="flex items-center justify-between border-b px-8 py-5 border-violet-100">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
              HOURS
            </span>
            <h1 className="font-heading text-xl tracking-tight text-ink">
              {t("pageTitle")}
            </h1>
          </div>
          <Link
            href={`/${lang}/g/${slug}/dashboard`}
            className="text-sm transition text-zinc-600 hover:text-ink"
          >
            ← {tn("dashboard")}
          </Link>
        </header>

        <div className="mx-auto w-full max-w-6xl space-y-5 p-6">
          <HoursForm
            lang={lang}
            slug={slug}
            tone="white"
            initialDays={initialDays}
          />
          <ClosureManager
            lang={lang}
            slug={slug}
            tone="white"
            initialClosures={initialClosures}
          />
        </div>
      </main>
    </div>
  );
}
