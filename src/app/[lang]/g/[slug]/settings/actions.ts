"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";

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
