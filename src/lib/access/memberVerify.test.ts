import { describe, it, expect } from "vitest";
import { decideMemberAccess, decideQrTokenAccess } from "./memberVerify";

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

describe("decideQrTokenAccess (고객 당일 출입권)", () => {
  const now = new Date("2026-06-16T08:00:00.000Z");
  const future = new Date("2026-06-17T00:00:00.000Z"); // 오늘 끝(유효)
  const past = new Date("2026-06-16T00:00:00.000Z"); // 이미 지남(만료)

  it("유효 토큰 + 활성 계정이면 통과", () => {
    expect(
      decideQrTokenAccess({ active: true, status: "ACTIVE", expiresAt: future, now }),
    ).toEqual({ result: "ALLOWED", reason: null });
  });

  it("비활성 계정이면 최우선 거절", () => {
    expect(
      decideQrTokenAccess({ active: false, status: "ACTIVE", expiresAt: future, now }),
    ).toEqual({ result: "DENIED", reason: "INACTIVE" });
  });

  it("status 가 ACTIVE 가 아니면 거절", () => {
    expect(
      decideQrTokenAccess({ active: true, status: "WITHDRAWN", expiresAt: future, now }),
    ).toEqual({ result: "DENIED", reason: "INACTIVE" });
  });

  it("만료된 당일권은 EXPIRED/QR_EXPIRED", () => {
    expect(
      decideQrTokenAccess({ active: true, status: "ACTIVE", expiresAt: past, now }),
    ).toEqual({ result: "EXPIRED", reason: "QR_EXPIRED" });
  });

  it("만료 경계(expiresAt === now)는 만료 처리", () => {
    expect(
      decideQrTokenAccess({ active: true, status: "ACTIVE", expiresAt: now, now }),
    ).toEqual({ result: "EXPIRED", reason: "QR_EXPIRED" });
  });
});
