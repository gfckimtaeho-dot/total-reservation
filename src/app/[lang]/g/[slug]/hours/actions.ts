"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import type { Weekday } from "@/generated/prisma/enums";

const ALL_WEEKDAYS: Weekday[] = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
];

// 시간을 "HH:MM" 형식으로 받아서 분으로 변환
function parseTime(value: string): number | null {
  const m = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 24 || min < 0 || min > 59) return null;
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
  return { ok: true };
}
