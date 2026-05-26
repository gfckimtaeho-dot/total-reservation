"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { insertSystemMessage, SystemMessages } from "@/lib/chat/system";

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
    select: {
      id: true,
      gymId: true,
      status: true,
      userId: true,
      serviceName: true,
      refundPhp: true,
      payoutMethod: true,
    },
  });
  if (!refund || refund.gymId !== gymId) {
    return { ok: false, error: "환불 요청을 찾을 수 없습니다" };
  }
  if (refund.status === "COMPLETED") return { ok: true }; // 멱등

  // 환불 마감 + STORE thread 에 시스템 메시지 1줄(영수증 성격) 발송.
  // 트랜잭션으로 묶어 chat 발송 실패 시 status 변경도 롤백 — 회원 입장에서
  // "환불은 됐는데 알림은 안 옴" 갈라짐 방지.
  await prisma.$transaction(async (tx) => {
    await tx.refundRequest.update({
      where: { id: refund.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        completedById: auth.id,
      },
    });

    // STORE thread find-or-create. 정책상 customer 만 lazy-create 가능하나
    // 여기는 시스템 트리거이므로 직접 생성. customer 가 매장 채팅을 한 번도
    // 안 열었어도 환불 완료 영수증을 받게 된다.
    let thread = await tx.chatThread.findFirst({
      where: { gymId, kind: "STORE", customerId: refund.userId },
      select: { id: true },
    });
    if (!thread) {
      thread = await tx.chatThread.create({
        data: {
          gymId,
          kind: "STORE",
          customerId: refund.userId,
          staffUserId: null,
        },
        select: { id: true },
      });
    }

    await insertSystemMessage(tx, {
      threadId: thread.id,
      actorId: auth.id,
      body: SystemMessages.refundCompleted({
        serviceName: refund.serviceName,
        amountPhp: refund.refundPhp,
        payoutMethod: refund.payoutMethod,
      }),
    });
  });

  // 권은 자동으로 고객 보유 화면(/me, /me/holdings)에서 사라짐(COMPLETED
  // RefundRequest 가진 권은 쿼리 제외). 채팅 인박스는 새 메시지 1건으로 갱신.

  revalidatePath(`/ko/g/${slug}/refunds`);
  revalidatePath(`/en/g/${slug}/refunds`);
  revalidatePath(`/ko/g/${slug}/me`);
  revalidatePath(`/en/g/${slug}/me`);
  revalidatePath(`/ko/g/${slug}/me/holdings`);
  revalidatePath(`/en/g/${slug}/me/holdings`);
  revalidatePath(`/ko/g/${slug}/me/chat`);
  revalidatePath(`/en/g/${slug}/me/chat`);
  return { ok: true };
}
