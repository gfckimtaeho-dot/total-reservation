import { differenceInYears } from "date-fns";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { getTheme } from "@/lib/theme";
import { MembersNormal } from "./MembersNormal";
import { MembersBlack } from "./MembersBlack";
import { MembersWhite } from "./MembersWhite";
import type { MemberView } from "./MemberRow";

type SearchParamsValue = string | string[] | undefined;

function pickGender(v: SearchParamsValue): "all" | "MALE" | "FEMALE" {
  const s = Array.isArray(v) ? v[0] : v;
  if (s === "MALE" || s === "FEMALE") return s;
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

export default async function GymMembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; slug: string }>;
  searchParams: Promise<Record<string, SearchParamsValue>>;
}) {
  const { lang, slug } = await params;
  const sp = await searchParams;
  const q = pickString(sp.q);
  const gender = pickGender(sp.gender);
  const expiringSoon = pickBool(sp.expiringSoon);

  const auth = await requireGymStaff(slug);
  const business = auth.business!;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDays = new Date(today);
  sevenDays.setDate(sevenDays.getDate() + 7);
  const thirtyDays = new Date(today);
  thirtyDays.setDate(thirtyDays.getDate() + 30);

  const where: Prisma.UserWhereInput = {
    gymId: business.id,
    role: "CUSTOMER",
    ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    ...(gender !== "all" ? { gender } : {}),
    ...(expiringSoon
      ? {
          memberships: {
            some: {
              endDate: { gte: today, lte: sevenDays },
            },
          },
        }
      : {}),
  };

  const [rows, expireWeekCount, expireMonthCount] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        gender: true,
        phone: true,
        email: true,
        dob: true,
        note: true,
        status: true,
        memberships: {
          orderBy: { endDate: "desc" },
          take: 1,
          select: { endDate: true },
        },
        packages: {
          select: { remainingCount: true },
        },
      },
    }),
    // distinct 회원 수 (같은 회원이 여러 membership 가질 수 있어 user 단위)
    prisma.user.count({
      where: {
        gymId: business.id,
        role: "CUSTOMER",
        memberships: {
          some: { endDate: { gte: today, lte: sevenDays } },
        },
      },
    }),
    prisma.user.count({
      where: {
        gymId: business.id,
        role: "CUSTOMER",
        memberships: {
          some: { endDate: { gte: today, lte: thirtyDays } },
        },
      },
    }),
  ]);

  const remainingFmt = new Intl.NumberFormat(
    lang === "en" ? "en-US" : "ko-KR",
    { minimumFractionDigits: 1, maximumFractionDigits: 1 },
  );

  const members: MemberView[] = rows.map((r) => {
    const latestExpiry = r.memberships[0]?.endDate ?? null;
    const expSoon =
      latestExpiry !== null &&
      latestExpiry >= today &&
      latestExpiry <= sevenDays;
    const remaining = r.packages.reduce(
      (sum, p) => sum + Number(p.remainingCount),
      0,
    );
    return {
      id: r.id,
      name: r.name,
      gender: r.gender as "MALE" | "FEMALE" | null,
      phone: r.phone,
      email: r.email,
      age: r.dob ? differenceInYears(today, r.dob) : null,
      note: r.note,
      status: r.status as MemberView["status"],
      nextExpiry: latestExpiry
        ? latestExpiry.toISOString().slice(0, 10)
        : null,
      expiringSoon: expSoon,
      remainingSessions: remainingFmt.format(remaining),
    };
  });

  const props = {
    lang,
    slug,
    businessName: business.name,
    members,
    q,
    gender,
    expiringSoon,
    expireWeekCount,
    expireMonthCount,
  };

  const theme = await getTheme();
  if (theme === "black") return <MembersBlack {...props} />;
  if (theme === "white") return <MembersWhite {...props} />;
  return <MembersNormal {...props} />;
}
