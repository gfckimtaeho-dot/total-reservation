import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { normalizeSlug } from "@/lib/auth/normalize";
import { AccessScanner } from "../AccessScanner";

// "홈 화면에 추가" 시 주소창 없는 standalone 키오스크로 스캐너에 바로 진입하도록
// 스캐너 전용 manifest 를 연결(area=scan + key). start_url = 이 키 링크.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string; key: string }>;
}): Promise<Metadata> {
  const { lang, slug, key } = await params;
  return {
    manifest: `/${lang}/g/${slug}/manifest.webmanifest?area=scan&key=${encodeURIComponent(key)}`,
  };
}

// 무인 출입 스캐너 (세션 없는 영구 링크). /g/{slug}/scan/{key}.
// 직원 로그인 대신 링크 안의 scannerKey 로만 인증 — 사장이 설정에서 발급/재발급.
// 키가 매장 scannerKey 와 일치할 때만 화면 노출, 아니면 404(재발급된 옛 링크 차단).
// 실제 검증은 POST /api/access/verify 가 같은 key 를 받아 단말을 확인한다.
export default async function GymKeyedScanPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string; key: string }>;
}) {
  const { slug: rawSlug, key } = await params;
  const slug = normalizeSlug(rawSlug);

  const business = await prisma.business.findUnique({
    where: { slug },
    select: { name: true, scannerKey: true, status: true },
  });
  // 키 미발급/불일치는 노출 안 함. 차단(BLOCKED)/만료 매장도 막는다.
  if (
    !business ||
    !business.scannerKey ||
    business.scannerKey !== key ||
    business.status === "BLOCKED" ||
    business.status === "EXPIRED"
  ) {
    notFound();
  }

  return <AccessScanner slug={slug} gymName={business.name} verifyKey={key} />;
}
