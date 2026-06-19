import { getTranslations } from "next-intl/server";
import { logout } from "@/lib/auth/actions";
import { SidebarNav } from "./dashboard/SidebarNav";
import type { ReactNode } from "react";

/**
 * 사장 운영 영역 공용 셸 — 상단 가로 메뉴(hybrid-c) + 로그아웃 + 콘텐츠 래퍼.
 * 좌측 사이드바를 폐지하고 모든 운영 페이지가 이 셸을 쓴다.
 * - subtitle: 매장명 옆 보조 텍스트(페이지 제목/날짜 등)
 * - action: 우측 액션 버튼(추가/새로고침 등). 로그아웃은 셸이 항상 붙인다.
 */
export async function OwnerShell({
  lang,
  slug,
  businessName,
  subtitle,
  action,
  children,
}: {
  lang: string;
  slug: string;
  businessName: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  const tn = await getTranslations("nav");
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-200 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <span className="text-lg font-semibold tracking-tight text-zinc-900">
              {businessName}
            </span>
            {subtitle && (
              <span className="text-sm text-zinc-500">{subtitle}</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {action}
            <form action={logout.bind(null, `/${lang}/g/${slug}/login`)}>
              <button className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50">
                {tn("logout")}
              </button>
            </form>
          </div>
        </div>
        <div className="mt-3">
          <SidebarNav orientation="top" />
        </div>
      </header>

      <main className="overflow-x-hidden">{children}</main>
    </div>
  );
}
