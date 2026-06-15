"use server";

import { randomBytes } from "crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { sendScannerLinkEmail } from "@/lib/email/resend";

export type SavePriceState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; message: "forbidden" | "invalid" };

// 호텔 게스트 1일 출입 단가 저장. 빈 값 = 미설정(null). 금액 변경 시
// PriceChangeLog 기록(feedback_money_audit_log). OWNER/MANAGER 만 허용.
export async function updateHotelGuestDailyPrice(
  slug: string,
  _prev: SavePriceState,
  formData: FormData,
): Promise<SavePriceState> {
  const auth = await requireGymStaff(slug);
  if (!["OWNER", "MANAGER"].includes(auth.role)) {
    return { status: "error", message: "forbidden" };
  }
  const gymId = auth.business!.id;

  const raw = String(formData.get("price") ?? "").trim();
  let newValue: number | null;
  if (raw === "") {
    newValue = null;
  } else {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0) {
      return { status: "error", message: "invalid" };
    }
    newValue = n;
  }

  const current = await prisma.business.findUnique({
    where: { id: gymId },
    select: { hotelGuestDailyPricePhp: true },
  });
  const oldValue = current?.hotelGuestDailyPricePhp ?? null;

  if (oldValue === newValue) {
    return { status: "saved" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.business.update({
      where: { id: gymId },
      data: { hotelGuestDailyPricePhp: newValue },
    });
    // null <-> 숫자 전환도 추적 — 미설정은 0 으로 기록.
    await tx.priceChangeLog.create({
      data: {
        gymId,
        entityType: "HOTEL_GUEST_DAILY_PRICE",
        entityId: gymId,
        oldValuePhp: oldValue ?? 0,
        newValuePhp: newValue ?? 0,
        changedById: auth.id,
      },
    });
  });

  // 가격이 바뀌면 매출현황 게스트 매출도 달라지므로 함께 무효화.
  revalidatePath(`/ko/g/${slug}/settings`);
  revalidatePath(`/en/g/${slug}/settings`);
  revalidatePath(`/ko/g/${slug}/revenue`);
  revalidatePath(`/en/g/${slug}/revenue`);
  return { status: "saved" };
}

// ─── 무인 출입 스캐너 영구 링크 ─────────────────────────────

export type ScannerKeyState =
  | { status: "idle" }
  | { status: "generated" }
  | { status: "error"; message: "forbidden" };

export type ScannerEmailState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "fallback" }
  | { status: "error"; message: "forbidden" | "invalid" | "send" };

// 추측 불가 고엔트로피 키(32바이트 base64url ≈ 43자). 링크 자체가 인증 수단.
function newScannerKey(): string {
  return randomBytes(32).toString("base64url");
}

async function requestBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

// 스캐너 링크 키 발급/재발급. 재발급하면 옛 링크는 즉시 무효(분실 단말 회수).
// OWNER/MANAGER 만. audit 스탬핑은 Prisma extension 이 updatedById 자동 처리.
export async function regenerateScannerKey(
  slug: string,
  _prev: ScannerKeyState,
): Promise<ScannerKeyState> {
  void _prev; // useActionState 시그니처용 — 사용 안 함.
  const auth = await requireGymStaff(slug);
  if (!["OWNER", "MANAGER"].includes(auth.role)) {
    return { status: "error", message: "forbidden" };
  }
  await prisma.business.update({
    where: { id: auth.business!.id },
    data: { scannerKey: newScannerKey() },
  });
  revalidatePath(`/ko/g/${slug}/settings`);
  revalidatePath(`/en/g/${slug}/settings`);
  return { status: "generated" };
}

// 스캐너 영구 링크를 입력 이메일로 발송. 키가 없으면 먼저 발급한다.
export async function sendScannerLink(
  slug: string,
  _prev: ScannerEmailState,
  formData: FormData,
): Promise<ScannerEmailState> {
  const auth = await requireGymStaff(slug);
  if (!["OWNER", "MANAGER"].includes(auth.role)) {
    return { status: "error", message: "forbidden" };
  }
  const to = String(formData.get("email") ?? "").trim();
  if (!to || !to.includes("@")) {
    return { status: "error", message: "invalid" };
  }
  const gymId = auth.business!.id;

  const biz = await prisma.business.findUnique({
    where: { id: gymId },
    select: { name: true, scannerKey: true },
  });
  let key = biz?.scannerKey ?? null;
  if (!key) {
    key = newScannerKey();
    await prisma.business.update({
      where: { id: gymId },
      data: { scannerKey: key },
    });
    revalidatePath(`/ko/g/${slug}/settings`);
    revalidatePath(`/en/g/${slug}/settings`);
  }

  const base = await requestBaseUrl();
  const scanUrl = `${base}/ko/g/${slug}/scan/${key}`;
  const res = await sendScannerLinkEmail({
    to,
    storeName: biz?.name ?? slug,
    scanUrl,
  });
  if (res.ok) return { status: "sent" };
  if (!res.ok && "fallback" in res && res.fallback) return { status: "fallback" };
  return { status: "error", message: "send" };
}
