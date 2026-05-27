// 구독 plan 단가·기간 (2026-05-27 정책 변경).
//
// 변경 전: PHP 통화, 1개월/3개월/6개월/1년 4 plan
// 변경 후: KRW 통화, 월 30,000원 단가, admin 이 결제 등록 시 년수 직접 클릭 (1/2/3/...).
//   - SubscriptionPlan enum 자체는 옛 row 호환 위해 보존, admin 측은 ANNUAL 만 사용
//   - schema 의 amountPhp 컬럼 이름은 그대로 유지 (값은 KRW. rename 은 별도 migration 부담)

import type { SubscriptionPlan } from "@/generated/prisma/client";

const DAY_MS = 1000 * 60 * 60 * 24;
const DAYS_PER_YEAR = 365;
const MONTHS_PER_YEAR = 12;

export const MONTHLY_PRICE_KRW = 30000;

// admin 결제 등록 폼의 년수 select 옵션. 운영 편의상 1-5 + 10년 노출.
export const YEAR_OPTIONS: number[] = [1, 2, 3, 4, 5, 10];

export const DEFAULT_YEARS = 1;

export const PLAN_LABEL: Record<SubscriptionPlan, string> = {
  TRIAL: "무료 체험",
  MONTHLY: "1개월",
  QUARTERLY: "3개월",
  SEMIANNUAL: "6개월",
  ANNUAL: "1년",
};

export function priceForYears(years: number): number {
  return MONTHLY_PRICE_KRW * MONTHS_PER_YEAR * years;
}

export function daysForYears(years: number): number {
  return years * DAYS_PER_YEAR;
}

// 결제 시 새 endDate 계산. 현재 endDate 가 미래면 그 위에 연장, 과거면 결제일부터 시작.
export function extendEndDateByDays(
  currentEndDate: Date | null,
  days: number,
  paidAt: Date,
): Date {
  const base =
    currentEndDate && currentEndDate.getTime() > paidAt.getTime()
      ? currentEndDate
      : paidAt;
  return new Date(base.getTime() + days * DAY_MS);
}
