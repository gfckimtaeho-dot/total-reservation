"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { cancelReservation } from "./actions";

export type UpcomingItemProps = {
  id: string;
  serviceName: string;
  staffName: string;
  isPersonal: boolean;
  isGroup: boolean;
  startAtIso: string;
  dateLabel: string; // "05-22"
  timeLabel: string; // "19:00"
  sameDay: boolean;
  lang: string;
  slug: string;
};

// 한 줄 형식 (사용자 명시): "05-22 19:00 단체 Yoga 담당자명"
// PT: "05-24 09:00 PT Kevin" (단체 prefix 없음)
// V8 sunset 그라데 pill로 PT/단체 구분.
export function UpcomingItem(p: UpcomingItemProps) {
  const t = useTranslations("me");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canMutate = p.isPersonal && !p.sameDay;

  function onCancelClick() {
    setError(null);
    setConfirming(true);
  }

  function onCancelConfirm() {
    setError(null);
    startTransition(async () => {
      const r = await cancelReservation(p.slug, p.id);
      if (r.ok) {
        setConfirming(false);
        router.refresh();
      } else {
        setError(t("cancelError"));
      }
    });
  }

  // "{date} {time} [단체 ]{service} {staff}" 한 줄
  const tail = p.isGroup
    ? `${t("legendGroup")} ${p.serviceName} ${p.staffName}`
    : `${p.serviceName} ${p.staffName}`;

  return (
    <li className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className={
              "rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 " +
              (p.isGroup
                ? "bg-purple-500/20 text-purple-200 ring-purple-400/40"
                : "bg-orange-500/20 text-orange-200 ring-orange-400/40")
            }
          >
            {p.isGroup ? t("legendGroup") : t("legendPersonal")}
          </span>
          <div className="min-w-0 truncate text-sm">
            <span className="font-heading tabular-nums text-zinc-100">
              {p.dateLabel} {p.timeLabel}
            </span>
            <span className="ml-2 text-zinc-300">{tail}</span>
          </div>
        </div>

        {canMutate ? (
          <div className="flex shrink-0 gap-1.5">
            <Link
              href={`/${p.lang}/g/${p.slug}/me/reservations/${p.id}/move`}
              className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-zinc-100 ring-1 ring-white/15 hover:bg-white/10"
            >
              {t("actionChange")}
            </Link>
            <button
              type="button"
              onClick={onCancelClick}
              className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300 ring-1 ring-white/15 hover:bg-rose-500/10 hover:text-rose-200"
            >
              {t("actionCancel")}
            </button>
          </div>
        ) : null}
      </div>

      {p.isPersonal && p.sameDay && (
        <p className="mt-2 rounded-md bg-white/5 px-3 py-2 text-xs leading-relaxed text-zinc-400 ring-1 ring-white/10">
          {t("sameDayPhoneOnly")}
        </p>
      )}

      {confirming && (
        <div className="mt-2 rounded-md bg-zinc-900/80 p-3 ring-1 ring-amber-300/40 backdrop-blur">
          <div className="font-medium text-zinc-100">
            {t("cancelConfirmTitle")}
          </div>
          <div className="mt-1 text-xs text-zinc-400">
            {t("cancelConfirmBody", {
              service: p.serviceName,
              date: p.dateLabel,
              time: p.timeLabel,
            })}
          </div>
          {error && (
            <div className="mt-2 text-xs text-rose-400">{error}</div>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onCancelConfirm}
              disabled={pending}
              className="rounded-full bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-400 disabled:opacity-60"
            >
              {pending ? t("cancelling") : t("cancelConfirmYes")}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-zinc-200 ring-1 ring-white/15 hover:bg-white/10 disabled:opacity-60"
            >
              {t("cancelConfirmNo")}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
