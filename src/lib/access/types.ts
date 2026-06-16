// 출입 검증 공용 타입 — 게스트(호텔 Stay) 와 회원/직원(User.accessToken) 두 경로가
// 같은 응답 형태로 수렴해 스캐너 단말이 단일 화면으로 렌더한다.

export type AccessResultValue = "ALLOWED" | "DENIED" | "EXPIRED";

// GUEST = 제휴 호텔 투숙객, MEMBER = 헬스장 회원, STAFF = 트레이너/매니저.
export type AccessKind = "GUEST" | "MEMBER" | "STAFF";

// 거절 사유 머신 코드 — UI 번역은 스캐너 화면(access.reason.*) 책임.
export type AccessReason =
  // 공통
  | "GYM_NOT_FOUND" // slug 로 헬스장 못 찾음
  // 게스트(호텔 Stay) 경로
  | "STAY_NOT_FOUND" // 호텔 DB 에 해당 Stay 없음 (garbage/만료 토큰)
  | "NOT_AFFILIATED" // 이 호텔은 이 헬스장과 제휴 아님(또는 제휴 비활성)
  | "NOT_OPTED_IN" // 게스트가 헬스장 이용 의사(gymOptIn) 표시 안 함
  | "NOT_YET" // 체크인 전
  | "CHECKED_OUT" // 체크아웃(조기 포함) 이후
  // 회원/직원(User.accessToken) 경로
  | "WRONG_GYM" // 토큰은 유효하나 다른 매장 소속 계정
  | "INACTIVE" // 계정 비활성 또는 status != ACTIVE
  | "NO_MEMBERSHIP" // 회원인데 유효 회원권 없음(미발급/미시작)
  | "MEMBERSHIP_EXPIRED" // 회원권 만료(만료일 다음날부터)
  | "QR_EXPIRED"; // 당일 출입권(QrToken) 만료 — 앱에서 새 QR 발급 필요

export type AccessOutcome = {
  result: AccessResultValue;
  kind: AccessKind;
  name: string | null; // 게스트/회원/직원 표시명
  hotelName: string | null; // 게스트 전용 (회원/직원은 null)
  reason: AccessReason | null;
};
