import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";

const STATUS_LABEL: Record<string, string> = {
  BLOCKED: "운영 중지",
  EXPIRED: "구독 만료",
};

export default async function GymBlockedPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;

  const business = await prisma.business.findUnique({
    where: { slug },
    select: { name: true, status: true, blockedReason: true },
  });
  if (!business) notFound();

  // 정상 상태인데 이 페이지로 직접 진입한 경우 — 공개 페이지로 보냄.
  if (business.status !== "BLOCKED" && business.status !== "EXPIRED") {
    redirect(`/${lang}/g/${slug}`);
  }

  const label = STATUS_LABEL[business.status] ?? "운영 중지";
  const isBlocked = business.status === "BLOCKED";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 text-center">
        <div className="inline-flex items-center rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-rose-700 ring-1 ring-rose-200">
          {label}
        </div>

        <h1 className="font-heading text-2xl tracking-tight text-ink">
          {business.name}
        </h1>

        {isBlocked ? (
          <div className="space-y-3 text-sm text-zinc-700">
            <p>
              이 매장은 현재 운영이 중지된 상태입니다. 예약·출입·매장 관리 기능을 일시 사용할 수 없습니다.
            </p>
            {business.blockedReason && (
              <div className="rounded-md bg-rose-50 px-4 py-3 text-left text-xs text-rose-800 ring-1 ring-rose-100">
                <div className="mb-1 font-semibold uppercase tracking-wide">
                  사유
                </div>
                {business.blockedReason}
              </div>
            )}
            <p className="text-xs text-zinc-500">
              재개에 관한 문의는 관리자에게 직접 연락해 주세요.
            </p>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-zinc-700">
            <p>
              이 매장의 구독이 만료되어 7일 유예 기간도 지났습니다. 사장님께서 결제 입금 후 관리자에게 확인을 요청해 주세요.
            </p>
          </div>
        )}

        <Link
          href={`/${lang}`}
          className="inline-flex h-10 items-center rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-ink/90"
        >
          홈으로
        </Link>
      </div>
    </div>
  );
}
