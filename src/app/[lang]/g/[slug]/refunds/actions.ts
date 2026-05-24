"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";

// 사이드바 뱃지용 미지급 환불 카운트. 권한 없으면 0(에러 throw 안 함 —
// 사이드바 마운트 시점에 unauthorized 페이지에서도 안전).
export async function getPendingRefundCount(slug: string): Promise<number> {
  const auth = await requireGymStaff(slug).catch(() => null);
  if (!auth || !auth.business) return 0;
  return prisma.refundRequest.count({
    where: { gymId: auth.business.id, status: "PENDING" },
  });
}

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

  // ToBe — 고객 알림 발송("환불이 완료되었습니다"). 알림 인프라(웹 push/
  // 인앱 인박스) 구축 후 여기서 트리거. 이메일은 도달률 낮아 안 씀.
  // 권은 자동으로 고객 보유 화면(/me, /me/holdings)에서 사라짐(COMPLETED
  // RefundRequest 가진 권은 쿼리 제외).

  revalidatePath(`/ko/g/${slug}/refunds`);
  revalidatePath(`/en/g/${slug}/refunds`);
  revalidatePath(`/ko/g/${slug}/me`);
  revalidatePath(`/en/g/${slug}/me`);
  revalidatePath(`/ko/g/${slug}/me/holdings`);
  revalidatePath(`/en/g/${slug}/me/holdings`);
  return { ok: true };
}
