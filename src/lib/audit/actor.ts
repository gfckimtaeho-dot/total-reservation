// 감사 스탬프용 "현재 로그인 계정" 해석기.
//
// verifySession() 은 React.cache 로 요청당 1회만 쿠키+DB 조회한다(읽기라
// 아래 Prisma 자동스탬프 확장과 재귀하지 않음). 동적 import 로 client.ts ↔
// dal.ts 순환을 런타임으로 미뤄 끊는다.
//
// 요청 컨텍스트가 없는 곳(스크립트/빌드/cron 등)에서는 cookies() 가 throw →
// catch 해서 null 반환 = "시스템 작성"(createdById/updatedById null).

export async function currentActorId(): Promise<string | null> {
  try {
    const { verifySession } = await import("@/lib/auth/dal");
    const user = await verifySession();
    return user?.id ?? null;
  } catch {
    return null;
  }
}
