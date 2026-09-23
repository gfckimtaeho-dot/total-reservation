import { prisma } from "@/lib/db/client";
import { insertSystemMessage, SystemMessages } from "@/lib/chat/system";

// 환불 완료 마감 — PENDING -> COMPLETED + 회원 STORE 채팅에 영수증 시스템 메시지.
// 2026-09-24: /refunds 화면 폐지. 호출처는 회원 상세(카운터) 뿐:
//   - 카운터 환불 등록(회원 변심 50%)은 생성과 동시에 이 함수로 즉시 완료
//   - 수업 폐지 자동 환불(매장 귀책 100%, PENDING)은 회원 상세 "환불 완료" 버튼
// 트랜잭션으로 묶어 chat 발송 실패 시 status 변경도 롤백 — "환불은 됐는데 알림은
// 안 옴" 갈라짐 방지.

// $extends 적용 후 Prisma.TransactionClient 와 호환이 어려워 codebase 관례대로 유추.
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function completeRefundInTx(
  tx: Tx,
  input: {
    refundId: string;
    gymId: string;
    userId: string;
    serviceName: string;
    refundPhp: number;
    actorId: string;
  },
): Promise<void> {
  await tx.refundRequest.update({
    where: { id: input.refundId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      completedById: input.actorId,
    },
  });

  // STORE thread find-or-create. 정책상 customer 만 lazy-create 가능하나 여기는
  // 시스템 트리거이므로 직접 생성 — 매장 채팅을 한 번도 안 연 회원도 영수증을 받는다.
  let thread = await tx.chatThread.findFirst({
    where: { gymId: input.gymId, kind: "STORE", customerId: input.userId },
    select: { id: true },
  });
  if (!thread) {
    thread = await tx.chatThread.create({
      data: {
        gymId: input.gymId,
        kind: "STORE",
        customerId: input.userId,
        staffUserId: null,
      },
      select: { id: true },
    });
  }
  await insertSystemMessage(tx, {
    threadId: thread.id,
    actorId: input.actorId,
    body: SystemMessages.refundCompleted({
      serviceName: input.serviceName,
      amountPhp: input.refundPhp,
    }),
  });
}

export type CompletePendingResult = { ok: true } | { ok: false; error: string };

// PENDING 환불 요청 하나를 완료. 멱등(이미 COMPLETED 면 ok).
export async function completePendingRefund(
  gymId: string,
  refundId: string,
  actorId: string,
): Promise<CompletePendingResult> {
  const refund = await prisma.refundRequest.findUnique({
    where: { id: refundId },
    select: {
      id: true,
      gymId: true,
      status: true,
      userId: true,
      serviceName: true,
      refundPhp: true,
    },
  });
  if (!refund || refund.gymId !== gymId) {
    return { ok: false, error: "환불 요청을 찾을 수 없습니다" };
  }
  if (refund.status === "COMPLETED") return { ok: true };
  await prisma.$transaction((tx) =>
    completeRefundInTx(tx, {
      refundId: refund.id,
      gymId,
      userId: refund.userId,
      serviceName: refund.serviceName,
      refundPhp: refund.refundPhp,
      actorId,
    }),
  );
  return { ok: true };
}

// 대시보드 "환불 대기" 카운트(매장 귀책 자동 환불 등 아직 완료 안 된 건).
export async function countPendingRefunds(gymId: string): Promise<number> {
  return prisma.refundRequest.count({ where: { gymId, status: "PENDING" } });
}
