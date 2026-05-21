// 매장이 선택 가능한 IANA 타임존 목록. 확장 시 여기에 줄만 추가하면 된다.
// IANA id 를 저장하므로 Intl 변환이 DST 까지 알아서 처리한다(고정 오프셋 금지).

export const SUPPORTED_TIMEZONES = [
  { id: "Asia/Manila", label: "필리핀 (마닐라)" },
  { id: "Asia/Seoul", label: "대한민국 (서울)" },
  { id: "Asia/Tokyo", label: "일본 (도쿄)" },
  { id: "Asia/Singapore", label: "싱가포르" },
  { id: "Asia/Bangkok", label: "태국 (방콕)" },
  { id: "Asia/Jakarta", label: "인도네시아 (자카르타)" },
  { id: "Asia/Ho_Chi_Minh", label: "베트남 (호치민)" },
  { id: "Asia/Hong_Kong", label: "홍콩" },
  { id: "Australia/Sydney", label: "호주 (시드니)" },
  { id: "America/Los_Angeles", label: "미국 서부 (로스앤젤레스)" },
  { id: "America/New_York", label: "미국 동부 (뉴욕)" },
  { id: "Europe/London", label: "영국 (런던)" },
] as const;

export const DEFAULT_TIME_ZONE = "Asia/Manila";

const SUPPORTED_IDS: ReadonlySet<string> = new Set(
  SUPPORTED_TIMEZONES.map((t) => t.id),
);

// 입력값이 지원 타임존인지 검증 — 폼/액션에서 사용.
export function isSupportedTimeZone(tz: string): boolean {
  return SUPPORTED_IDS.has(tz);
}
