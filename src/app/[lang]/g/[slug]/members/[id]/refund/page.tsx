import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireGymStaff } from "@/lib/auth/dal";
import { OwnerShell } from "../../../OwnerShell";
import { loadMemberRefundPreview } from "../../actions";
import { MemberRefundForm } from "./MemberRefundForm";

// 카운터 환불 등록 — 사장/매니저가 회원 대면 후 회원 변심(50%) 환불을 기록.
// 진입: /members/[id] 보유 상품 행의 "환불" 버튼. ?kind=PACKAGE|MEMBERSHIP&pass=<id>
// 고객 셀프 신청(/me/holdings/refund)은 2026-09-23 폐기 — 환불 시도 자체를 줄이기
// 위해 오프라인 대면으로만 접수한다.
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

  const kindRaw = typeof sp.kind === "string" ? sp.kind : "";
  const passId = typeof sp.pass === "string" ? sp.pass : "";
  if ((kindRaw !== "PACKAGE" && kindRaw !== "MEMBERSHIP") || !passId) {
    redirect(backHref);
  }
  const kind = kindRaw as "PACKAGE" | "MEMBERSHIP";

  const preview = await loadMemberRefundPreview(slug, kind, passId);
  if (!preview.ok) redirect(backHref);

  return (
    <OwnerShell
      lang={lang}
      slug={slug}
      businessName={business.name}
      subtitle={
        <span className="inline-flex items-center gap-2">
          <span className="font-semibold text-zinc-900">
            {t("refundTitle")}
          </span>
          <span className="text-zinc-500">{preview.memberName}</span>
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
          kind={kind}
          passId={passId}
          preview={preview}
        />
      </div>
    </OwnerShell>
  );
}
