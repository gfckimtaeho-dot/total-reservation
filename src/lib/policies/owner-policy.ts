import { prisma } from "@/lib/db/client";

// 한 Business 에 role=OWNER User 는 1명만 허용 ([[decision-owner-one-per-business]]).
// spec REQUIREMENTS.md "사장 1명 + 매니저 N명" 룰. 신규 OWNER User 생성 또는
// 기존 User 의 role 을 OWNER 로 승격하기 직전에 호출.
//
// 헬퍼는 prisma client 를 직접 쓴다 — caller 의 transaction 컨텍스트와는 별개로
// 동작 (Prisma 7 $extends 적용 후 TransactionClient 타입과 외부 인자 호환이 어렵고,
// 신규 매장 등록 / 단일 admin role 승격은 동시 발생할 일이 없어 race window 없음).
// schema constraint 로의 보강(raw partial unique index)은 [[decision-dev-prod-same-neon]]
// baseline 정리와 함께 별도 라운드.
export async function assertSingleOwner(
  gymId: string,
  excludeUserId?: string,
): Promise<void> {
  const existing = await prisma.user.findFirst({
    where: {
      gymId,
      role: "OWNER",
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw new Error(
      `OWNER policy: business ${gymId} already has an OWNER (user ${existing.id})`,
    );
  }
}
