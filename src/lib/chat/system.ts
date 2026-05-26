// 시스템 메시지 생성 헬퍼. 트레이너 양도 / 환불 완료 / 트레이너 비활성 같은
// 도메인 이벤트에서 ChatThread 에 자동 삽입하는 메시지.
//
// Phase 1: 한국어 평문. Phase 2 다국어 도입 시 systemKey/systemParams 컬럼 추가.

import { prisma } from "@/lib/db/client";

type Tx = Pick<typeof prisma, "chatMessage" | "chatThread">;

// 시스템 메시지 1줄 + thread.lastMessageAt 갱신.
// actorId: 이벤트를 일으킨 사용자 (audit). thread 가 보이지 않는 사용자라도 OK.
export async function insertSystemMessage(
  tx: Tx,
  args: { threadId: string; actorId: string; body: string },
) {
  const msg = await tx.chatMessage.create({
    data: {
      threadId: args.threadId,
      senderId: args.actorId,
      body: args.body,
      system: true,
    },
    select: { id: true, sentAt: true },
  });
  await tx.chatThread.update({
    where: { id: args.threadId },
    data: { lastMessageAt: msg.sentAt },
  });
  return msg;
}

// 도메인 이벤트별 thin wrapper. 각 호출처는 의도가 명확.
export const SystemMessages = {
  trainerHandover: (toName: string) =>
    `${toName} 트레이너로 담당이 변경되었습니다.`,
  trainerInactive: () =>
    "담당 트레이너가 변경 예정입니다. 매장에 문의해주세요.",
  // 사장이 환불을 완료 처리한 직후 STORE thread 에 발송. 회원 분쟁 방지를
  // 위해 어떤 권을 얼마 환불했는지, 수령 방법까지 명시.
  refundCompleted: (args: {
    serviceName: string;
    amountPhp: number;
    payoutMethod: "IN_PERSON" | "BANK_TRANSFER";
  }) => {
    const money = `₱${args.amountPhp.toLocaleString()}`;
    const pickup =
      args.payoutMethod === "IN_PERSON"
        ? "매장 카운터에서 직접 받아 주세요."
        : "신청 시 입력하신 계좌로 송금됩니다.";
    return `[환불 완료] ${args.serviceName} 권 ${money} 환불 처리되었습니다. ${pickup}`;
  },
};
