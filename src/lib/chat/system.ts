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
  // 위해 어떤 권을 얼마 환불했는지 명시. "완료" 단계라 수령 안내(미래형)는
  // 모순 — 영수증 성격으로 사실만 통보.
  refundCompleted: (args: {
    serviceName: string;
    amountPhp: number;
  }) => {
    const money = `₱${args.amountPhp.toLocaleString()}`;
    return `[환불 완료] ${args.serviceName} 권 ${money} 환불 처리되었습니다.`;
  },
  // 매장 사정으로 단체수업/서비스가 폐지되어 자동 환불이 접수된 직후 STORE
  // thread 발송. 회원 변심이 아니라 매장 귀책이므로 정중한 사과 + 100% 환불
  // 안내 + 카운터 방문 안내.
  // serviceName 이 이미 "수업" 으로 끝나면 suffix 중복(예: "그룹 요가 수업 수업이") 회피.
  classDiscontinuedRefund: (args: {
    serviceName: string;
    amountPhp: number;
  }) => {
    const money = `₱${args.amountPhp.toLocaleString()}`;
    const subject = args.serviceName.endsWith("수업")
      ? `${args.serviceName}이`
      : `${args.serviceName} 수업이`;
    return `안녕하세요, 회원님. 매장 사정으로 ${subject} 더 이상 운영되지 않게 되었습니다. 잔여 회수에 대해 정가의 100% (${money}) 를 환불해 드리도록 자동 접수해 두었습니다. 빠른 시일 안에 매장 카운터에서 직접 수령하실 수 있도록 준비해 두겠으니, 방문해 주시면 감사하겠습니다. 불편을 드려 진심으로 죄송합니다.`;
  },
};
