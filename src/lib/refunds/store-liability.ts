// 매장 귀책 환불 산식 — 단체수업/서비스 폐지, 강사 부재 등 매장 사유의 환불.
// 회원 변심(50%) 환불과 달리 100% 환불. 올림(Math.ceil)로 회원에게 유리.
//
// 회원 변심 산식과의 차이:
//   - 회원 변심: refund = ceil( (remaining - today) × unitPrice × 0.5 )
//   - 매장 귀책: refund = ceil( remaining × unitPrice × 1.0 )
//
// 매장 귀책은 "당일 예약" 차감 안 함 — 매장이 폐지한 시점에 회원이 자기 의지로
// 잡아둔 예약을 사용 처리하는 게 부당. 잔여 전부 환불.

const MS_DAY = 24 * 60 * 60 * 1000;

export function packageStoreLiabilityRefund(input: {
  pricePhp: number;
  totalCount: number;
  remainingCount: number;
}): {
  paidPerUnit: number;
  refundUnits: number;
  refundPhp: number;
  completedUnits: number;
} {
  const paidPerUnit = input.pricePhp / input.totalCount;
  const refundUnits = Math.max(0, input.remainingCount);
  const refundPhp = Math.ceil(refundUnits * paidPerUnit);
  const completedUnits = input.totalCount - input.remainingCount;
  return { paidPerUnit, refundUnits, refundPhp, completedUnits };
}

export function membershipStoreLiabilityRefund(input: {
  pricePhp: number;
  startDate: Date;
  endDate: Date;
  todayUtcMidnight: Date;
}): {
  totalDays: number;
  remainingDays: number;
  elapsedDays: number;
  paidPerDay: number;
  refundPhp: number;
} {
  const totalDays = Math.max(
    1,
    Math.round((input.endDate.getTime() - input.startDate.getTime()) / MS_DAY),
  );
  const remainingDays = Math.max(
    0,
    Math.min(
      totalDays,
      Math.round(
        (input.endDate.getTime() - input.todayUtcMidnight.getTime()) / MS_DAY,
      ),
    ),
  );
  const elapsedDays = totalDays - remainingDays;
  const paidPerDay = input.pricePhp / totalDays;
  const refundPhp = Math.ceil(remainingDays * paidPerDay);
  return { totalDays, remainingDays, elapsedDays, paidPerDay, refundPhp };
}
