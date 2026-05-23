"use server";

import crypto from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { sendStaffActivationEmail } from "@/lib/email/resend";
import { uploadStaffImage, deleteStaffImageUrl } from "@/lib/storage/blob";
import { generateAccessToken } from "@/lib/auth/accessToken";

const ROLE_KEY = {
  OWNER: "roleOwner",
  MANAGER: "roleManager",
  TRAINER: "roleTrainer",
  CUSTOMER: "roleCustomer",
  ADMIN: "roleManager", // unlikely in gym scope, fallback
} as const;

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
    .trim()
    .toLowerCase()
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
  workStart: z.string().optional().or(z.literal("")),
  workEnd: z.string().optional().or(z.literal("")),
  breakStart: z.string().optional().or(z.literal("")),
  breakEnd: z.string().optional().or(z.literal("")),
  // 월 기본급(PHP). 폼 number input → 문자열 → 정수. 음수 거부.
  // 변경 시 PriceChangeLog 생성(updateTrainer). 신규 등록은 항상 0부터.
  monthlyBaseSalaryPhp: z.coerce.number().int().min(0).default(0),
  note: z.string().optional().or(z.literal("")),
  imageUrls: z.array(z.string().url()).max(5).optional().default([]),
  // 등록 시 선택한 모국어 → User.locale. 기본 영어(폼 기본 선택값과 일치).
  locale: z.enum(["ko", "en"]).default("en"),
});

// "HH:MM" → 자정 기준 분. 빈 값/형식 오류면 null (= gym 영업시간 따름).
function timeToMin(s: string | undefined): number | null {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export type CreateTrainerState = {
  errors?: Record<string, string[] | undefined>;
  message?: string;
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
    locale: formData.get("locale") ?? "en",
    role: formData.get("role"),
    specialties: formData.getAll("specialties"),
    customSpecialty: formData.get("customSpecialty") ?? "",
    bio: formData.get("bio") ?? "",
    career: formData.get("career") ?? "",
    weeklyOffDays: formData.getAll("weeklyOffDays"),
    workStart: formData.get("workStart") ?? "",
    workEnd: formData.get("workEnd") ?? "",
    breakStart: formData.get("breakStart") ?? "",
    breakEnd: formData.get("breakEnd") ?? "",
    monthlyBaseSalaryPhp: formData.get("monthlyBaseSalaryPhp") ?? 0,
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

  const te = await getTranslations("errors");

  const existingPhone = await prisma.user.findFirst({
    where: { gymId, phone: d.phone },
    select: { id: true, role: true, name: true },
  });
  if (existingPhone) {
    return {
      errors: {
        phone: [
          te("phoneTakenBy", {
            role: te(ROLE_KEY[existingPhone.role]),
            name: existingPhone.name,
          }),
        ],
      },
    };
  }

  if (d.email) {
    const existingEmail = await prisma.user.findFirst({
      where: { gymId, email: d.email },
      select: { id: true, role: true, name: true },
    });
    if (existingEmail) {
      return {
        errors: {
          email: [
            te("emailTakenBy", {
              role: te(ROLE_KEY[existingEmail.role]),
              name: existingEmail.name,
            }),
          ],
        },
      };
    }
  }

  let result: { staffId: string };
  try {
    result = await prisma.$transaction(async (tx) => {
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
          locale: d.locale,
          accessToken: generateAccessToken(),
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
          workStartMin: timeToMin(d.workStart),
          workEndMin: timeToMin(d.workEnd),
          breakStartMin: timeToMin(d.breakStart),
          breakEndMin: timeToMin(d.breakEnd),
          monthlyBaseSalaryPhp: d.monthlyBaseSalaryPhp,
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[createTrainer] transaction failed:", message, err);
    return { message: `등록 실패: ${message}` };
  }

  revalidatePath(`/ko/g/${d.slug}/trainers`);
  revalidatePath(`/en/g/${d.slug}/trainers`);
  return { success: { id: result.staffId } };
}

const updateSchema = createSchema.extend({
  staffId: z.string().min(1),
});

export async function updateTrainer(
  _prev: CreateTrainerState,
  formData: FormData,
): Promise<CreateTrainerState> {
  const raw = {
    staffId: formData.get("staffId"),
    slug: formData.get("slug"),
    name: formData.get("name"),
    gender: formData.get("gender"),
    phone: formData.get("phone"),
    email: formData.get("email") ?? "",
    dob: formData.get("dob") ?? "",
    emergencyContactPhone: formData.get("emergencyContactPhone") ?? "",
    locale: formData.get("locale") ?? "en",
    role: formData.get("role"),
    specialties: formData.getAll("specialties"),
    customSpecialty: formData.get("customSpecialty") ?? "",
    bio: formData.get("bio") ?? "",
    career: formData.get("career") ?? "",
    weeklyOffDays: formData.getAll("weeklyOffDays"),
    workStart: formData.get("workStart") ?? "",
    workEnd: formData.get("workEnd") ?? "",
    breakStart: formData.get("breakStart") ?? "",
    breakEnd: formData.get("breakEnd") ?? "",
    monthlyBaseSalaryPhp: formData.get("monthlyBaseSalaryPhp") ?? 0,
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
  const parsed = updateSchema.safeParse(raw);
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

  const existing = await prisma.staff.findFirst({
    where: { id: d.staffId, gymId },
    include: { user: { select: { id: true } }, images: true },
  });
  if (!existing) return { message: "트레이너를 찾을 수 없습니다" };

  const te = await getTranslations("errors");

  const phoneConflict = await prisma.user.findFirst({
    where: { gymId, phone: d.phone, NOT: { id: existing.user.id } },
    select: { id: true, role: true, name: true },
  });
  if (phoneConflict) {
    return {
      errors: {
        phone: [
          te("phoneTakenBy", {
            role: te(ROLE_KEY[phoneConflict.role]),
            name: phoneConflict.name,
          }),
        ],
      },
    };
  }

  if (d.email) {
    const emailConflict = await prisma.user.findFirst({
      where: { gymId, email: d.email, NOT: { id: existing.user.id } },
      select: { id: true, role: true, name: true },
    });
    if (emailConflict) {
      return {
        errors: {
          email: [
            te("emailTakenBy", {
              role: te(ROLE_KEY[emailConflict.role]),
              name: emailConflict.name,
            }),
          ],
        },
      };
    }
  }

  const removedUrls = existing.images
    .filter((img) => !d.imageUrls.includes(img.url))
    .map((img) => img.url);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existing.user.id },
        data: {
          name: d.name,
          gender: d.gender,
          phone: d.phone,
          email: d.email ? d.email : null,
          dob: d.dob ? new Date(d.dob) : null,
          emergencyContactPhone: d.emergencyContactPhone || null,
          note: d.note || null,
          role: d.role,
          locale: d.locale,
        },
      });
      await tx.staff.update({
        where: { id: existing.id },
        data: {
          role: d.role,
          bio: d.bio || null,
          career: d.career || null,
          specialties: d.specialties,
          customSpecialty: d.customSpecialty || null,
          weeklyOffDays: d.weeklyOffDays,
          workStartMin: timeToMin(d.workStart),
          workEndMin: timeToMin(d.workEnd),
          breakStartMin: timeToMin(d.breakStart),
          breakEndMin: timeToMin(d.breakEnd),
          monthlyBaseSalaryPhp: d.monthlyBaseSalaryPhp,
          photoUrl: d.imageUrls[0] ?? null,
        },
      });
      // 월 기본급 변경 시 감사 로그 — feedback_money_audit_log.
      if (existing.monthlyBaseSalaryPhp !== d.monthlyBaseSalaryPhp) {
        await tx.priceChangeLog.create({
          data: {
            gymId,
            entityType: "STAFF_BASE_SALARY",
            entityId: existing.id,
            oldValuePhp: existing.monthlyBaseSalaryPhp,
            newValuePhp: d.monthlyBaseSalaryPhp,
            changedById: auth.id,
          },
        });
      }
      await tx.staffImage.deleteMany({ where: { staffId: existing.id } });
      if (d.imageUrls.length > 0) {
        await tx.staffImage.createMany({
          data: d.imageUrls.map((url, position) => ({
            staffId: existing.id,
            url,
            position,
          })),
        });
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[updateTrainer] transaction failed:", message, err);
    return { message: `수정 실패: ${message}` };
  }

  // 제거된 사진은 best-effort로 Blob에서도 정리
  await Promise.all(removedUrls.map((url) => deleteStaffImageUrl(url)));

  revalidatePath(`/ko/g/${d.slug}/trainers`);
  revalidatePath(`/en/g/${d.slug}/trainers`);
  revalidatePath(`/ko/g/${d.slug}/trainers/${d.staffId}`);
  revalidatePath(`/en/g/${d.slug}/trainers/${d.staffId}`);
  return { success: { id: d.staffId } };
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

// 하드 삭제 폐기 — 예약/실적 이력 보존 위해 활성/비활성 토글로 대체.
export async function setTrainerActive(
  formData: FormData,
): Promise<{ ok: boolean; message?: string }> {
  const slug = String(formData.get("slug") ?? "");
  const staffId = String(formData.get("staffId") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  try {
    const auth = await requireGymStaff(slug);
    const gymId = auth.business!.id;

    const staff = await prisma.staff.findFirst({
      where: { id: staffId, gymId },
      select: { user: { select: { id: true } } },
    });
    if (!staff) return { ok: false, message: "트레이너를 찾을 수 없습니다" };

    // 비활성 → accessToken 제거(기존 QR 즉시 무효).
    // 재활성 → 새 accessToken 발급(새 QR 지급).
    await prisma.user.update({
      where: { id: staff.user.id },
      data: {
        active,
        accessToken: active ? generateAccessToken() : null,
      },
    });

    revalidatePath(`/ko/g/${slug}/trainers`);
    revalidatePath(`/en/g/${slug}/trainers`);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[setTrainerActive] failed:", message, err);
    return { ok: false, message: `상태 변경 실패: ${message}` };
  }
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

// QR 재발급 — 기존 accessToken을 새 무작위로 교체. 옛 QR 즉시 무효.
export async function regenerateTrainerAccessToken(
  formData: FormData,
): Promise<{ ok: boolean; message?: string }> {
  const slug = String(formData.get("slug") ?? "");
  const staffId = String(formData.get("staffId") ?? "");
  try {
    const auth = await requireGymStaff(slug);
    if (auth.role !== "OWNER" && auth.role !== "MANAGER") {
      return { ok: false, message: "권한이 없습니다" };
    }
    const gymId = auth.business!.id;

    const staff = await prisma.staff.findFirst({
      where: { id: staffId, gymId },
      select: { user: { select: { id: true } } },
    });
    if (!staff) return { ok: false, message: "트레이너를 찾을 수 없습니다" };

    await prisma.user.update({
      where: { id: staff.user.id },
      data: { accessToken: generateAccessToken() },
    });
    revalidatePath(`/ko/g/${slug}/trainers/${staffId}`);
    revalidatePath(`/en/g/${slug}/trainers/${staffId}`);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[regenerateTrainerAccessToken] failed:", message, err);
    return { ok: false, message: `재발급 실패: ${message}` };
  }
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
