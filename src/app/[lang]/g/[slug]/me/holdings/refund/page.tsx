import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { requireGymCustomer } from "@/lib/auth/dal";
import { loadRefundPreview, type RefundKindArg } from "../refund-actions";
import { RefundFlow } from "./RefundFlow";

type T = (key: string, vars?: Record<string, string | number>) => string;

// 고객 환불 신청 페이지. ?kind=PACKAGE|MEMBERSHIP&id=...
// 환불 내역(총/완료/당일/환불대상/금액)을 보여주고, "동의" 입력 + 수령방법
// 선택 후 신청. 잘못된 진입/이미 환불된 권은 보유 서비스로 되돌림.
export default async function RefundPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; slug: string }>;
  searchParams: Promise<{ kind?: string; id?: string }>;
}) {
  const { lang, slug } = await params;
  const sp = await searchParams;
  const user = await requireGymCustomer(slug);
  const business = user.business!;
  const t = (await getTranslations("me")) as unknown as T;

  const kind: RefundKindArg | null =
    sp.kind === "MEMBERSHIP"
      ? "MEMBERSHIP"
      : sp.kind === "PACKAGE"
        ? "PACKAGE"
        : null;
  if (!kind || !sp.id) {
    redirect(`/${lang}/g/${slug}/me/holdings`);
  }

  const preview = await loadRefundPreview(slug, kind, sp.id);
  if (!preview.ok) {
    redirect(`/${lang}/g/${slug}/me/holdings`);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute -top-32 left-1/4 h-[28rem] w-[28rem] rounded-full bg-rose-400/20 blur-3xl" />

      <header className="relative border-b border-white/5">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-5">
          <Link
            href={`/${lang}/g/${slug}/me/holdings`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10"
            aria-label={t("refundBack")}
          >
            <ChevronLeft size={18} />
          </Link>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-200/90">
              {business.name}
            </div>
            <div className="mt-0.5 font-heading text-lg tracking-tight text-white">
              {t("refundTitle")}
            </div>
          </div>
        </div>
      </header>

      <main className="relative">
        <div className="mx-auto max-w-3xl px-6 py-6">
          <RefundFlow
            slug={slug}
            lang={lang}
            kind={kind}
            id={sp.id}
            preview={preview}
          />
        </div>
      </main>
    </div>
  );
}
