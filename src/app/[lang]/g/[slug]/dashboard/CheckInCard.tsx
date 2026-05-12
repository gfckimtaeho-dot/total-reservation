import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db/client";
import { computeStatus, fmtMinute, ymd } from "@/lib/hours/status";

type Tone = "normal" | "black" | "white" | "trainer";

const TONE = {
  normal: {
    wrap: "rounded-2xl border border-amber-200/60 bg-white p-5",
    eyebrow: "text-ink/60",
    title: "text-ink",
    sub: "text-zinc-600",
    row: "border-amber-100",
    name: "text-ink",
    time: "text-ink",
    late: "bg-rose-100 text-rose-700 ring-1 ring-rose-200",
    onTime: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    notIn: "text-zinc-400",
  },
  black: {
    wrap: "rounded-2xl bg-zinc-900 p-5 ring-1 ring-white/10",
    eyebrow: "text-lime-300/80",
    title: "text-white",
    sub: "text-zinc-400",
    row: "border-white/5",
    name: "text-zinc-100",
    time: "text-zinc-100",
    late: "bg-rose-400/15 text-rose-300 ring-1 ring-rose-400/30",
    onTime: "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30",
    notIn: "text-zinc-600",
  },
  white: {
    wrap: "rounded-2xl border border-zinc-200 bg-white p-5",
    eyebrow: "text-ink/60",
    title: "text-ink",
    sub: "text-zinc-600",
    row: "border-zinc-100",
    name: "text-ink",
    time: "text-ink",
    late: "bg-rose-100 text-rose-700 ring-1 ring-rose-200",
    onTime: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    notIn: "text-zinc-400",
  },
  trainer: {
    wrap: "rounded-2xl bg-zinc-900 p-5 ring-1 ring-white/10",
    eyebrow: "text-amber-300/80",
    title: "text-white",
    sub: "text-zinc-400",
    row: "border-white/5",
    name: "text-zinc-100",
    time: "text-zinc-100",
    late: "bg-rose-400/15 text-rose-300 ring-1 ring-rose-400/30",
    onTime: "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30",
    notIn: "text-zinc-600",
  },
} as const;

export async function CheckInCard({
  gymId,
  tone,
}: {
  gymId: string;
  tone: Tone;
}) {
  const t = await getTranslations("checkin");
  const tk = TONE[tone];

  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );
  const todayLocalStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 매장 영업시작 (closure 반영) — 지각 판정 기준
  const [hours, todayClosure, staffList, todayAccessLogs] = await Promise.all([
    prisma.businessHours.findMany({ where: { gymId } }),
    prisma.businessClosure.findUnique({
      where: { gymId_date: { gymId, date: todayUtc } },
    }),
    // 사장은 제외 — 사장은 출퇴근 의무 없음. 매니저/트레이너만.
    prisma.staff.findMany({
      where: { gymId, role: { in: ["MANAGER", "TRAINER"] } },
      include: { user: { select: { id: true, name: true, role: true } } },
    }),
    prisma.accessLog.findMany({
      where: {
        gymId,
        result: "ALLOWED",
        occurredAt: { gte: todayLocalStart },
      },
      orderBy: { occurredAt: "asc" },
      select: { userId: true, occurredAt: true },
    }),
  ]);

  // user별 첫 출입만 추출
  const firstByUser = new Map<string, Date>();
  for (const log of todayAccessLogs) {
    if (!firstByUser.has(log.userId)) firstByUser.set(log.userId, log.occurredAt);
  }

  const status = computeStatus(todayUtc, hours, todayClosure ?? null);
  const storeOpenMin =
    status.state === "OPEN" ? status.openMin : null;

  type Row = {
    userId: string;
    name: string;
    role: string;
    checkInAt: Date | null;
    lateMin: number | null;
  };
  const rows: Row[] = staffList.map((s) => {
    const at = firstByUser.get(s.user.id) ?? null;
    let lateMin: number | null = null;
    if (at && storeOpenMin != null) {
      const min = at.getHours() * 60 + at.getMinutes();
      lateMin = min - storeOpenMin;
    }
    return {
      userId: s.user.id,
      name: s.user.name,
      role: s.role,
      checkInAt: at,
      lateMin,
    };
  });

  // 출근한 사람 먼저, 시간 순. 미출근은 마지막.
  rows.sort((a, b) => {
    if (a.checkInAt && b.checkInAt) {
      return a.checkInAt.getTime() - b.checkInAt.getTime();
    }
    if (a.checkInAt && !b.checkInAt) return -1;
    if (!a.checkInAt && b.checkInAt) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <section className={tk.wrap}>
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${tk.eyebrow}`}>
          {t("title")}
        </span>
        <span className={`text-xs ${tk.sub}`}>{ymd(todayUtc)}</span>
      </div>

      {rows.length === 0 ? (
        <div className={`mt-4 text-sm ${tk.sub}`}>{t("noStaff")}</div>
      ) : (
        <ul className="mt-3 divide-y" style={{ borderColor: undefined }}>
          {rows.map((r) => {
            const minTxt =
              r.checkInAt != null
                ? `${String(r.checkInAt.getHours()).padStart(2, "0")}:${String(r.checkInAt.getMinutes()).padStart(2, "0")}`
                : null;
            const late = r.lateMin != null && r.lateMin > 0;
            return (
              <li
                key={r.userId}
                className={`flex items-center justify-between gap-2 border-t py-2 first:border-t-0 ${tk.row}`}
              >
                <span className={`text-sm font-medium ${tk.name}`}>{r.name}</span>
                <div className="flex items-center gap-2">
                  {minTxt ? (
                    <>
                      <span className={`text-sm font-mono tabular-nums ${tk.time}`}>
                        {minTxt}
                      </span>
                      {late ? (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tk.late}`}>
                          {t("late", { min: r.lateMin! })}
                        </span>
                      ) : (
                        storeOpenMin != null && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tk.onTime}`}>
                            {t("onTime")}
                          </span>
                        )
                      )}
                    </>
                  ) : (
                    <span className={`text-xs ${tk.notIn}`}>{t("notCheckedIn")}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {storeOpenMin != null && (
        <div className={`mt-3 text-[11px] ${tk.sub}`}>
          {t("storeOpenLabel")}: <span className="font-mono tabular-nums">{fmtMinute(storeOpenMin)}</span>
        </div>
      )}
    </section>
  );
}
