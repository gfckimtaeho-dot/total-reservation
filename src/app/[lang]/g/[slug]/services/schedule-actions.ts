"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import type { Weekday } from "@/generated/prisma/enums";

const weekdayZ = z.enum(["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]);
const dateZ = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateFormat");
const timeZ = z.string().regex(/^\d{1,2}:\d{2}$/, "startTime");

function parseTime(s: string): number | null {
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

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

const recurringSchema = z.object({
  slug: z.string().min(1),
  serviceId: z.string().min(1),
  staffId: z.string().optional().nullable(),
  kind: z.literal("RECURRING"),
  weekdays: z.array(weekdayZ).min(1, "weekdays"),
  startTime: timeZ,
  validFrom: dateZ,
  validUntil: dateZ.optional().nullable(),
  note: z.string().max(120).optional().nullable(),
});

const oneOffSchema = z.object({
  slug: z.string().min(1),
  serviceId: z.string().min(1),
  staffId: z.string().optional().nullable(),
  kind: z.literal("ONE_OFF"),
  specificDate: dateZ,
  startTime: timeZ,
  note: z.string().max(120).optional().nullable(),
});

const createSchema = z.discriminatedUnion("kind", [
  recurringSchema,
  oneOffSchema,
]);

export type CreateScheduleState = {
  errors?: Record<string, string[] | undefined>;
  ok?: boolean;
  at?: number;
};

export async function createSchedule(
  _prev: CreateScheduleState,
  formData: FormData,
): Promise<CreateScheduleState> {
  const weekdays = formData
    .getAll("weekdays")
    .map((v) => String(v))
    .filter(Boolean);

  const parsed = createSchema.safeParse({
    slug: formData.get("slug"),
    serviceId: formData.get("serviceId"),
    staffId: (formData.get("staffId") as string) || null,
    kind: formData.get("kind"),
    weekdays,
    specificDate: (formData.get("specificDate") as string) || undefined,
    startTime: formData.get("startTime"),
    validFrom: (formData.get("validFrom") as string) || undefined,
    validUntil: (formData.get("validUntil") as string) || null,
    note: (formData.get("note") as string) || null,
  });
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  }
  const data = parsed.data;

  const startMin = parseTime(data.startTime);
  if (startMin == null) {
    return { errors: { startTime: ["startTime"] } };
  }

  const auth = await requireGymStaff(data.slug);
  if (auth.role !== "OWNER" && auth.role !== "MANAGER") {
    return { errors: { _global: ["permission"] } };
  }
  const gymId = auth.business!.id;

  const service = await prisma.service.findUnique({
    where: { id: data.serviceId },
  });
  if (!service || service.gymId !== gymId) {
    return { errors: { _global: ["permission"] } };
  }
  if (service.capacity < 2) {
    return { errors: { _global: ["notGroup"] } };
  }

  if (startMin + service.durationMin > 1440) {
    return { errors: { startTime: ["overflowMidnight"] } };
  }

  if (data.staffId) {
    const staff = await prisma.staff.findUnique({
      where: { id: data.staffId },
    });
    if (!staff || staff.gymId !== gymId) {
      return { errors: { staffId: ["permission"] } };
    }
  }

  if (data.kind === "RECURRING") {
    const from = parseYmd(data.validFrom);
    if (!from) return { errors: { validFrom: ["dateFormat"] } };
    let until: Date | null = null;
    if (data.validUntil) {
      until = parseYmd(data.validUntil);
      if (!until) return { errors: { validUntil: ["dateFormat"] } };
      if (until < from) {
        return { errors: { validUntil: ["untilBeforeFrom"] } };
      }
    }

    await prisma.scheduledClass.create({
      data: {
        gymId,
        serviceId: data.serviceId,
        staffId: data.staffId || null,
        kind: "RECURRING",
        weekdays: data.weekdays as Weekday[],
        specificDate: null,
        startMinute: startMin,
        validFrom: from,
        validUntil: until,
        active: true,
        note: data.note || null,
      },
    });
  } else {
    // ONE_OFF
    const date = parseYmd(data.specificDate);
    if (!date) return { errors: { specificDate: ["dateFormat"] } };

    await prisma.scheduledClass.create({
      data: {
        gymId,
        serviceId: data.serviceId,
        staffId: data.staffId || null,
        kind: "ONE_OFF",
        weekdays: [],
        specificDate: date,
        startMinute: startMin,
        validFrom: date,
        validUntil: null,
        active: true,
        note: data.note || null,
      },
    });
  }

  revalidatePath(`/ko/g/${data.slug}/services`);
  revalidatePath(`/en/g/${data.slug}/services`);
  return { ok: true, at: Date.now() };
}

export async function deleteSchedule(
  slug: string,
  scheduleId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const auth = await requireGymStaff(slug);
  if (auth.role !== "OWNER" && auth.role !== "MANAGER") {
    return { error: "permission" };
  }
  const gymId = auth.business!.id;

  const sched = await prisma.scheduledClass.findUnique({
    where: { id: scheduleId },
  });
  if (!sched || sched.gymId !== gymId) {
    return { error: "permission" };
  }

  const activeCount = await prisma.reservation.count({
    where: {
      scheduledClassId: scheduleId,
      status: { in: ["PENDING_PAYMENT", "CONFIRMED"] },
      endAt: { gte: new Date() },
    },
  });
  if (activeCount > 0) {
    return { error: "hasReservations" };
  }

  await prisma.scheduledClass.delete({ where: { id: scheduleId } });

  revalidatePath(`/ko/g/${slug}/services`);
  revalidatePath(`/en/g/${slug}/services`);
  return { ok: true };
}
