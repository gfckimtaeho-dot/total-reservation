import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { OwnerShell } from "../../../OwnerShell";
import { loadMemberRefundPreview, loadMemberRefundAll } from "../../actions";
import { MemberRefundForm } from "./MemberRefundForm";
import type { RefundItem } from "@/lib/refunds/member-request";

// 카운터 환불 — 사장/매니저가 회원 대면 후 회원 변심(50%) 환불을 처리(즉시 완료).
// 진입: /members/[id] 보유 상품 행 "환불"(?kind=&pass=) 또는 헤더 "전체 환불"(?all=1).
// 고객 셀프 신청(/me/holdings/refund)은 2026-09-23, /refunds 화면은 2026-09-24 폐기.
export default async function MemberRefundPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; slug: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang, slug, id: memberId } = await params;
  const sp = await searchParams;
  const auth = await requireGymStaff(slug);
  const business = auth.business!;
  const t = await getTranslations("memberDetail");

  const backHref = `/${lang}/g/${slug}/members/${memberId}`;
  if (auth.role !== "OWNER" && auth.role !== "MANAGER") redirect(backHref);

  const all = sp.all === "1";
  let items: RefundItem[] = [];
  if (all) {
    items = await loadMemberRefundAll(slug, memberId);
  } else {
    const kindRaw = typeof sp.kind === "string" ? sp.kind : "";
    const passId = typeof sp.pass === "string" ? sp.pass : "";
    if ((kindRaw !== "PACKAGE" && kindRaw !== "MEMBERSHIP") || !passId) {
      redirect(backHref);
    }
    const preview = await loadMemberRefundPreview(
      slug,
      kindRaw as "PACKAGE" | "MEMBERSHIP",
      passId,
    );
    if (!preview.ok) redirect(backHref);
    const { ok: _ok, ...item } = preview;
    void _ok;
    items = [item];
  }

  // 회원 이름 — 전체 환불에서 대상이 0 이어도 헤더에 표시.
  const member = await prisma.user.findFirst({
    where: { id: memberId, gymId: business.id, role: "CUSTOMER" },
    select: { name: true },
  });
  if (!member) redirect(`/${lang}/g/${slug}/members`);

  return (
    <OwnerShell
      lang={lang}
      slug={slug}
      businessName={business.name}
      subtitle={
        <span className="inline-flex items-center gap-2">
          <span className="font-semibold text-zinc-900">
            {all ? t("refundAllTitle") : t("refundTitle")}
          </span>
          <span className="text-zinc-500">{member.name}</span>
        </span>
      }
      action={
        <Link
          href={backHref}
          className="inline-flex items-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50"
        >
          {t("refundBack")}
        </Link>
      }
    >
      <div className="mx-auto w-full max-w-3xl space-y-5 p-6">
        <p className="text-sm leading-relaxed text-zinc-600">
          {t("refundIntro")}
        </p>
        <MemberRefundForm
          slug={slug}
          lang={lang}
          memberId={memberId}
          memberName={member.name}
          items={items}
        />
      </div>
    </OwnerShell>
  );
}
