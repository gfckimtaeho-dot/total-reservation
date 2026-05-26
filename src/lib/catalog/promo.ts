// 프로모션 할인 계산 — 순수 함수. 서버(service-actions: 발급 시 Sale 스냅샷)
// 와 클라(IntakeFlow: 장바구니 미리보기)가 **같은 산식**을 쓰도록 단일화.
// 여기 한 곳만 고치면 발급 금액과 화면 표시가 절대 갈라지지 않음
// (회원권 연장·발급 헬퍼 단일화와 동일 원칙).

export type PromoLike = {
  id: string;
  scope:
    | "ALL"
    | "MEMBERSHIP_ONLY"
    | "PACKAGE_ONLY"
    | "SPECIFIC_MEMBERSHIP"
    | "SPECIFIC_PACKAGE";
  targetId: string | null;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
};

export type PromoLineKind = "MEMBERSHIP" | "PACKAGE";

// 이 프로모션이 해당 라인(회원권/수업권 + plan)에 적용 대상인가.
export function promoMatches(
  p: PromoLike,
  kind: PromoLineKind,
  planId: string,
): boolean {
  if (p.scope === "ALL") return true;
  if (kind === "MEMBERSHIP") {
    if (p.scope === "MEMBERSHIP_ONLY") return true;
    if (p.scope === "SPECIFIC_MEMBERSHIP") return p.targetId === planId;
    return false;
  }
  if (p.scope === "PACKAGE_ONLY") return true;
  if (p.scope === "SPECIFIC_PACKAGE") return p.targetId === planId;
  return false;
}

// 정상가에 대한 할인액(₱, 정수). 0..listPrice 로 클램프.
export function promoDiscountPhp(
  listPricePhp: number,
  p: Pick<PromoLike, "discountType" | "discountValue">,
): number {
  const raw =
    p.discountType === "PERCENT"
      ? Math.floor((listPricePhp * p.discountValue) / 100)
      : p.discountValue;
  return Math.max(0, Math.min(raw, listPricePhp));
}

// 적용 대상 중 할인액 최대 1건(중첩 없음). 없으면 null.
export function pickBestPromo(
  promos: PromoLike[],
  kind: PromoLineKind,
  planId: string,
  listPricePhp: number,
): { id: string; discountPhp: number } | null {
  let best: { id: string; discountPhp: number } | null = null;
  for (const p of promos) {
    if (!promoMatches(p, kind, planId)) continue;
    const discountPhp = promoDiscountPhp(listPricePhp, p);
    if (discountPhp > 0 && (!best || discountPhp > best.discountPhp)) {
      best = { id: p.id, discountPhp };
    }
  }
  return best;
}
