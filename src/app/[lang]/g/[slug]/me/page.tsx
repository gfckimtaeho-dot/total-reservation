import { getTranslations } from "next-intl/server";
import { logout } from "@/lib/auth/actions";
import { requireGymCustomer } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { gymTodayUtcMidnight } from "@/lib/calendar/gymTime";
import { loadMeCalendarMonth } from "@/lib/calendar/meCalendar";
import { OPEN_STATUSES } from "@/lib/packages/availability";
import { PwaCard } from "./PwaCard";
import { MeHeaderActions } from "./MeHeaderActions";
import { MeCalendar } from "./MeCalendar";
import { requestAccessQr } from "./actions";

type T = (key: string, vars?: Record<string, string | number>) => string;

export default async function CustomerHomePage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const user = await requireGymCustomer(slug);
  const business = user.business!;
  const t = (await getTranslations("me")) as unknown as T;

  const todayMid = gymTodayUtcMidnight(business.timeZone);
  // 오늘 하루 범위 — Reservation.startAt 은 UTC-naive(Manila 벽시계를 UTC
  // 파츠로 저장)라 시간대 변환 없이 UTC 자정~다음날 자정으로 비교한다.
  // 트레이너 캘린더(startAt 의 getUTCHours 를 그대로 읽음)와 동일 기준.
  const todayEndMid = new Date(
    todayMid.getTime() + 24 * 60 * 60 * 1000,
  );

  const [
    closureToday,
    membershipCount,
    packages,
    todayReservations,
    calMonth,
    accessQr,
  ] = await Promise.all([
    prisma.businessClosure.findFirst({
      where: { gymId: business.id, date: todayMid },
      select: { kind: true, reason: true },
    }),
    prisma.membership.count({
      where: {
        gymId: business.id,
        userId: user.id,
        endDate: { gte: todayMid },
      },
    }),
    prisma.package.findMany({
      where: {
        gymId: business.id,
        userId: user.id,
        remainingCount: { gt: 0 },
        refundedAt: null, // 환불 동결 권 제외
      },
      select: {
        id: true,
        totalCount: true,
        remainingCount: true,
        assignedStaffId: true,
        service: {
          select: {
            id: true,
            name: true,
            capacity: true,
            deductCount: true,
          },
        },
      },
      // FIFO — 데이 시트가 같은 서비스 권이 여럿이면 먼저 산 것부터 쓴다.
      orderBy: { createdAt: "asc" },
    }),
    prisma.reservation.findMany({
      where: {
        gymId: business.id,
        customerUserId: user.id,
        startAt: { gte: todayMid, lt: todayEndMid },
        status: { notIn: ["CANCELLED", "REJECTED"] },
      },
      include: {
        service: { select: { name: true, capacity: true } },
        staff: { select: { user: { select: { name: true } } } },
      },
      orderBy: { startAt: "asc" },
    }),
    // 캘린더 — 이번 달치. 월 네비는 MeCalendar(클라이언트)가 처리.
    loadMeCalendarMonth(
      business.id,
      user.id,
      todayMid,
      todayMid.getUTCFullYear(),
      todayMid.getUTCMonth() + 1,
    ),
    // QR을 페이지 렌더 시점에 미리 발급 — 탭하면 서버 왕복 없이 즉시 표시.
    requestAccessQr(slug),
  ]);

  const hasAnyPass = membershipCount > 0 || packages.length > 0;

  // 보유 현황 — 횟수권을 서비스별로 묶어 완료/예약중/예약가능 집계.
  // 같은 서비스 권이 여러 장이면 합산(어느 권으로든 예약 가능하므로).
  const openByPkg = new Map<string, number>();
  if (packages.length > 0) {
    const openGroups = await prisma.reservation.groupBy({
      by: ["packageId"],
      where: {
        packageId: { in: packages.map((p) => p.id) },
        status: { in: [...OPEN_STATUSES] },
      },
      _count: { _all: true },
    });
    for (const g of openGroups) {
      if (g.packageId) openByPkg.set(g.packageId, g._count._all);
    }
  }
  const passBySvc = new Map<
    string,
    { name: string; completed: number; booked: number; available: number }
  >();
  for (const p of packages) {
    const completed = p.totalCount - p.remainingCount;
    const booked = (openByPkg.get(p.id) ?? 0) * p.service.deductCount;
    const cur = passBySvc.get(p.service.id) ?? {
      name: p.service.name,
      completed: 0,
      booked: 0,
      available: 0,
    };
    cur.completed += completed;
    cur.booked += booked;
    cur.available += Math.max(0, p.remainingCount - booked);
    passBySvc.set(p.service.id, cur);
  }
  const passes = [...passBySvc.values()];
  // 트레이너 대시보드 오늘 날짜 라벨과 동일 형식: "5/22 (목) · 2026"
  const todayWd = new Intl.DateTimeFormat(
    lang === "en" ? "en-US" : "ko-KR",
    { weekday: "short", timeZone: "UTC" },
  ).format(
    new Date(
      Date.UTC(
        todayMid.getUTCFullYear(),
        todayMid.getUTCMonth(),
        todayMid.getUTCDate(),
        12,
      ),
    ),
  );
  const todayDateLabel = `${todayMid.getUTCMonth() + 1}/${todayMid.getUTCDate()} (${todayWd}) · ${todayMid.getUTCFullYear()}`;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute -top-32 left-1/4 h-[28rem] w-[28rem] rounded-full bg-rose-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 top-1/3 h-[24rem] w-[24rem] rounded-full bg-emerald-400/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 left-0 h-[24rem] w-[28rem] rounded-full bg-sky-400/15 blur-3xl" />

      <header className="relative border-b border-white/5 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-6 py-4">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-200/90">
              {business.name}
            </div>
            <div className="mt-1 font-heading text-lg tracking-tight text-white">
              {user.name}
            </div>
          </div>
          <MeHeaderActions
            slug={slug}
            lang={lang}
            memberName={user.name}
            qrInitial={accessQr}
          />
        </div>
      </header>

      <main className="relative flex-1">
        <div className="mx-auto w-full max-w-3xl space-y-3 px-6 pb-6 pt-4">
          {closureToday && (
            <ClosureBanner
              reason={closureToday.reason}
              kindShortened={closureToday.kind === "SHORTENED"}
              t={t}
            />
          )}

          <TodayHero
            reservations={todayReservations}
            lang={lang}
            dateLabel={todayDateLabel}
            t={t}
          />

          {!hasAnyPass && <NoPassNotice t={t} />}

          {passes.length > 0 && <PassSummary passes={passes} t={t} />}

          <MeCalendar
            slug={slug}
            lang={lang}
            initial={calMonth}
            todayKey={ymdKey(todayMid)}
            maxBookKey={ymdKey(
              new Date(
                Date.UTC(
                  todayMid.getUTCFullYear(),
                  todayMid.getUTCMonth() + 3,
                  todayMid.getUTCDate(),
                ),
              ),
            )}
          />

          <PwaCard />
        </div>
      </main>

      <footer className="relative border-t border-white/5 py-5">
        <div className="flex items-center justify-center gap-4">
          {business.phone && (
            <div className="text-[11px] text-zinc-400">
              {t("frontDeskCall")}{" "}
              <a
                href={`tel:${business.phone}`}
                className="tabular-nums text-zinc-200 underline-offset-2 hover:underline"
              >
                {business.phone}
              </a>
            </div>
          )}
          <form action={logout.bind(null, `/${lang}/g/${slug}/login`)}>
            <button className="text-[11px] text-zinc-500 hover:text-zinc-100">
              {t("logout")}
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}

function ClosureBanner({
  reason,
  kindShortened,
  t,
}: {
  reason: string | null;
  kindShortened: boolean;
  t: T;
}) {
  if (kindShortened) return null;
  return (
    <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 backdrop-blur-xl">
      <div className="font-heading text-sm tracking-tight text-amber-200">
        {t("closureTitle")}
      </div>
      {reason && (
        <div className="mt-1 text-xs text-amber-200/80">
          {t("closureReason", { reason })}
        </div>
      )}
    </div>
  );
}

type TodayReservation = {
  id: string;
  startAt: Date;
  scheduledClassId: string | null;
  status: string;
  service: { name: string; capacity: number };
  staff: { user: { name: string } };
};

function TodayHero({
  reservations,
  lang,
  dateLabel,
  t,
}: {
  reservations: TodayReservation[];
  lang: string;
  dateLabel: string;
  t: T;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/80 p-4">
      <div className="absolute -inset-px rounded-2xl ring-1 ring-rose-300/30" />
      <div className="relative">
        {/* 단일 색 — 밝은 퍼플. 다크 카드 위에서 또렷하게. */}
        <h3 className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-heading text-base font-bold tracking-tight text-purple-300">
            {t("todayTitle")}
          </span>
          <span className="text-xs font-medium tracking-tight text-zinc-300">
            {dateLabel}
          </span>
        </h3>
        {reservations.length === 0 ? (
          <div className="mt-2 text-xs text-zinc-400">{t("todayEmpty")}</div>
        ) : (
          <ul className="mt-2 space-y-1">
            {reservations.map((r) => {
              const isGroup =
                r.scheduledClassId !== null || r.service.capacity !== 1;
              const done = r.status === "COMPLETED";
              const time = formatTime(r.startAt, lang);
              // 트레이너 "오늘 예약"처럼 색상 pill 행 — PT 스카이, 단체 앰버,
              // 완료 에메랄드(캘린더 색과 일관).
              const rowCls = done
                ? "bg-emerald-500/25 text-emerald-50"
                : isGroup
                  ? "bg-amber-400/30 text-amber-50"
                  : "bg-sky-400/30 text-sky-50";
              const timeCls = done
                ? "text-emerald-300"
                : isGroup
                  ? "text-amber-300"
                  : "text-sky-300";
              return (
                <li key={r.id}>
                  <div
                    className={
                      "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm " +
                      rowCls
                    }
                  >
                    <span
                      className={
                        "font-mono text-xs tabular-nums " + timeCls
                      }
                    >
                      {time}
                    </span>
                    <span className="min-w-0 truncate font-medium">
                      {done && "✓ "}
                      {r.service.name}
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-zinc-400">
                      {r.staff.user.name}
                      {suffixTrainer(lang) ? ` ${suffixTrainer(lang)}` : ""}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

// 보유 현황 — 횟수권별 한 줄. 캘린더 바로 위에서 "예약 가능"을 보고
// 달력 날짜를 고르도록. 데이 시트 예약/취소 시 함께 갱신된다.
function PassSummary({
  passes,
  t,
}: {
  passes: {
    name: string;
    completed: number;
    booked: number;
    available: number;
  }[];
  t: T;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
        {t("passSummaryTitle")}
      </h3>
      <ul className="mt-2 space-y-1.5">
        {passes.map((p) => (
          <li
            key={p.name}
            className="flex items-center justify-between gap-3"
          >
            <span className="min-w-0 truncate text-sm font-medium text-white">
              {p.name}
            </span>
            <div className="flex shrink-0 items-baseline gap-2">
              <span
                className={
                  "text-sm font-semibold tabular-nums " +
                  (p.available > 0
                    ? "text-emerald-300"
                    : "text-zinc-500")
                }
              >
                {t("packageAvailableBig", { n: p.available })}
              </span>
              <span className="text-[11px] tabular-nums text-zinc-500">
                {t("passSummaryDetail", {
                  done: p.completed,
                  booked: p.booked,
                })}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NoPassNotice({ t }: { t: T }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <div className="font-heading text-sm tracking-tight text-zinc-200">
        {t("noActiveTitle")}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
        {t("noActiveBody")}
      </p>
    </section>
  );
}

function suffixTrainer(lang: string): string {
  return lang === "en" ? "" : "트레이너";
}

// UTC 파츠 기준 "YYYY-MM-DD" — meCalendar 의 dayKey 와 같은 포맷.
function ymdKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// startAt 은 UTC-naive(Manila 벽시계 = UTC 파츠)라 timeZone 변환 없이
// UTC 로 읽어야 트레이너 캘린더와 같은 시각이 나온다.
function formatTime(d: Date, lang: string): string {
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "ko-KR", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}
