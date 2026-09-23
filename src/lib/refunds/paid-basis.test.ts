import { describe, expect, it } from "vitest";
import { paidBasisPhp } from "./paid-basis";

describe("paidBasisPhp — 환불 기준 = 실결제액", () => {
  it("Sale 없는 옛 권은 정가를 그대로 쓴다", () => {
    expect(paidBasisPhp(5000, null)).toBe(5000);
  });

  it("단품 판매(정가 == listPrice)는 실결제액", () => {
    expect(paidBasisPhp(5000, { listPricePhp: 5000, totalPaidPhp: 4000 })).toBe(
      4000,
    );
  });

  it("할인 없는 단품은 정가와 같다", () => {
    expect(paidBasisPhp(5000, { listPricePhp: 5000, totalPaidPhp: 5000 })).toBe(
      5000,
    );
  });

  it("콤보 판매는 정가 비율로 결제액을 배분한다", () => {
    // 회원권 3000 + 수업권 7000 = 정가 10000, 콤보가 8000
    const sale = { listPricePhp: 10000, totalPaidPhp: 8000 };
    expect(paidBasisPhp(3000, sale)).toBe(2400);
    expect(paidBasisPhp(7000, sale)).toBe(5600);
  });

  it("listPrice 가 0 이면 정가 폴백(0 나누기 방지)", () => {
    expect(paidBasisPhp(5000, { listPricePhp: 0, totalPaidPhp: 0 })).toBe(5000);
  });
});
