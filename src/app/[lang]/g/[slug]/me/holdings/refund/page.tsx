import type { Viewport } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";

export const viewport: Viewport = {
  themeColor: "#ffffff",
};
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
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-orange-50 via-rose-50 to-amber-50 font-sans text-zinc-900">
      <div className="pointer-events-none absolute -top-32 left-1/4 h-[28rem] w-[28rem] rounded-full bg-orange-200/60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 right-0 h-[24rem] w-[28rem] rounded-full bg-rose-200/50 blur-3xl" />

      <header className="relative border-b border-orange-100">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-6 py-3">
          <div className="text-2xl font-bold tracking-tight text-zinc-900">
            {t("refundTitle")}
          </div>
          <Link
            href={`/${lang}/g/${slug}/me/holdings`}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-orange-200 bg-white text-orange-700 hover:bg-orange-50"
            aria-label={t("refundBack")}
          >
            <ChevronLeft size={18} />
          </Link>
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
