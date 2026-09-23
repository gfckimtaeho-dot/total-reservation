// 환불 기준 금액 = 고객이 실제 결제한 금액 (2026-09-24 사용자 결정, 정가 기준 폐기).
//
// 권(Package/Membership).pricePhp 는 발급 시 플랜 정가 스냅샷이고, 프로모션 할인은
// Sale.totalPaidPhp 에만 반영된다. 그래서 환불 시점에 Sale 을 보고 결제액을 역산한다.
//   - 단품 판매: listPricePhp === pricePhp 라 결제액 = totalPaidPhp 그대로.
//   - 콤보 판매: Sale 하나에 권 여러 개 → 각 권 정가 비율로 결제액을 배분.
//   - Sale 없는 옛 권(도입 전 발급): 정가를 그대로 결제액으로 본다.
// 별도 컬럼/백필 없이 Sale 이 단일 진실. 환불 시 RefundRequest.paidPhp 에 스냅샷.

export type SaleBasis = { listPricePhp: number; totalPaidPhp: number } | null;

export function paidBasisPhp(pricePhp: number, sale: SaleBasis): number {
  if (!sale || sale.listPricePhp <= 0) return pricePhp;
  if (sale.listPricePhp === pricePhp) return sale.totalPaidPhp;
  return Math.round((sale.totalPaidPhp * pricePhp) / sale.listPricePhp);
}
