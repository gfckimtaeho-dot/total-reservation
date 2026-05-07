"use client";

import { useTranslations } from "next-intl";

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
