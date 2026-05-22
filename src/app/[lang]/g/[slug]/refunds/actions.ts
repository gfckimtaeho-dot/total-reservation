"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";

// 사장 환불 관리 — 미지급 환불을 송금/직접지급 후 "완료"로 마감.
// 거절 플로우는 없음(신청=수락). 완료 처리자·시각을 기록한다.

export type CompleteRefundResult =
  | { ok: true }
  | { ok: false; error: string };

export async function completeRefund(
  slug: string,
  refundId: string,
): Promise<CompleteRefundResult> {
  const auth = await requireGymStaff(slug);
  const gymId = auth.business!.id;
  // 환불 완료는 돈 지급 마감 — OWNER/MANAGER 만.
  if (auth.role !== "OWNER" && auth.role !== "MANAGER") {
    return { ok: false, error: "환불을 완료 처리할 권한이 없습니다" };
  }

  const refund = await prisma.refundRequest.findUnique({
    where: { id: refundId },
    select: { id: true, gymId: true, status: true },
  });
  if (!refund || refund.gymId !== gymId) {
    return { ok: false, error: "환불 요청을 찾을 수 없습니다" };
  }
  if (refund.status === "COMPLETED") return { ok: true }; // 멱등

  await prisma.refundRequest.update({
    where: { id: refund.id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      completedById: auth.id,
    },
  });

  revalidatePath(`/ko/g/${slug}/refunds`);
  revalidatePath(`/en/g/${slug}/refunds`);
  return { ok: true };
}
