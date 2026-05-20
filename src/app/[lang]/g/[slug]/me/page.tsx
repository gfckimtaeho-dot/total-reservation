import { getTranslations } from "next-intl/server";
import { logout } from "@/lib/auth/actions";
import { requireGymCustomer } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import {
  manilaTodayUtcMidnight,
  manilaTodayRange,
} from "@/lib/calendar/manila";
import { UpcomingItem } from "./UpcomingItem";
import { PwaCard } from "./PwaCard";
import { ClassOccurrenceList } from "./ClassOccurrenceList";
import { MeHeaderActions } from "./MeHeaderActions";
import type { Weekday } from "@/generated/prisma/enums";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SOON_DAYS = 7;

type T = (key: string, vars?: Record<string, string | number>) => string;

const WEEKDAY_ENUM = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
] as const;

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

  const weekStartUtcMid = new Date(
    todayMid.getTime() - todayMid.getUTCDay() * MS_PER_DAY,
  );
  const calStart = new Date(
    weekStartUtcMid.getTime() - 8 * 60 * 60 * 1000,
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
    businessHours,
    closures,
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
        assignedStaff: {
          select: {
            id: true,
            photoUrl: true,
            specialties: true,
            career: true,
            bio: true,
            weeklyOffDays: true,
            user: { select: { name: true, phone: true } },
          },
        },
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
    prisma.businessHours.findMany({
      where: { gymId: business.id },
      select: { weekday: true, openMinute: true, closeMinute: true },
    }),
    prisma.businessClosure.findMany({
      where: {
        gymId: business.id,
        date: { gte: calStart, lt: calEnd },
      },
      select: { date: true, kind: true },
    }),
  ]);

  const oneOnOneStaffIds = Array.from(
    new Set(
      packages
        .filter((p) => p.service.capacity === 1 && p.assignedStaffId)
        .map((p) => p.assignedStaffId!),
    ),
  );
  const has1on1 = oneOnOneStaffIds.length > 0;

  // 담당 staff 휴가 (5주분과 겹치는 leave) — 5주 셀 dim 계산용
  const staffLeaves = has1on1
    ? await prisma.staffLeave.findMany({
        where: {
          gymId: business.id,
          staffId: { in: oneOnOneStaffIds },
          startDate: { lt: calEnd },
          endDate: { gte: calStart },
        },
        select: { staffId: true, startDate: true, endDate: true },
      })
    : [];

  const hasAnyPass = memberships.length > 0 || packages.length > 0;
  const headerDate = formatDate(todayStart, lang, {
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  const groupServiceIds = new Set(
    packages
      .filter((p) => p.service.capacity > 1)
      .map((p) => p.service.id),
  );
  const myGroupSchedules = scheduledClasses.filter((sc) =>
    groupServiceIds.has(sc.serviceId),
  );

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

  const weekdayOpenSet = new Set(businessHours.map((bh) => bh.weekday));
  const closedDateSet = new Set(
    closures
      .filter((c) => c.kind === "CLOSED")
      .map((c) => manilaDayKey(c.date)),
  );

  const my1on1Staff = packages
    .filter((p) => p.service.capacity === 1 && p.assignedStaff)
    .map((p) => p.assignedStaff!);
  const leaveDateKeysByStaff = buildLeaveDateKeysByStaff(staffLeaves);

  const cells = buildCalendarCells(
    weekStartUtcMid,
    todayMid,
    eventByDayKey,
    weekdayOpenSet,
    closedDateSet,
    my1on1Staff,
    leaveDateKeysByStaff,
  );

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute -top-32 left-1/4 h-[28rem] w-[28rem] rounded-full bg-rose-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 top-1/3 h-[24rem] w-[24rem] rounded-full bg-emerald-400/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 left-0 h-[24rem] w-[28rem] rounded-full bg-sky-400/15 blur-3xl" />

      <header className="relative border-b border-white/5 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-6 py-5">
          <div className="min-w-0">
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
          <MeHeaderActions
            slug={slug}
            lang={lang}
            memberName={user.name}
          />
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

          {!hasAnyPass && <NoPassNotice t={t} />}

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

      <footer className="relative border-t border-white/5 py-5 text-center">
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
        <form
          action={logout.bind(null, `/${lang}/g/${slug}/login`)}
          className="mt-2"
        >
          <button className="text-[11px] text-zinc-500 hover:text-zinc-100">
            {t("logout")}
          </button>
        </form>
        <div className="mt-2 text-[10px] text-zinc-600">
          © 2026 예약가즈아 · /g/{slug}
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
  endAt: Date;
  scheduledClassId: string | null;
  service: { name: string; capacity: number };
  staff: { user: { name: string } };
};

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
  isOpen: boolean;
  isStaffAvailable: boolean;
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
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />{" "}
            {t("legendClosed")}
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
          const inactive = !c.isOpen || !c.isStaffAvailable;
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
          } else if (inactive) {
            cls = "bg-zinc-900/40 text-zinc-700";
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

function manilaDayKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const dd = d.getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

type StaffMini = {
  id: string;
  weeklyOffDays: Weekday[];
};

function buildLeaveDateKeysByStaff(
  leaves: { staffId: string; startDate: Date; endDate: Date }[],
): Map<string, Set<string>> {
  // staffId -> { "YYYY-MM-DD" of every leave day }
  const m = new Map<string, Set<string>>();
  for (const lv of leaves) {
    const set = m.get(lv.staffId) ?? new Set<string>();
    let cur = new Date(lv.startDate.getTime());
    const end = lv.endDate.getTime();
    while (cur.getTime() <= end) {
      set.add(manilaDayKey(cur));
      cur = new Date(cur.getTime() + MS_PER_DAY);
    }
    m.set(lv.staffId, set);
  }
  return m;
}

function buildCalendarCells(
  weekStartUtcMid: Date,
  todayUtcMid: Date,
  events: Map<string, { isPersonal: boolean; isGroup: boolean }>,
  weekdayOpenSet: Set<string>,
  closedDateSet: Set<string>,
  my1on1Staff: StaffMini[],
  leaveDateKeysByStaff: Map<string, Set<string>>,
): CalCell[] {
  const todayKey = manilaDayKey(todayUtcMid);
  const currentMonth = todayUtcMid.getUTCMonth() + 1;
  const cells: CalCell[] = [];
  const hasAnyAssigned = my1on1Staff.length > 0;
  for (let i = 0; i < 35; i++) {
    const d = new Date(weekStartUtcMid.getTime() + i * MS_PER_DAY);
    const key = manilaDayKey(d);
    const wd = WEEKDAY_ENUM[d.getUTCDay()]!;
    const ev = events.get(key);
    const isOpen = weekdayOpenSet.has(wd) && !closedDateSet.has(key);
    // 본인 1:1권 담당 트레이너 중 1명이라도 그 날 가용이면 true.
    // 가용 = weeklyOffDays에 그 요일 없음 AND 휴가 아님.
    // 1:1권 없으면 의미 없어 true 처리(필터 dim 안 함).
    let isStaffAvailable = !hasAnyAssigned;
    if (hasAnyAssigned) {
      for (const s of my1on1Staff) {
        if (s.weeklyOffDays.includes(wd as Weekday)) continue;
        const leaveSet = leaveDateKeysByStaff.get(s.id);
        if (leaveSet && leaveSet.has(key)) continue;
        isStaffAvailable = true;
        break;
      }
    }
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
      isOpen,
      isStaffAvailable,
    });
  }
  return cells;
}
