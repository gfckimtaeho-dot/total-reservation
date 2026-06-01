import { describe, it, expect } from "vitest";
import { decideMemberAccess } from "./memberVerify";

// 날짜는 @db.Date 와 동일하게 UTC 자정 Date 로 구성.
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

const today = d("2026-06-01");

describe("decideMemberAccess", () => {
  it("비활성 계정이면 최우선 거절", () => {
    expect(
      decideMemberAccess({
        active: false,
        status: "ACTIVE",
        isStaff: true,
        memberships: [],
        today,
      }),
    ).toEqual({ result: "DENIED", reason: "INACTIVE" });
  });

  it("status 가 ACTIVE 가 아니면 거절", () => {
    expect(
      decideMemberAccess({
        active: true,
        status: "WITHDRAWN",
        isStaff: false,
        memberships: [{ startDate: d("2026-05-01"), endDate: d("2026-12-31") }],
        today,
      }),
    ).toEqual({ result: "DENIED", reason: "INACTIVE" });
  });

  it("직원(STAFF)은 회원권 없이 통과", () => {
    expect(
      decideMemberAccess({
        active: true,
        status: "ACTIVE",
        isStaff: true,
        memberships: [],
        today,
      }),
    ).toEqual({ result: "ALLOWED", reason: null });
  });

  it("유효 회원권(날짜창 안)이면 통과", () => {
    expect(
      decideMemberAccess({
        active: true,
        status: "ACTIVE",
        isStaff: false,
        memberships: [{ startDate: d("2026-05-01"), endDate: d("2026-06-30") }],
        today,
      }),
    ).toEqual({ result: "ALLOWED", reason: null });
  });

  it("만료일 당일은 통과 (endDate inclusive)", () => {
    expect(
      decideMemberAccess({
        active: true,
        status: "ACTIVE",
        isStaff: false,
        memberships: [{ startDate: d("2026-05-01"), endDate: d("2026-06-01") }],
        today,
      }),
    ).toEqual({ result: "ALLOWED", reason: null });
  });

  it("만료일 다음날부터 EXPIRED", () => {
    expect(
      decideMemberAccess({
        active: true,
        status: "ACTIVE",
        isStaff: false,
        memberships: [{ startDate: d("2026-05-01"), endDate: d("2026-05-31") }],
        today,
      }),
    ).toEqual({ result: "EXPIRED", reason: "MEMBERSHIP_EXPIRED" });
  });

  it("회원권이 아예 없으면 NO_MEMBERSHIP", () => {
    expect(
      decideMemberAccess({
        active: true,
        status: "ACTIVE",
        isStaff: false,
        memberships: [],
        today,
      }),
    ).toEqual({ result: "DENIED", reason: "NO_MEMBERSHIP" });
  });

  it("시작 전 회원권만 있으면 NO_MEMBERSHIP (미시작)", () => {
    expect(
      decideMemberAccess({
        active: true,
        status: "ACTIVE",
        isStaff: false,
        memberships: [{ startDate: d("2026-07-01"), endDate: d("2026-12-31") }],
        today,
      }),
    ).toEqual({ result: "DENIED", reason: "NO_MEMBERSHIP" });
  });

  it("여러 회원권 중 하나라도 유효하면 통과", () => {
    expect(
      decideMemberAccess({
        active: true,
        status: "ACTIVE",
        isStaff: false,
        memberships: [
          { startDate: d("2026-01-01"), endDate: d("2026-03-31") }, // 만료
          { startDate: d("2026-05-15"), endDate: d("2026-08-15") }, // 유효
        ],
        today,
      }),
    ).toEqual({ result: "ALLOWED", reason: null });
  });
});
