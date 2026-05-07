"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

// ?day 가 바뀌면 일정 섹션을 부드럽게 화면에 노출.
// (Next.js의 기본 navigation scroll-to-top 은 Link scroll={false} 로 차단했음.)
export function ScrollToScheduleOnDayChange() {
  const searchParams = useSearchParams();
  const day = searchParams.get("day");
  useEffect(() => {
    if (!day) return;
    const el = document.getElementById("schedule");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [day]);
  return null;
}

// 예약 추가 — 실제 reservation 모델 연동 전까지는 안내만.
export function AddReservationButton() {
  const t = useTranslations("dashboard");
  return (
    <button
      type="button"
      onClick={() => alert(t("addReservationStub"))}
      className="rounded-full bg-lime-300 px-3 py-1 text-xs font-semibold text-zinc-950 transition hover:bg-lime-200"
    >
      {t("addReservationBtn")}
    </button>
  );
}
