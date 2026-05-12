import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { computeStatus, fmtMinute, upcomingClosures, ymd } from "@/lib/hours/status";

type Tone = "normal" | "black" | "white" | "trainer";

const TONE = {
  normal: {
    wrap: "rounded-2xl border border-amber-200/60 bg-white p-5",
    eyebrow: "text-ink/60",
    title: "text-ink",
    sub: "text-zinc-600",
    pillOpen: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
    pillBreak: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
    pillClosed: "bg-rose-100 text-rose-700 ring-1 ring-rose-200",
    badge: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
    badgeShort: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
    link: "text-ink/70 hover:text-ink",
    closureRow: "border-amber-100",
  },
  black: {
    wrap: "rounded-2xl bg-zinc-900 p-5 ring-1 ring-white/10",
    eyebrow: "text-lime-300/80",
    title: "text-white",
    sub: "text-zinc-400",
    pillOpen: "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30",
    pillBreak: "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30",
    pillClosed: "bg-rose-400/15 text-rose-300 ring-1 ring-rose-400/30",
    badge: "bg-rose-400/15 text-rose-300 ring-1 ring-rose-400/30",
    badgeShort: "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30",
    link: "text-zinc-400 hover:text-lime-300",
    closureRow: "border-white/5",
  },
  white: {
    wrap: "rounded-2xl border border-zinc-200 bg-white p-5",
    eyebrow: "text-ink/60",
    title: "text-ink",
    sub: "text-zinc-600",
    pillOpen: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
    pillBreak: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
    pillClosed: "bg-rose-100 text-rose-700 ring-1 ring-rose-200",
    badge: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
    badgeShort: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
    link: "text-zinc-600 hover:text-ink",
    closureRow: "border-zinc-100",
  },
  trainer: {
    wrap: "rounded-2xl bg-zinc-900 p-5 ring-1 ring-white/10",
    eyebrow: "text-amber-300/80",
    title: "text-white",
    sub: "text-zinc-400",
    pillOpen: "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30",
    pillBreak: "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30",
    pillClosed: "bg-rose-400/15 text-rose-300 ring-1 ring-rose-400/30",
    badge: "bg-rose-400/15 text-rose-300 ring-1 ring-rose-400/30",
    badgeShort: "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30",
    link: "text-zinc-400 hover:text-amber-300",
    closureRow: "border-white/5",
  },
} as const;

export async function HoursStatusCard({
  gymId,
  lang,
  slug,
  tone,
  canEdit,
}: {
  gymId: string;
  lang: string;
  slug: string;
  tone: Tone;
  canEdit: boolean;
}) {
  const t = await getTranslations("hours");
  const tk = TONE[tone];

  const today = new Date();
  const todayUtc = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
  );
  const todayYmd = ymd(todayUtc);
  const horizon = new Date(todayUtc);
  horizon.setUTCDate(horizon.getUTCDate() + 60);

  const [hours, todayClosure, futureClosures] = await Promise.all([
    prisma.businessHours.findMany({ where: { gymId } }),
    prisma.businessClosure.findUnique({
      where: { gymId_date: { gymId, date: todayUtc } },
    }),
    prisma.businessClosure.findMany({
      where: { gymId, date: { gte: todayUtc, lte: horizon } },
      orderBy: { date: "asc" },
      take: 3,
    }),
  ]);

  const status = computeStatus(todayUtc, hours, todayClosure ?? null);
  const nowMinute = today.getHours() * 60 + today.getMinutes();

  let pillLabel: string;
  let pillClass: string;
  let detail: string | null = null;

  if (status.state === "CLOSED_DAY") {
    pillLabel = t("closedToday");
    pillClass = tk.pillClosed;
    detail = status.reason;
  } else if (status.state === "NO_HOURS_SET") {
    pillLabel = t("closedToday");
    pillClass = tk.pillClosed;
  } else {
    const { openMin, closeMin, breakStartMin, breakEndMin } = status;
    const inBreak =
      breakStartMin != null &&
      breakEndMin != null &&
      nowMinute >= breakStartMin &&
      nowMinute < breakEndMin;
    const isOpen = nowMinute >= openMin && nowMinute < closeMin && !inBreak;
    if (inBreak) {
      pillLabel = t("onBreakNow");
      pillClass = tk.pillBreak;
    } else if (isOpen) {
      pillLabel = t("operatingNow");
      pillClass = tk.pillOpen;
    } else {
      pillLabel = t("closedNow");
      pillClass = tk.pillClosed;
    }
    detail = `${fmtMinute(openMin)} ~ ${fmtMinute(closeMin)}`;
    if (breakStartMin != null && breakEndMin != null) {
      detail += ` · ${t("breakLabel")} ${fmtMinute(breakStartMin)}~${fmtMinute(breakEndMin)}`;
    }
    if (status.reason) detail += ` · ${status.reason}`;
  }

  const upcoming = upcomingClosures(futureClosures, todayYmd, 3).filter(
    (c) => ymd(c.date) !== todayYmd,
  );

  return (
    <section className={tk.wrap}>
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${tk.eyebrow}`}>
          {t("todayHours")}
        </span>
        {canEdit && (
          <Link href={`/${lang}/g/${slug}/hours`} className={`text-xs ${tk.link}`}>
            →
          </Link>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${pillClass}`}
        >
          {pillLabel}
        </span>
        {detail && (
          <span className={`text-xs tabular-nums ${tk.sub}`}>{detail}</span>
        )}
      </div>

      {upcoming.length > 0 && (
        <div className="mt-4 border-t pt-3" style={{ borderColor: undefined }}>
          <div className={`mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] ${tk.eyebrow}`}>
            {t("upcomingClosures")}
          </div>
          <ul className="space-y-1">
            {upcoming.map((c) => (
              <li
                key={c.id}
                className={`flex items-center gap-2 text-xs ${tk.sub}`}
              >
                <span className="font-mono tabular-nums">{ymd(c.date)}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                    c.kind === "CLOSED" ? tk.badge : tk.badgeShort
                  }`}
                >
                  {c.kind === "CLOSED" ? t("kindClosed") : t("kindShortened")}
                </span>
                {c.kind === "SHORTENED" && c.openMinute != null && c.closeMinute != null && (
                  <span className="font-mono tabular-nums">
                    {fmtMinute(c.openMinute)}~{fmtMinute(c.closeMinute)}
                  </span>
                )}
                {c.reason && <span className="truncate">{c.reason}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
