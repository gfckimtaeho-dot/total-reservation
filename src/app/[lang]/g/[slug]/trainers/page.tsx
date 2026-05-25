import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { gymTodayUtcMidnight } from "@/lib/calendar/gymTime";
import { TrainersWhite } from "./TrainersWhite";
import type { TrainerView } from "./TrainerRow";
import type { AttendanceRow } from "./AttendanceMatrix";

type SearchParamsValue = string | string[] | undefined;
type Specialty = "HEALTH" | "YOGA" | "PILATES" | "DANCE";
type Weekday = "SUN" | "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";

const WEEKDAY_BY_INDEX: Weekday[] = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
];

function pickRole(v: SearchParamsValue): "all" | "TRAINER" | "MANAGER" {
  const s = Array.isArray(v) ? v[0] : v;
  if (s === "TRAINER" || s === "MANAGER") return s;
  return "all";
}

function pickString(v: SearchParamsValue): string {
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" ? s.trim() : "";
}

function pickBool(v: SearchParamsValue): boolean {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "1" || s === "true" || s === "on";
}

function pickSpecialties(v: SearchParamsValue): Specialty[] {
  const arr = Array.isArray(v) ? v : v ? [v] : [];
  const valid: Specialty[] = ["HEALTH", "YOGA", "PILATES", "DANCE"];
  return arr.filter((x): x is Specialty =>
    valid.includes(x as Specialty),
  );
}

export default async function GymTrainersPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; slug: string }>;
  searchParams: Promise<Record<string, SearchParamsValue>>;
}) {
  const { lang, slug } = await params;
  const sp = await searchParams;
  const q = pickString(sp.q);
  const role = pickRole(sp.role);
  const specialties = pickSpecialties(sp.specialties);
  const onLeave = pickBool(sp.onLeave);

  const auth = await requireGymStaff(slug);
  const business = auth.business!;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayWeekday = WEEKDAY_BY_INDEX[today.getDay()];

  const where: Prisma.StaffWhereInput = {
    gymId: business.id,
    ...(role !== "all" ? { role } : { role: { in: ["TRAINER", "MANAGER"] } }),
    ...(q
      ? { user: { name: { contains: q, mode: "insensitive" } } }
      : {}),
    ...(specialties.length > 0
      ? { specialties: { hasSome: specialties } }
      : {}),
    ...(onLeave
      ? {
          leaves: {
            some: {
              startDate: { lte: today },
              endDate: { gte: today },
            },
          },
        }
      : {}),
  };

  const rows = await prisma.staff.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          status: true,
          active: true,
        },
      },
      images: {
        orderBy: { position: "asc" },
        take: 1,
        select: { url: true },
      },
      leaves: {
        where: {
          startDate: { lte: today },
          endDate: { gte: today },
        },
        select: { id: true },
      },
    },
  });

  const trainers: TrainerView[] = rows.map((r) => {
    const onLeaveToday = r.leaves.length > 0;
    const regularOff = r.weeklyOffDays.includes(todayWeekday);
    const todayStatus = onLeaveToday
      ? "PERSONAL_OFF"
      : regularOff
        ? "REGULAR_OFF"
        : "WORKING";
    return {
      staffId: r.id,
      userId: r.user.id,
      name: r.user.name,
      role: r.role as "TRAINER" | "MANAGER",
      phone: r.user.phone,
      email: r.user.email,
      primaryPhotoUrl: r.images[0]?.url ?? r.photoUrl ?? null,
      specialties: r.specialties as Specialty[],
      customSpecialty: r.customSpecialty,
      weeklyOffDays: r.weeklyOffDays as Weekday[],
      todayStatus,
      status: r.user.status as TrainerView["status"],
      active: r.user.active,
    };
  });

  const attendance = await loadWeeklyAttendance(
    business.id,
    business.timeZone,
    trainers
      .filter((tr) => tr.role === "TRAINER")
      .map((tr) => ({ userId: tr.userId, name: tr.name })),
  );

  const props = {
    lang,
    slug,
    businessName: business.name,
    trainers,
    q,
    role,
    specialties,
    onLeave,
    attendance,
  };

  return <TrainersWhite {...props} />;
}

const DAY_OF_WEEK: ("SUN" | "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT")[] = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
];

async function loadWeeklyAttendance(
  gymId: string,
  timeZone: string,
  trainers: { userId: string; name: string }[],
): Promise<AttendanceRow[]> {
  if (trainers.length === 0) return [];

  const now = new Date();
  const todayMid = gymTodayUtcMidnight(timeZone, now);
  // 월요일을 컬럼 0으로. UTC-naive 자정이라 getUTCDay 그대로 매장 요일.
  const dow = todayMid.getUTCDay();
  const offsetToMonday = (dow + 6) % 7;
  const monday = new Date(todayMid.getTime() - offsetToMonday * 86400000);
  const nextMonday = new Date(monday.getTime() + 7 * 86400000);

  const [accessLogs, businessHours] = await Promise.all([
    prisma.accessLog.findMany({
      where: {
        gymId,
        result: "ALLOWED",
        userId: { in: trainers.map((t) => t.userId) },
        occurredAt: { gte: monday, lt: nextMonday },
      },
      orderBy: { occurredAt: "asc" },
      select: { userId: true, occurredAt: true },
    }),
    prisma.businessHours.findMany({ where: { gymId } }),
  ]);

  // dow=0(일) → 6, dow=1(월) → 0, …  컬럼 0=월요일, 6=일요일 매핑.
  // BusinessHours row 자체가 없으면 그 요일은 휴무이므로 openByCol은 null.
  const openByCol = new Array<number | null>(7).fill(null);
  for (const bh of businessHours) {
    const idx = DAY_OF_WEEK.indexOf(bh.weekday);
    if (idx < 0) continue;
    const colIdx = (idx + 6) % 7;
    openByCol[colIdx] = bh.openMinute;
  }

  // 트레이너 × 컬럼별 가장 이른 출입 시각
  const firstByUserCol = new Map<string, (Date | null)[]>();
  for (const t of trainers) {
    firstByUserCol.set(t.userId, new Array<Date | null>(7).fill(null));
  }
  for (const log of accessLogs) {
    const col = Math.floor(
      (log.occurredAt.getTime() - monday.getTime()) / 86400000,
    );
    if (col < 0 || col > 6) continue;
    const arr = firstByUserCol.get(log.userId);
    if (!arr) continue;
    if (arr[col] == null) arr[col] = log.occurredAt;
  }

  return trainers.map((t) => {
    const arr = firstByUserCol.get(t.userId)!;
    return {
      userId: t.userId,
      name: t.name,
      cells: arr.map((d, col) => {
        if (!d) return null;
        const hour = d.getUTCHours();
        const min = d.getUTCMinutes();
        const checkInMin = hour * 60 + min;
        const open = openByCol[col];
        const lateMin = open != null ? checkInMin - open : null;
        return { hour, min, lateMin };
      }),
    };
  });
}
