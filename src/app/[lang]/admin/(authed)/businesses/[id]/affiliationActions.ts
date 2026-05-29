"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { hotelDb } from "@/lib/hotel-db";
import { requireAdmin } from "@/lib/auth/dal";

// 헬스장 <-> 호텔 게스트 출입 제휴(GymHotelAffiliation) 관리. admin 가맹점 상세
// (GYM) 의 "제휴 호텔" 섹션에서 호출. hotelId 는 호텔 DB(Business.id) - cross-DB 라
// FK 없음. 추가 시 호텔명을 스냅샷으로 저장(목록 렌더용). docs/access.md.

export type AffiliationState = {
  errors?: Record<string, string[] | undefined>;
  message?: string;
  ok?: boolean;
};

const addSchema = z.object({
  gymId: z.string().min(1),
  hotelId: z.string().min(1, "제휴할 호텔을 선택해 주세요"),
});

export async function addAffiliation(
  _prev: AffiliationState,
  formData: FormData,
): Promise<AffiliationState> {
  await requireAdmin();
  const parsed = addSchema.safeParse({
    gymId: formData.get("gymId"),
    hotelId: formData.get("hotelId"),
  });
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  }
  const { gymId, hotelId } = parsed.data;

  const gym = await prisma.business.findUnique({
    where: { id: gymId },
    select: { id: true },
  });
  if (!gym) return { message: "헬스장을 찾을 수 없습니다." };

  // 호텔 존재 확인 + 이름 스냅샷 (cross-DB).
  const hotel = await hotelDb.business.findUnique({
    where: { id: hotelId },
    select: { id: true, name: true },
  });
  if (!hotel) return { message: "호텔을 찾을 수 없습니다." };

  // 이미 있으면(비활성 포함) 재활성화 + 이름 갱신.
  await prisma.gymHotelAffiliation.upsert({
    where: { gymId_hotelId: { gymId, hotelId } },
    create: { gymId, hotelId, hotelName: hotel.name, active: true },
    update: { active: true, hotelName: hotel.name },
  });

  revalidatePath(`/admin/businesses/${gymId}`);
  return { ok: true };
}

// 제휴 활성/비활성 토글. 비활성이면 출입 즉시 차단(verify 가 NOT_AFFILIATED).
// row 는 보존(audit). 단순 form action.
export async function toggleAffiliation(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("affiliationId") ?? "");
  const gymId = String(formData.get("gymId") ?? "");
  if (!id) return;

  const aff = await prisma.gymHotelAffiliation.findUnique({
    where: { id },
    select: { active: true },
  });
  if (!aff) return;

  await prisma.gymHotelAffiliation.update({
    where: { id },
    data: { active: !aff.active },
  });

  revalidatePath(`/admin/businesses/${gymId}`);
}
