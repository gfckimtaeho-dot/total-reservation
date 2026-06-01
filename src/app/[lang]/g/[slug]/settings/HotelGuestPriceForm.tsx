"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  updateHotelGuestDailyPrice,
  type SavePriceState,
} from "./actions";

// 호텔 게스트 1일 단가 입력 + 저장. 빈 값으로 저장하면 미설정(null)로 되돌림.
export function HotelGuestPriceForm({
  slug,
  current,
}: {
  slug: string;
  current: number | null;
}) {
  const t = useTranslations("settings");
  const [state, formAction, pending] = useActionState<SavePriceState, FormData>(
    updateHotelGuestDailyPrice.bind(null, slug),
    { status: "idle" },
  );

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-zinc-500">₱</span>
        <input
          type="number"
          name="price"
          min={0}
          step={1}
          inputMode="numeric"
          defaultValue={current ?? ""}
          placeholder={t("hotelGuestPrice.placeholder")}
          className="w-40 rounded-md border border-zinc-300 px-3 py-2 text-sm tabular-nums focus:border-ink focus:outline-none"
        />
        <span className="text-xs text-zinc-500">{t("hotelGuestPrice.unit")}</span>
        <button
          type="submit"
          disabled={pending}
          className="ml-2 rounded-md bg-ink px-4 py-2 text-xs font-medium text-white transition hover:bg-ink/90 disabled:opacity-50"
        >
          {pending ? t("hotelGuestPrice.saving") : t("hotelGuestPrice.save")}
        </button>
      </div>

      {state.status === "saved" && (
        <p className="text-xs text-emerald-600">{t("hotelGuestPrice.saved")}</p>
      )}
      {state.status === "error" && (
        <p className="text-xs text-rose-600">
          {t(`hotelGuestPrice.err_${state.message}`)}
        </p>
      )}
    </form>
  );
}
