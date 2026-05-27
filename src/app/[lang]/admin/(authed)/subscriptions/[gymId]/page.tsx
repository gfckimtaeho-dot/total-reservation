import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import type { BusinessStatus } from "@/generated/prisma/client";
import { applyExpiryTransitions } from "@/lib/subscription/lifecycle";
import { PaymentForm } from "./PaymentForm";
import { RefundForm } from "./RefundForm";

const dateFmt = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function fmt(d: Date | null | undefined): string {
  if (!d) return "-";
  return dateFmt.format(d);
}

const DAY_MS = 1000 * 60 * 60 * 24;

const STATUS_LABEL: Record<BusinessStatus, string> = {
  TRIAL: "체험중",
  ACTIVE: "정상",
  GRACE: "유예",
  EXPIRED: "만료",
  BLOCKED: "차단",
};
const STATUS_CHIP: Record<BusinessStatus, string> = {
  TRIAL: "bg-sky-50 text-sky-700 ring-sky-200",
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  GRACE: "bg-amber-50 text-amber-700 ring-amber-200",
  EXPIRED: "bg-zinc-100 text-zinc-600 ring-zinc-300",
  BLOCKED: "bg-rose-50 text-rose-700 ring-rose-200",
};

function isoDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function AdminSubscriptionDetailPage({
  params,
}: {
  params: Promise<{ lang: string; gymId: string }>;
}) {
  const { lang, gymId } = await params;

  await applyExpiryTransitions();

  const business = await prisma.business.findUnique({
    where: { id: gymId },
    include: {
      subscription: true,
      payments: { orderBy: { paidAt: "desc" } },
      users: {
        where: { role: "OWNER" },
        select: { loginId: true, email: true, name: true },
        take: 1,
      },
    },
  });

  if (!business) notFound();

  const owner = business.users[0];
  const sub = business.subscription;
  const now = new Date();
  const remainingDays =
    sub && sub.endDate
      ? Math.ceil((sub.endDate.getTime() - now.getTime()) / DAY_MS)
      : null;

  // 환불 권장 금액 = (남은 기간 / 전체 구독 기간) * 마지막 결제 * 50%. spec: 남은 기간의 50%.
  // 분모를 전체 구독 기간으로 두는 이유 = 다년 결제도 정확. plan enum 의 PLAN_DAYS 와 무관.
  let suggestedRefund = 0;
  if (sub && remainingDays !== null && remainingDays > 0 && sub.plan !== "TRIAL") {
    const lastPaid = business.payments.find((p) => p.amountPhp > 0);
    if (lastPaid) {
      const totalDays = Math.ceil(
        (sub.endDate.getTime() - sub.startDate.getTime()) / DAY_MS,
      );
      if (totalDays > 0) {
        const ratio = Math.min(1, remainingDays / totalDays);
        suggestedRefund = Math.ceil(lastPaid.amountPhp * ratio * 0.5);
      }
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/${lang}/admin/subscriptions`}
          className="text-xs text-zinc-600 transition hover:text-ink"
        >
          &lt; 구독 목록
        </Link>
      </div>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl tracking-tight text-ink sm:text-4xl">
            {business.name}
          </h1>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ring-1 ${STATUS_CHIP[business.status]}`}
          >
            {STATUS_LABEL[business.status]}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-600">
          <span className="font-mono">/{business.slug}</span>
          {owner && (
            <span>
              · 사장 {owner.name}
              {owner.loginId ? ` (${owner.loginId})` : ""}
            </span>
          )}
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink/60">
            현재 구독
          </div>
          {sub ? (
            <dl className="space-y-1.5 text-sm">
              <Row k="시작" v={fmt(sub.startDate)} />
              <Row k="만료" v={fmt(sub.endDate)} />
              <Row
                k="남은"
                v={
                  remainingDays === null
                    ? "-"
                    : remainingDays < 0
                      ? `${Math.abs(remainingDays)}일 지남`
                      : `${remainingDays}일`
                }
              />
            </dl>
          ) : (
            <div className="text-sm text-zinc-500">구독 정보 없음.</div>
          )}
        </div>

        <PaymentForm
          gymId={business.id}
          lang={lang}
          defaultPaidAtIso={isoDateInput(now)}
        />
      </section>

      <section>
        <h2 className="font-heading mb-4 text-xl tracking-tight text-ink">
          환불 기록
        </h2>
        <RefundForm gymId={business.id} suggestedAmount={suggestedRefund} />
      </section>

      <section>
        <h2 className="font-heading mb-4 text-xl tracking-tight text-ink">
          결제 이력 ({business.payments.length})
        </h2>
        {business.payments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-500">
            결제 이력이 없습니다.
          </div>
        ) : (
          <ul className="space-y-2">
            {business.payments.map((p) => {
              const isRefund = p.amountPhp < 0;
              return (
                <li
                  key={p.id}
                  className={`rounded-xl border p-4 ${
                    isRefund
                      ? "border-amber-200 bg-amber-50/40"
                      : "border-emerald-200 bg-emerald-50/30"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink">
                          {isRefund ? "환불" : "결제"}{" "}
                          {Math.abs(p.amountPhp).toLocaleString()}₩
                        </span>
                        {p.confirmedAt && (
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-700">
                            confirmed
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-600">
                        입금 {fmt(p.paidAt)} · 확인 {fmt(p.confirmedAt)}
                      </div>
                      {p.memo && (
                        <div className="text-xs text-zinc-700">
                          {p.memo}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-zinc-500">{k}</dt>
      <dd className="min-w-0 truncate text-right text-zinc-900">{v}</dd>
    </div>
  );
}
