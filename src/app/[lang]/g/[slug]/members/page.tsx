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
        active: true,
        emergencyContactPhone: true,
        locale: true,
        memberships: {
          orderBy: { endDate: "desc" },
          take: 1,
          select: { endDate: true },
        },
        packages: {
          // 잔여 0 권은 회원관리 그리드에서 표시 제외.
          where: { remainingCount: { gt: 0 } },
          select: {
            remainingCount: true,
            service: { select: { name: true, capacity: true } },
          },
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
    // 서비스별 잔여 분리 — 같은 서비스에 권이 여러 장이면 합산.
    // 1:1(capacity=1) 과 단체(capacity>1) 는 다른 줄로 노출.
    const perService = new Map<
      string,
      { name: string; isGroup: boolean; total: number }
    >();
    for (const p of r.packages) {
      const isGroup = p.service.capacity > 1;
      const key = `${isGroup ? "G" : "P"}::${p.service.name}`;
      const cur = perService.get(key) ?? {
        name: p.service.name,
        isGroup,
        total: 0,
      };
      cur.total += p.remainingCount;
      perService.set(key, cur);
    }
    const remainingPerService = Array.from(perService.values())
      .sort((a, b) =>
        a.isGroup === b.isGroup
          ? a.name.localeCompare(b.name)
          : a.isGroup
            ? 1
            : -1,
      )
      .map((v) => ({
        name: v.name,
        isGroup: v.isGroup,
        count: remainingFmt.format(v.total),
      }));
    return {
      id: r.id,
      name: r.name,
      gender: r.gender as "MALE" | "FEMALE" | null,
      phone: r.phone,
      email: r.email,
      age: r.dob ? differenceInYears(today, r.dob) : null,
      dob: r.dob ? r.dob.toISOString().slice(0, 10) : null,
      emergencyContactPhone: r.emergencyContactPhone,
      locale: r.locale as "en" | "ko",
      active: r.active,
      note: r.note,
      status: r.status as MemberView["status"],
      nextExpiry: latestExpiry
        ? latestExpiry.toISOString().slice(0, 10)
        : null,
      expiringSoon: expSoon,
      remainingPerService,
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
