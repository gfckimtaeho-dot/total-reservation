"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import type { Weekday } from "@/generated/prisma/enums";
import { ClosureKind } from "@/generated/prisma/enums";

const ALL_WEEKDAYS: Weekday[] = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
];

// "HH:MM" → 분. 24:00 = 1440 허용 (24시간 영업).
function parseTime(value: string): number | null {
  const m = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 24 || min < 0 || min > 59) return null;
  if (h === 24 && min !== 0) return null;
  return h * 60 + min;
}

const dayPayload = z.object({
  weekday: z.enum(["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]),
  open: z.boolean(),
  openTime: z.string(),
  closeTime: z.string(),
  breakStartTime: z.string().optional(),
  breakEndTime: z.string().optional(),
});

const schema = z.object({
  slug: z.string().min(1),
  days: z.array(dayPayload).length(7),
});

export type SaveHoursState = {
  errors?: Record<string, string[] | undefined>;
  ok?: boolean;
};

export async function saveBusinessHours(
  _prev: SaveHoursState,
  formData: FormData,
): Promise<SaveHoursState> {
  const slug = String(formData.get("slug") ?? "");
  const days: z.infer<typeof dayPayload>[] = ALL_WEEKDAYS.map((w) => ({
    weekday: w,
    open: formData.get(`open_${w}`) === "on",
    openTime: String(formData.get(`openTime_${w}`) ?? ""),
    closeTime: String(formData.get(`closeTime_${w}`) ?? ""),
    breakStartTime: String(formData.get(`breakStartTime_${w}`) ?? ""),
    breakEndTime: String(formData.get(`breakEndTime_${w}`) ?? ""),
  }));

  const parsed = schema.safeParse({ slug, days });
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  }

  const auth = await requireGymStaff(parsed.data.slug);
  if (auth.role !== "OWNER" && auth.role !== "MANAGER") {
    return { errors: { _global: ["권한이 없습니다"] } };
  }
  const gymId = auth.business!.id;

  const fieldErrors: Record<string, string[]> = {};
  const upserts: {
    weekday: Weekday;
    openMinute: number;
    closeMinute: number;
    breakStartMin: number | null;
    breakEndMin: number | null;
  }[] = [];
  const closes: Weekday[] = [];

  for (const d of parsed.data.days) {
    if (!d.open) {
      closes.push(d.weekday);
      continue;
    }
    const openMin = parseTime(d.openTime);
    const closeMin = parseTime(d.closeTime);
    if (openMin == null || closeMin == null) {
      fieldErrors[`time_${d.weekday}`] = ["영업시간 형식이 올바르지 않습니다"];
      continue;
    }
    if (closeMin <= openMin) {
      fieldErrors[`time_${d.weekday}`] = ["종료가 시작보다 늦어야 합니다"];
      continue;
    }
    let breakStart: number | null = null;
    let breakEnd: number | null = null;
    if (d.breakStartTime && d.breakEndTime) {
      breakStart = parseTime(d.breakStartTime);
      breakEnd = parseTime(d.breakEndTime);
      if (breakStart == null || breakEnd == null) {
        fieldErrors[`break_${d.weekday}`] = ["휴게시간 형식 오류"];
        continue;
      }
      if (breakEnd <= breakStart) {
        fieldErrors[`break_${d.weekday}`] = ["휴게 종료가 시작보다 늦어야 합니다"];
        continue;
      }
      if (breakStart < openMin || breakEnd > closeMin) {
        fieldErrors[`break_${d.weekday}`] = ["휴게시간이 영업시간을 벗어났습니다"];
        continue;
      }
    }
    upserts.push({
      weekday: d.weekday,
      openMinute: openMin,
      closeMinute: closeMin,
      breakStartMin: breakStart,
      breakEndMin: breakEnd,
    });
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { errors: fieldErrors };
  }

  await prisma.$transaction([
    prisma.businessHours.deleteMany({
      where: { gymId, weekday: { in: closes } },
    }),
    ...upserts.map((u) =>
      prisma.businessHours.upsert({
        where: { gymId_weekday: { gymId, weekday: u.weekday } },
        create: {
          gymId,
          weekday: u.weekday,
          openMinute: u.openMinute,
          closeMinute: u.closeMinute,
          breakStartMin: u.breakStartMin,
          breakEndMin: u.breakEndMin,
        },
        update: {
          openMinute: u.openMinute,
          closeMinute: u.closeMinute,
          breakStartMin: u.breakStartMin,
          breakEndMin: u.breakEndMin,
        },
      }),
    ),
  ]);

  revalidatePath(`/ko/g/${parsed.data.slug}/hours`);
  revalidatePath(`/en/g/${parsed.data.slug}/hours`);
  revalidatePath(`/ko/g/${parsed.data.slug}/dashboard`);
  revalidatePath(`/en/g/${parsed.data.slug}/dashboard`);
  return { ok: true };
}

// ─── BusinessClosure (특정 날짜 임시 휴무/단축영업/특별휴게) ───

const closureKindZ = z.enum(["CLOSED", "SHORTENED"]);

const closureSchema = z.object({
  slug: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: closureKindZ,
  openTime: z.string().optional(),
  closeTime: z.string().optional(),
  reason: z.string().max(120).optional(),
});

export type SaveClosureState = {
  error?: string;
  ok?: boolean;
  // useActionState가 같은 state 객체를 재사용해 useEffect가 새 저장을
  // 감지 못하는 케이스를 막기 위한 매번 새 timestamp.
  at?: number;
};

function parseYmd(s: string): Date | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return dt;
}

export async function saveClosure(
  _prev: SaveClosureState,
  formData: FormData,
): Promise<SaveClosureState> {
  const parsed = closureSchema.safeParse({
    slug: formData.get("slug"),
    date: formData.get("date"),
    kind: formData.get("kind"),
    openTime: formData.get("openTime") ?? undefined,
    closeTime: formData.get("closeTime") ?? undefined,
    reason: formData.get("reason") ?? undefined,
  });
  if (!parsed.success) {
    return { error: "입력값이 올바르지 않습니다" };
  }
  const { slug, kind, reason } = parsed.data;
  const dateUtc = parseYmd(parsed.data.date);
  if (!dateUtc) return { error: "날짜 형식 오류" };

  const auth = await requireGymStaff(slug);
  if (auth.role !== "OWNER" && auth.role !== "MANAGER") {
    return { error: "권한이 없습니다" };
  }
  const gymId = auth.business!.id;

  let openMinute: number | null = null;
  let closeMinute: number | null = null;

  if (kind === "SHORTENED") {
    openMinute = parsed.data.openTime ? parseTime(parsed.data.openTime) : null;
    closeMinute = parsed.data.closeTime ? parseTime(parsed.data.closeTime) : null;
    if (openMinute == null || closeMinute == null) {
      return { error: "단축영업은 시작/종료 시간이 필요합니다" };
    }
    if (closeMinute <= openMinute) {
      return { error: "종료가 시작보다 늦어야 합니다" };
    }
  }

  await prisma.businessClosure.upsert({
    where: { gymId_date: { gymId, date: dateUtc } },
    create: {
      gymId,
      date: dateUtc,
      kind: kind as ClosureKind,
      openMinute,
      closeMinute,
      reason: reason || null,
    },
    update: {
      kind: kind as ClosureKind,
      openMinute,
      closeMinute,
      reason: reason || null,
    },
  });

  revalidatePath(`/ko/g/${slug}/hours`);
  revalidatePath(`/en/g/${slug}/hours`);
  revalidatePath(`/ko/g/${slug}/dashboard`);
  revalidatePath(`/en/g/${slug}/dashboard`);
  return { ok: true, at: Date.now() };
}

export async function removeClosure(
  slug: string,
  closureId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const auth = await requireGymStaff(slug);
  if (auth.role !== "OWNER" && auth.role !== "MANAGER") {
    return { error: "권한이 없습니다" };
  }
  const gymId = auth.business!.id;
  const c = await prisma.businessClosure.findUnique({ where: { id: closureId } });
  if (!c || c.gymId !== gymId) return { error: "찾을 수 없습니다" };
  await prisma.businessClosure.delete({ where: { id: closureId } });
  revalidatePath(`/ko/g/${slug}/hours`);
  revalidatePath(`/en/g/${slug}/hours`);
  revalidatePath(`/ko/g/${slug}/dashboard`);
  revalidatePath(`/en/g/${slug}/dashboard`);
  return { ok: true };
}
