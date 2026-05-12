import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db/client";
import { computeStatus, fmtMinute, weekdayOf } from "@/lib/hours/status";

// 트레이너 본인 시점 — 오늘 휴가 / 주간휴무 / 출근시간 / 지각 여부 표시.
export async function MyCheckInCard({
  gymId,
  userId,
  staffId,
}: {
  gymId: string;
  userId: string;
  staffId: string | null;
}) {
  const t = await getTranslations("checkin");

  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );
  const todayLocalStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [hours, closure, staff, leave, firstAccess] = await Promise.all([
    prisma.businessHours.findMany({ where: { gymId } }),
    prisma.businessClosure.findUnique({
      where: { gymId_date: { gymId, date: todayUtc } },
    }),
    staffId
      ? prisma.staff.findUnique({
          where: { id: staffId },
          select: { weeklyOffDays: true },
        })
      : Promise.resolve(null),
    staffId
      ? prisma.staffLeave.findFirst({
          where: {
            staffId,
            startDate: { lte: todayUtc },
            endDate: { gte: todayUtc },
          },
          select: { reason: true },
        })
      : Promise.resolve(null),
    prisma.accessLog.findFirst({
      where: {
        gymId,
        userId,
        result: "ALLOWED",
        occurredAt: { gte: todayLocalStart },
      },
      orderBy: { occurredAt: "asc" },
      select: { occurredAt: true },
    }),
  ]);

  const storeStatus = computeStatus(todayUtc, hours, closure ?? null);
  const storeOpenMin =
    storeStatus.state === "OPEN" ? storeStatus.openMin : null;

  const todayWd = weekdayOf(todayUtc);
  const onWeeklyOff =
    staff?.weeklyOffDays.includes(todayWd) ?? false;
  const onLeave = leave != null;

  let pillLabel: string;
  let pillClass: string;
  let detail: string | null = null;

  if (onLeave) {
    pillLabel = t("todayLeave");
    pillClass = "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30";
    detail = leave?.reason ?? null;
  } else if (onWeeklyOff) {
    pillLabel = t("todayOff");
    pillClass = "bg-zinc-700 text-zinc-300 ring-1 ring-zinc-600";
  } else if (firstAccess) {
    const min =
      firstAccess.occurredAt.getHours() * 60 +
      firstAccess.occurredAt.getMinutes();
    const lateMin = storeOpenMin != null ? min - storeOpenMin : 0;
    const minTxt = `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
    pillLabel = minTxt;
    if (lateMin > 0) {
      pillClass = "bg-rose-400/15 text-rose-300 ring-1 ring-rose-400/30";
      detail = t("late", { min: lateMin });
    } else {
      pillClass = "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30";
      detail = t("onTime");
    }
  } else {
    pillLabel = t("notCheckedIn");
    pillClass = "bg-zinc-700 text-zinc-300 ring-1 ring-zinc-600";
    if (storeOpenMin != null) {
      detail = `${t("storeOpenLabel")} ${fmtMinute(storeOpenMin)}`;
    }
  }

  return (
    <section className="rounded-2xl bg-zinc-900 p-5 ring-1 ring-white/10">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-300/80">
          {t("myTitle")}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${pillClass}`}>
          {pillLabel}
        </span>
        {detail && <span className="text-xs text-zinc-400">{detail}</span>}
      </div>
    </section>
  );
}
