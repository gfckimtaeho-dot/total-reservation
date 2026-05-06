import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { getTheme } from "@/lib/theme";
import { TrainersNormal } from "./TrainersNormal";
import { TrainersBlack } from "./TrainersBlack";
import { TrainersWhite } from "./TrainersWhite";
import type { TrainerView } from "./TrainerRow";

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
    };
  });

  const props = {
    lang,
    slug,
    businessName: business.name,
    trainers,
    q,
    role,
    specialties,
    onLeave,
  };

  const theme = await getTheme();
  if (theme === "black") return <TrainersBlack {...props} />;
  if (theme === "white") return <TrainersWhite {...props} />;
  return <TrainersNormal {...props} />;
}
