import { describe, it, expect } from "vitest";
import { decideGuestAccess } from "./guestVerify";

// 날짜는 @db.Date 와 동일하게 UTC 자정 Date 로 구성.
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

// 숙박: checkIn 5/28 ~ checkOut 5/31 (inclusive) = 5/28,29,30,31 허용. 6/1 부터 거절.
const base = {
  affiliationActive: true,
  gymOptIn: true,
  status: "ACTIVE" as const,
  checkInDate: d("2026-05-28"),
  checkOutDate: d("2026-05-31"),
};

describe("decideGuestAccess", () => {
  it("제휴 비활성이면 최우선 거절", () => {
    expect(
      decideGuestAccess({ ...base, affiliationActive: false, today: d("2026-05-29") }),
    ).toEqual({ result: "DENIED", reason: "NOT_AFFILIATED" });
  });

  it("gymOptIn=false 면 거절", () => {
    expect(
      decideGuestAccess({ ...base, gymOptIn: false, today: d("2026-05-29") }),
    ).toEqual({ result: "DENIED", reason: "NOT_OPTED_IN" });
  });

  it("조기퇴실(status=CHECKED_OUT)은 숙박기간 안이어도 EXPIRED", () => {
    expect(
      decideGuestAccess({ ...base, status: "CHECKED_OUT", today: d("2026-05-29") }),
    ).toEqual({ result: "EXPIRED", reason: "CHECKED_OUT" });
  });

  it("ACTIVE 가 아닌 어떤 status 든 거절 (whitelist)", () => {
    expect(
      decideGuestAccess({ ...base, status: "FUTURE_UNKNOWN", today: d("2026-05-29") }),
    ).toEqual({ result: "EXPIRED", reason: "CHECKED_OUT" });
  });

  it("체크인 전이면 NOT_YET", () => {
    expect(decideGuestAccess({ ...base, today: d("2026-05-27") })).toEqual({
      result: "DENIED",
      reason: "NOT_YET",
    });
  });

  it("체크인 당일은 허용", () => {
    expect(decideGuestAccess({ ...base, today: d("2026-05-28") })).toEqual({
      result: "ALLOWED",
      reason: null,
    });
  });

  it("마지막 밤(checkOut 전날)은 허용", () => {
    expect(decideGuestAccess({ ...base, today: d("2026-05-30") })).toEqual({
      result: "ALLOWED",
      reason: null,
    });
  });

  it("checkOut 당일은 허용 (inclusive — 체크아웃 당일 오전 운동)", () => {
    expect(decideGuestAccess({ ...base, today: d("2026-05-31") })).toEqual({
      result: "ALLOWED",
      reason: null,
    });
  });

  it("checkOut 다음 날부터 EXPIRED", () => {
    expect(decideGuestAccess({ ...base, today: d("2026-06-01") })).toEqual({
      result: "EXPIRED",
      reason: "CHECKED_OUT",
    });
  });

  it("checkOut 한참 이후도 EXPIRED", () => {
    expect(decideGuestAccess({ ...base, today: d("2026-06-05") })).toEqual({
      result: "EXPIRED",
      reason: "CHECKED_OUT",
    });
  });

  it("우선순위: 제휴 비활성 + optIn=false 면 제휴가 먼저", () => {
    expect(
      decideGuestAccess({
        ...base,
        affiliationActive: false,
        gymOptIn: false,
        today: d("2026-05-29"),
      }),
    ).toEqual({ result: "DENIED", reason: "NOT_AFFILIATED" });
  });
});
