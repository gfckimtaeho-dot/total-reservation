import type { Viewport } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { requireGymCustomer } from "@/lib/auth/dal";
import { gymTodayUtcMidnight } from "@/lib/calendar/gymTime";
import { loadMeFortnight } from "@/lib/calendar/meFortnight";
import { loadMeDaySheet } from "../actions";
import { MeFortnight } from "./MeFortnight";

// V18 Sunset Peach — 화이트 + 오렌지/로즈/앰버. 모바일 상태바도 흰색.
export const viewport: Viewport = {
  themeColor: "#ffffff",
};

// 가로 스크롤 14일 + 2주간 내 예약 + 선택일 옵션. 사용자 결정:
//  1) 가로 strip 은 viewport 5 칸 / 총 14 일 (오늘 포함). 스크롤로 나머지 확인.
//  2) "2주간 내 예약" 리스트 + "선택일 옵션" 두 섹션 동시 표시 (옵션 B).
//  3) PT 신청은 별도 /reservations/new 페이지, 단체수업은 인라인 confirm.
export default async function MeCalendarPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const user = await requireGymCustomer(slug);
  const business = user.business!;
  const t = await getTranslations("me");

  const todayMid = gymTodayUtcMidnight(business.timeZone);
  const fortnight = await loadMeFortnight(business.id, user.id, todayMid);
  // 오늘 옵션을 SSR 로 함께 — 진입 즉시 옵션 영역이 채워짐.
  const initialSheet = await loadMeDaySheet(slug, fortnight.todayKey);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-orange-50 via-rose-50 to-amber-50 font-sans text-zinc-900">
      <div className="pointer-events-none absolute -top-32 left-1/4 h-[28rem] w-[28rem] rounded-full bg-orange-200/60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 right-0 h-[24rem] w-[28rem] rounded-full bg-rose-200/50 blur-3xl" />

      <header className="relative border-b border-orange-100">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-5 py-3">
          <div className="min-w-0 text-2xl font-bold tracking-tight text-zinc-900">
            {t("calendarTitle")}
          </div>
          <Link
            href={`/${lang}/g/${slug}/me`}
            aria-label={t("calendarBack")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-orange-200 bg-white text-orange-700 hover:bg-orange-50"
          >
            <ChevronLeft size={18} />
          </Link>
        </div>
      </header>

      <main className="relative flex-1">
        <div className="mx-auto w-full max-w-md px-5 py-5">
          <MeFortnight
            slug={slug}
            lang={lang}
            fortnight={fortnight}
            initialSheet={initialSheet}
          />
        </div>
      </main>
    </div>
  );
}
