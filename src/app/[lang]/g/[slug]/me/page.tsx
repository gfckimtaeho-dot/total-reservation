import { getTranslations } from "next-intl/server";
import { logout } from "@/lib/auth/actions";
import { requireGymCustomer } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import {
  manilaTodayUtcMidnight,
  manilaTodayRange,
} from "@/lib/calendar/manila";
import { MeAccessQr } from "./MeAccessQr";
import { UpcomingItem } from "./UpcomingItem";
import { PwaCard } from "./PwaCard";
import { ClassOccurrenceList } from "./ClassOccurrenceList";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SOON_DAYS = 7;

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

  const todayMid = manilaTodayUtcMidnight();
  const { start: todayStart, end: todayEnd } = manilaTodayRange();

  // 캘린더 5주: 오늘 속한 주의 일요일부터 35일
  const weekStartUtcMid = new Date(
    todayMid.getTime() - todayMid.getUTCDay() * MS_PER_DAY,
  );
  const calStart = new Date(
    weekStartUtcMid.getTime() - 8 * 60 * 60 * 1000, // UTC mid → Manila 00:00의 real UTC
  );
  const calEnd = new Date(calStart.getTime() + 35 * MS_PER_DAY);

  const [
    closureToday,
    memberships,
    packages,
    todayReservations,
    upcoming,
    calReservations,
    scheduledClasses,
  ] = await Promise.all([
    prisma.businessClosure.findFirst({
      where: { gymId: business.id, date: todayMid },
      select: {
        kind: true,
        reason: true,
        openMinute: true,
        closeMinute: true,
      },
    }),
    prisma.membership.findMany({
      where: {
        gymId: business.id,
        userId: user.id,
        endDate: { gte: todayMid },
      },
      include: { plan: { select: { name: true } } },
      orderBy: { endDate: "asc" },
    }),
    prisma.package.findMany({
      where: {
        gymId: business.id,
        userId: user.id,
        remainingCount: { gt: 0 },
      },
      include: {
        service: { select: { id: true, name: true, capacity: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.reservation.findMany({
      where: {
        gymId: business.id,
        customerUserId: user.id,
        startAt: { gte: todayStart, lt: todayEnd },
        status: { notIn: ["CANCELLED", "REJECTED"] },
      },
      include: {
        service: { select: { name: true, capacity: true } },
        staff: { select: { user: { select: { name: true } } } },
      },
      orderBy: { startAt: "asc" },
    }),
    prisma.reservation.findMany({
      where: {
        gymId: business.id,
        customerUserId: user.id,
        startAt: { gte: todayEnd },
        status: { notIn: ["CANCELLED", "REJECTED"] },
      },
      include: {
        service: { select: { name: true, capacity: true } },
        staff: { select: { user: { select: { name: true } } } },
      },
      orderBy: { startAt: "asc" },
      take: 20,
    }),
    prisma.reservation.findMany({
      where: {
        gymId: business.id,
        customerUserId: user.id,
        startAt: { gte: calStart, lt: calEnd },
        status: { notIn: ["CANCELLED", "REJECTED"] },
      },
      select: {
        startAt: true,
        scheduledClassId: true,
        service: { select: { capacity: true } },
      },
    }),
    prisma.scheduledClass.findMany({
      where: {
        gymId: business.id,
        active: true,
        OR: [{ validUntil: null }, { validUntil: { gte: todayMid } }],
      },
      select: {
        id: true,
        serviceId: true,
        kind: true,
        weekdays: true,
        specificDate: true,
        startMinute: true,
        validFrom: true,
        validUntil: true,
        service: {
          select: {
            id: true,
            name: true,
            capacity: true,
            durationMin: true,
          },
        },
        staff: { select: { user: { select: { name: true } } } },
        reservations: {
          where: {
            status: { notIn: ["CANCELLED", "REJECTED"] },
            startAt: { gte: todayStart },
          },
          select: { startAt: true, customerUserId: true },
        },
      },
      orderBy: { startMinute: "asc" },
    }),
  ]);

  const hasAnyPass = memberships.length > 0 || packages.length > 0;
  const headerDate = formatDate(todayStart, lang, {
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  // 단체 횟수권(service.capacity > 1) 보유 service IDs → 일정 안내 대상
  const groupServiceIds = new Set(
    packages
      .filter((p) => p.service.capacity > 1)
      .map((p) => p.service.id),
  );
  const myGroupSchedules = scheduledClasses.filter((sc) =>
    groupServiceIds.has(sc.serviceId),
  );

  // 단체 schedule 다음 14일치 occurrence 전개 — 내일부터 14일.
  const WEEKDAY_ENUM = [
    "SUN",
    "MON",
    "TUE",
    "WED",
    "THU",
    "FRI",
    "SAT",
  ] as const;
  const occurrences: {
    scheduleId: string;
    year: number;
    month: number;
    day: number;
    weekdayIdx: number;
    startMin: number;
    durationMin: number;
    serviceName: string;
    staffName: string | null;
    capacity: number;
    enrolled: number;
    joined: boolean;
  }[] = [];
  for (const sc of myGroupSchedules) {
    for (let i = 1; i <= 14; i++) {
      const d = new Date(todayMid.getTime() + i * MS_PER_DAY);
      if (d < sc.validFrom) continue;
      if (sc.validUntil && d > sc.validUntil) continue;
      if (sc.kind === "ONE_OFF") {
        if (!sc.specificDate) continue;
        if (sc.specificDate.getTime() !== d.getTime()) continue;
      } else {
        const wd = WEEKDAY_ENUM[d.getUTCDay()]!;
        if (!sc.weekdays.includes(wd)) continue;
      }
      const dayStart = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
      );
      const dayEnd = new Date(dayStart.getTime() + MS_PER_DAY);
      const matched = sc.reservations.filter(
        (r) => r.startAt >= dayStart && r.startAt < dayEnd,
      );
      occurrences.push({
        scheduleId: sc.id,
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1,
        day: d.getUTCDate(),
        weekdayIdx: d.getUTCDay(),
        startMin: sc.startMinute,
        durationMin: sc.service.durationMin,
        serviceName: sc.service.name,
        staffName: sc.staff?.user.name ?? null,
        capacity: sc.service.capacity,
        enrolled: matched.length,
        joined: matched.some((r) => r.customerUserId === user.id),
      });
    }
  }
  occurrences.sort(
    (a, b) =>
      a.year - b.year ||
      a.month - b.month ||
      a.day - b.day ||
      a.startMin - b.startMin,
  );

  const eventByDayKey = buildEventMap(calReservations);
  const cells = buildCalendarCells(weekStartUtcMid, todayMid, eventByDayKey);

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute -top-32 left-1/4 h-[28rem] w-[28rem] rounded-full bg-rose-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 top-1/3 h-[24rem] w-[24rem] rounded-full bg-emerald-400/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 left-0 h-[24rem] w-[28rem] rounded-full bg-sky-400/15 blur-3xl" />

      <header className="relative border-b border-white/5 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-start justify-between px-6 py-5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-200/90">
              {business.name}
            </div>
            <div className="mt-1 font-heading text-lg tracking-tight text-white">
              {user.name}
            </div>
            <div className="mt-0.5 text-xs text-zinc-300/80">
              {t("todayLabel")} · {headerDate}
            </div>
          </div>
          <form action={logout.bind(null, `/${lang}/g/${slug}/login`)}>
            <button className="text-xs text-zinc-400 hover:text-zinc-100">
              {t("logout")}
            </button>
          </form>
        </div>
      </header>

      <main className="relative flex-1">
        <div className="mx-auto w-full max-w-3xl space-y-4 px-6 py-6">
          {closureToday && (
            <ClosureBanner
              reason={closureToday.reason}
              kindShortened={closureToday.kind === "SHORTENED"}
              t={t}
            />
          )}

          <TodayHero reservations={todayReservations} lang={lang} t={t} />

          <MeAccessQr slug={slug} />

          {hasAnyPass ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {memberships.length > 0 && (
                <MembershipsCard
                  memberships={memberships}
                  todayMid={todayMid}
                  lang={lang}
                  t={t}
                />
              )}
              {packages.length > 0 && (
                <PackagesCard
                  packages={packages}
                  lang={lang}
                  slug={slug}
                  t={t}
                />
              )}
            </div>
          ) : (
            <NoPassCard t={t} />
          )}

          {groupServiceIds.size > 0 && (
            <ClassOccurrenceList
              slug={slug}
              lang={lang}
              occurrences={occurrences}
            />
          )}

          <CalendarSection cells={cells} t={t} />

          <UpcomingSection
            items={upcoming}
            lang={lang}
            slug={slug}
            t={t}
          />

          <PwaCard />
        </div>
      </main>

      <footer className="relative border-t border-white/5 py-6 text-center text-xs text-zinc-500">
        © 2026 예약가즈아 · /g/{slug}
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
  endAt: Date;
  scheduledClassId: string | null;
  service: { name: string; capacity: number };
  staff: { user: { name: string } };
};

// V5 글래스 카드 + 한 줄 형식 ("18:00 PT Kevin 트레이너")
function TodayHero({
  reservations,
  lang,
  t,
}: {
  reservations: TodayReservation[];
  lang: string;
  t: T;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <div className="absolute -inset-px rounded-3xl ring-1 ring-rose-300/30" />
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-rose-300/30 blur-3xl" />
      <div className="relative">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-200/90">
          {t("todayTitle")}
        </div>
        {reservations.length === 0 ? (
          <div className="mt-3 text-sm text-zinc-400">{t("todayEmpty")}</div>
        ) : (
          <ul className="mt-3 space-y-2">
            {reservations.map((r) => {
              const isGroup =
                r.scheduledClassId !== null || r.service.capacity !== 1;
              const time = formatTime(r.startAt, lang);
              return (
                <li
                  key={r.id}
                  className="flex items-baseline gap-3 text-zinc-100"
                >
                  <span className="font-heading text-2xl tracking-tight tabular-nums text-white drop-shadow-[0_0_18px_rgba(252,165,165,0.45)]">
                    {time}
                  </span>
                  <span className="text-base">
                    {isGroup
                      ? t("todayLineGroup", {
                          time: "",
                          service: r.service.name,
                          trainer: r.staff.user.name,
                        }).replace(/^\s+/, "")
                      : `${r.service.name} · ${r.staff.user.name} ${suffixTrainer(lang)}`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

type MembershipRow = {
  id: string;
  endDate: Date;
  plan: { name: string } | null;
};

function MembershipsCard({
  memberships,
  todayMid,
  lang,
  t,
}: {
  memberships: MembershipRow[];
  todayMid: Date;
  lang: string;
  t: T;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-200/90">
        {t("membershipsTitle")}
      </div>
      <ul className="mt-3 space-y-2.5">
        {memberships.map((m) => {
          const daysLeft = Math.max(
            0,
            Math.round((m.endDate.getTime() - todayMid.getTime()) / MS_PER_DAY),
          );
          const soon = daysLeft <= SOON_DAYS;
          const expiresLabel = formatDate(m.endDate, lang, {
            year: "numeric",
            month: "long",
            day: "numeric",
          });
          return (
            <li key={m.id} className="text-sm">
              <div className="flex items-baseline justify-between">
                <div className="font-medium text-white">
                  {m.plan?.name ?? t("membershipsTitle")}
                </div>
                <div
                  className={
                    "font-heading tabular-nums " +
                    (soon ? "text-amber-200" : "text-zinc-100")
                  }
                >
                  {t("membershipDaysLeft", { n: daysLeft })}
                </div>
              </div>
              <div
                className={
                  "text-xs " + (soon ? "text-amber-200/80" : "text-zinc-400")
                }
              >
                {t("membershipExpiresOn", { date: expiresLabel })}
                {soon && (
                  <span className="ml-1 font-semibold">
                    · {t("membershipExpiringSoon")}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

type PackageRow = {
  id: string;
  remainingCount: { toString: () => string } | number;
  totalCount: { toString: () => string } | number;
  service: { id: string; name: string; capacity: number };
};

function PackagesCard({
  packages,
  lang,
  slug,
  t,
}: {
  packages: PackageRow[];
  lang: string;
  slug: string;
  t: T;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-200/90">
        {t("packagesTitle")}
      </div>
      <ul className="mt-3 space-y-2.5">
        {packages.map((p) => {
          const remaining = decimalToDisplay(p.remainingCount);
          const total = decimalToDisplay(p.totalCount);
          const isPersonal = p.service.capacity === 1;
          return (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3"
            >
              <div className="min-w-0 text-sm">
                <div className="font-medium text-white">{p.service.name}</div>
                <div className="text-xs text-zinc-400 tabular-nums">
                  <span className="text-emerald-200">{remaining}</span>
                  <span className="text-zinc-500"> /{total}</span>
                </div>
              </div>
              {isPersonal && (
                <a
                  href={`/${lang}/g/${slug}/me/reservations/new?pkg=${p.id}`}
                  className="shrink-0 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-3 py-1 text-xs font-semibold text-white shadow-[0_4px_14px_-6px_rgba(251,146,60,0.6)] hover:brightness-110"
                >
                  {t("actionBook")}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function NoPassCard({ t }: { t: T }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
      <div className="font-heading text-base tracking-tight text-zinc-200">
        {t("noActiveTitle")}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        {t("noActiveBody")}
      </p>
    </section>
  );
}


// V8 sunset 그라데 chip 캘린더 — 오늘=full 그라데, PT=orange, 단체=purple, 둘다=그라데
type CalCell = {
  dayKey: string;
  day: number;
  month: number;
  weekdayIdx: number;
  isToday: boolean;
  isPast: boolean;
  isCurrentMonth: boolean;
  hasEvent: boolean;
  isPersonal: boolean;
  isGroup: boolean;
};

function CalendarSection({ cells, t }: { cells: CalCell[]; t: T }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <div className="flex items-baseline justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-300">
          {t("weeksAhead")}
        </div>
        <div className="flex gap-3 text-[10px] text-zinc-400">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />{" "}
            {t("legendPersonal")}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />{" "}
            {t("legendGroup")}
          </span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1.5 text-center text-[10px] text-zinc-400">
        {["일", "월", "화", "수", "목", "금", "토"].map((w) => (
          <div key={w} className="pb-1">
            {w}
          </div>
        ))}
        {cells.map((c) => {
          const dim = !c.isCurrentMonth || c.isPast;
          let cls = "";
          if (c.isToday) {
            cls =
              "bg-gradient-to-br from-orange-400 via-pink-500 to-purple-500 text-white shadow-[0_0_16px_-4px_rgba(251,113,133,0.6)]";
          } else if (c.isPersonal && c.isGroup) {
            cls =
              "bg-gradient-to-br from-orange-400/30 to-purple-500/30 text-white ring-1 ring-pink-400/40";
          } else if (c.isPersonal) {
            cls = "bg-orange-500/20 text-white ring-1 ring-orange-400/40";
          } else if (c.isGroup) {
            cls = "bg-purple-500/20 text-white ring-1 ring-purple-400/40";
          } else {
            cls = dim ? "text-zinc-600" : "text-zinc-300";
          }
          return (
            <div
              key={c.dayKey}
              className={
                "flex h-11 items-center justify-center rounded-xl text-sm tabular-nums transition " +
                cls
              }
            >
              {c.day}
            </div>
          );
        })}
      </div>
    </section>
  );
}

type UpcomingRow = {
  id: string;
  startAt: Date;
  endAt: Date;
  scheduledClassId: string | null;
  service: { name: string; capacity: number };
  staff: { user: { name: string } };
};

function UpcomingSection({
  items,
  lang,
  slug,
  t,
}: {
  items: UpcomingRow[];
  lang: string;
  slug: string;
  t: T;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-300">
        {t("upcomingTitle")}
      </h2>
      {items.length === 0 ? (
        <div className="mt-3 text-sm text-zinc-400">{t("upcomingEmpty")}</div>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((r) => {
            const isGroup =
              r.scheduledClassId !== null || r.service.capacity !== 1;
            const dateLabel = formatShortDate(r.startAt, lang);
            const timeLabel = formatTime(r.startAt, lang);
            return (
              <UpcomingItem
                key={r.id}
                id={r.id}
                serviceName={r.service.name}
                staffName={r.staff.user.name}
                isPersonal={
                  r.scheduledClassId === null && r.service.capacity === 1
                }
                isGroup={isGroup}
                startAtIso={r.startAt.toISOString()}
                dateLabel={dateLabel}
                timeLabel={timeLabel}
                sameDay={false}
                lang={lang}
                slug={slug}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ─── helpers ────────────────────────────────────────────────

function suffixTrainer(lang: string): string {
  return lang === "en" ? "" : "트레이너";
}

function formatDate(
  d: Date,
  lang: string,
  opts: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "ko-KR", {
    timeZone: "Asia/Manila",
    ...opts,
  }).format(d);
}

function formatShortDate(d: Date, lang: string): string {
  // "05-22" 같은 짧은 표기 (한국어 기준), 영어는 "May 22"
  if (lang === "en") {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      month: "short",
      day: "numeric",
    }).format(d);
  }
  const m = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Manila",
    month: "2-digit",
  }).format(d);
  const day = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Manila",
    day: "2-digit",
  }).format(d);
  return `${m.replace("월", "").trim().padStart(2, "0")}-${day.replace("일", "").trim().padStart(2, "0")}`;
}

function formatTime(d: Date, lang: string): string {
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "ko-KR", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function decimalToDisplay(v: { toString: () => string } | number): string {
  const s = typeof v === "number" ? String(v) : v.toString();
  if (s.endsWith(".0")) return s.slice(0, -2);
  return s;
}

function buildEventMap(
  rows: {
    startAt: Date;
    scheduledClassId: string | null;
    service: { capacity: number };
  }[],
): Map<string, { isPersonal: boolean; isGroup: boolean }> {
  const m = new Map<string, { isPersonal: boolean; isGroup: boolean }>();
  for (const r of rows) {
    const key = manilaDayKey(r.startAt);
    const cur = m.get(key) ?? { isPersonal: false, isGroup: false };
    const isGroup =
      r.scheduledClassId !== null || (r.service?.capacity ?? 1) !== 1;
    if (isGroup) cur.isGroup = true;
    else cur.isPersonal = true;
    m.set(key, cur);
  }
  return m;
}

// reservation.startAt(UTC-naive Manila)이 속한 Manila 달력일의 YYYY-MM-DD
function manilaDayKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const dd = d.getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function buildCalendarCells(
  weekStartUtcMid: Date,
  todayUtcMid: Date,
  events: Map<string, { isPersonal: boolean; isGroup: boolean }>,
): CalCell[] {
  const todayKey = manilaDayKey(todayUtcMid);
  const currentMonth = todayUtcMid.getUTCMonth() + 1;
  const cells: CalCell[] = [];
  for (let i = 0; i < 35; i++) {
    const d = new Date(weekStartUtcMid.getTime() + i * MS_PER_DAY);
    const key = manilaDayKey(d);
    const ev = events.get(key);
    cells.push({
      dayKey: key,
      day: d.getUTCDate(),
      month: d.getUTCMonth() + 1,
      weekdayIdx: d.getUTCDay(),
      isToday: key === todayKey,
      isPast: key < todayKey,
      isCurrentMonth: d.getUTCMonth() + 1 === currentMonth,
      hasEvent: !!ev,
      isPersonal: ev?.isPersonal ?? false,
      isGroup: ev?.isGroup ?? false,
    });
  }
  return cells;
}
