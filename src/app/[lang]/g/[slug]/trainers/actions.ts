"use server";

import crypto from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { sendStaffActivationEmail } from "@/lib/email/resend";
import { uploadStaffImage, deleteStaffImageUrl } from "@/lib/storage/blob";

const SEVEN_DAYS_MS = 1000 * 60 * 60 * 24 * 7;

const SPECIALTIES = ["HEALTH", "YOGA", "PILATES", "DANCE"] as const;
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

const createSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1, "이름을 입력해 주세요"),
  gender: z.enum(["MALE", "FEMALE"]).default("MALE"),
  phone: z.string().min(1, "핸드폰 번호를 입력해 주세요"),
  email: z
    .string()
    .email("이메일 형식이 올바르지 않습니다")
    .optional()
    .or(z.literal("")),
  dob: z.string().optional().or(z.literal("")),
  emergencyContactPhone: z.string().optional().or(z.literal("")),
  role: z.enum(["TRAINER", "MANAGER"]).default("TRAINER"),
  specialties: z.array(z.enum(SPECIALTIES)).optional().default([]),
  customSpecialty: z.string().optional().or(z.literal("")),
  bio: z.string().optional().or(z.literal("")),
  career: z.string().optional().or(z.literal("")),
  weeklyOffDays: z.array(z.enum(WEEKDAYS)).optional().default([]),
  note: z.string().optional().or(z.literal("")),
  imageUrls: z.array(z.string().url()).max(5).optional().default([]),
});

export type CreateTrainerState = {
  errors?: Record<string, string[] | undefined>;
  success?: { id: string };
};

export async function createTrainer(
  _prev: CreateTrainerState,
  formData: FormData,
): Promise<CreateTrainerState> {
  const raw = {
    slug: formData.get("slug"),
    name: formData.get("name"),
    gender: formData.get("gender"),
    phone: formData.get("phone"),
    email: formData.get("email") ?? "",
    dob: formData.get("dob") ?? "",
    emergencyContactPhone: formData.get("emergencyContactPhone") ?? "",
    role: formData.get("role"),
    specialties: formData.getAll("specialties"),
    customSpecialty: formData.get("customSpecialty") ?? "",
    bio: formData.get("bio") ?? "",
    career: formData.get("career") ?? "",
    weeklyOffDays: formData.getAll("weeklyOffDays"),
    note: formData.get("note") ?? "",
    imageUrls: (() => {
      const raw = formData.get("imageUrls");
      if (typeof raw !== "string" || !raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })(),
  };
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  }
  const d = parsed.data;

  const auth = await requireGymStaff(d.slug);
  const gymId = auth.business!.id;

  const existing = await prisma.user.findFirst({
    where: { gymId, phone: d.phone },
    select: { id: true },
  });
  if (existing) {
    return { errors: { phone: ["이미 등록된 핸드폰 번호입니다"] } };
  }

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        gymId,
        name: d.name,
        gender: d.gender,
        phone: d.phone,
        email: d.email ? d.email : null,
        dob: d.dob ? new Date(d.dob) : null,
        emergencyContactPhone: d.emergencyContactPhone || null,
        note: d.note || null,
        role: d.role,
        status: "PENDING",
      },
      select: { id: true },
    });

    const staff = await tx.staff.create({
      data: {
        gymId,
        userId: user.id,
        role: d.role,
        bio: d.bio || null,
        career: d.career || null,
        specialties: d.specialties,
        customSpecialty: d.customSpecialty || null,
        weeklyOffDays: d.weeklyOffDays,
        photoUrl: d.imageUrls[0] ?? null,
      },
      select: { id: true },
    });

    if (d.imageUrls.length > 0) {
      await tx.staffImage.createMany({
        data: d.imageUrls.map((url, position) => ({
          staffId: staff.id,
          url,
          position,
        })),
      });
    }
    return { staffId: staff.id };
  });

  revalidatePath(`/ko/g/${d.slug}/trainers`);
  revalidatePath(`/en/g/${d.slug}/trainers`);
  return { success: { id: result.staffId } };
}

async function buildActivationUrl(
  slug: string,
  userId: string,
  gymId: string,
): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.magicLinkToken.create({
    data: {
      token,
      targetUserId: userId,
      gymId,
      purpose: "STAFF_INVITE",
      expiresAt: new Date(Date.now() + SEVEN_DAYS_MS),
    },
  });
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}/ko/g/${slug}/activate?token=${token}`;
}

export type SendActivationResult =
  | { ok: true; url: string }
  | { ok: false; message: string };

export async function sendTrainerActivationEmail(
  formData: FormData,
): Promise<SendActivationResult> {
  const slug = String(formData.get("slug") ?? "");
  const staffId = String(formData.get("staffId") ?? "");
  const auth = await requireGymStaff(slug);
  const gymId = auth.business!.id;

  const staff = await prisma.staff.findFirst({
    where: { id: staffId, gymId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      business: { select: { name: true } },
    },
  });
  if (!staff) return { ok: false, message: "트레이너를 찾을 수 없습니다" };
  if (!staff.user.email)
    return {
      ok: false,
      message:
        "이메일이 없는 트레이너입니다. URL 복사로 카톡·SMS 전달하세요.",
    };

  const url = await buildActivationUrl(slug, staff.user.id, gymId);
  const result = await sendStaffActivationEmail({
    to: staff.user.email,
    staffName: staff.user.name,
    storeName: staff.business?.name ?? "",
    roleLabel: staff.role === "MANAGER" ? "매니저" : "트레이너",
    activateUrl: url,
  });

  if ("fallback" in result && result.fallback) {
    return {
      ok: false,
      message:
        "Gmail 자격증명 미설정 — Vercel env에 GMAIL_USER/GMAIL_APP_PASSWORD 추가하세요",
    };
  }
  if (!result.ok) {
    return {
      ok: false,
      message: `발송 실패: ${"error" in result ? result.error : "unknown"}`,
    };
  }
  revalidatePath(`/ko/g/${slug}/trainers`);
  return { ok: true, url };
}

export async function copyTrainerActivationUrl(
  formData: FormData,
): Promise<SendActivationResult> {
  const slug = String(formData.get("slug") ?? "");
  const staffId = String(formData.get("staffId") ?? "");
  const auth = await requireGymStaff(slug);
  const gymId = auth.business!.id;

  const staff = await prisma.staff.findFirst({
    where: { id: staffId, gymId },
    select: { user: { select: { id: true } } },
  });
  if (!staff) return { ok: false, message: "트레이너를 찾을 수 없습니다" };

  const url = await buildActivationUrl(slug, staff.user.id, gymId);
  return { ok: true, url };
}

export async function deleteTrainer(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const staffId = String(formData.get("staffId") ?? "");
  const auth = await requireGymStaff(slug);
  const gymId = auth.business!.id;

  const staff = await prisma.staff.findFirst({
    where: { id: staffId, gymId },
    include: {
      user: { select: { id: true } },
      images: { select: { url: true } },
    },
  });
  if (!staff) return;

  // Blob 사진 정리 (best-effort)
  await Promise.all(staff.images.map((i) => deleteStaffImageUrl(i.url)));

  // User 삭제 → cascade로 Staff·StaffImage·StaffLeave·Sessions 모두 정리
  await prisma.user.delete({ where: { id: staff.user.id } });

  revalidatePath(`/ko/g/${slug}/trainers`);
  revalidatePath(`/en/g/${slug}/trainers`);
}

// ────────────────────────────────────────────────────────────
// Image upload (called from client during form fill)
// ────────────────────────────────────────────────────────────

export type UploadActionResult =
  | { ok: true; url: string }
  | { ok: false; message: string };

export async function uploadTrainerPhoto(
  formData: FormData,
): Promise<UploadActionResult> {
  const slug = String(formData.get("slug") ?? "");
  const position = parseInt(String(formData.get("position") ?? "0"), 10);
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, message: "파일이 없습니다" };
  }
  await requireGymStaff(slug);

  // 매장 자원 — staffId 미존재 시점이라 임시 키(gymSlug+timestamp)로 업로드
  const tempStaffId = `pending-${slug}`;
  const result = await uploadStaffImage(tempStaffId, position, file);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  return { ok: true, url: result.url };
}

// ────────────────────────────────────────────────────────────
// Leaves (휴가)
// ────────────────────────────────────────────────────────────

const leaveSchema = z.object({
  slug: z.string().min(1),
  staffId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().optional().or(z.literal("")),
});

export async function addLeave(
  _prev: { errors?: Record<string, string[] | undefined> } | undefined,
  formData: FormData,
) {
  const parsed = leaveSchema.safeParse({
    slug: formData.get("slug"),
    staffId: formData.get("staffId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  }
  const d = parsed.data;
  const auth = await requireGymStaff(d.slug);
  const gymId = auth.business!.id;

  const staff = await prisma.staff.findFirst({
    where: { id: d.staffId, gymId },
    select: { id: true },
  });
  if (!staff) return { errors: { staffId: ["트레이너 없음"] } };

  await prisma.staffLeave.create({
    data: {
      staffId: staff.id,
      gymId,
      startDate: new Date(d.startDate),
      endDate: new Date(d.endDate),
      reason: d.reason || null,
    },
  });
  revalidatePath(`/ko/g/${d.slug}/trainers`);
  revalidatePath(`/en/g/${d.slug}/trainers`);
  return {};
}

export async function removeLeave(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const leaveId = String(formData.get("leaveId") ?? "");
  const auth = await requireGymStaff(slug);
  const gymId = auth.business!.id;

  await prisma.staffLeave.deleteMany({
    where: { id: leaveId, gymId },
  });
  revalidatePath(`/ko/g/${slug}/trainers`);
}
