"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ChevronDown,
  Phone,
  MessageCircle,
  UserCog,
  CalendarClock,
} from "lucide-react";

export function PackageTrainerCard({
  slug,
  lang,
  packageId,
  pendingRebookCount,
  assignedStaff,
}: {
  slug: string;
  lang: string;
  packageId: string;
  pendingRebookCount: number;
  assignedStaff: {
    name: string;
    phone: string | null;
    photoUrl: string | null;
    specialty: string | null;
    career: string | null;
    bio: string | null;
  } | null;
}) {
  const t = useTranslations("me");
  const [open, setOpen] = useState(false);

  const trainerHref = `/${lang}/g/${slug}/me/holdings/${packageId}/trainer`;
  const rebookHref = `/${lang}/g/${slug}/me/holdings/${packageId}/rebook`;

  // 트레이너 변경 + (필요 시) 재예약 진입 — 카드 종류와 무관하게 항상 노출.
  const footer = (
    <div className="mt-2 flex flex-wrap gap-2">
      <a
        href={trainerHref}
        className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-[11px] font-medium text-zinc-200 ring-1 ring-white/15 hover:bg-white/10"
      >
        <UserCog size={13} />
        {t("holdingsChangeTrainer")}
      </a>
      {pendingRebookCount > 0 && (
        <a
          href={rebookHref}
          className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1.5 text-[11px] font-semibold text-amber-200 ring-1 ring-amber-300/30 hover:bg-amber-400/25"
        >
          <CalendarClock size={13} />
          {t("holdingsRebookBadge", { n: pendingRebookCount })}
        </a>
      )}
    </div>
  );

  if (!assignedStaff) {
    return (
      <div className="mt-3">
        <div className="rounded-lg border border-amber-300/20 bg-amber-300/5 p-2.5 text-[11px] text-amber-200/90">
          {t("packageNoTrainer")}
        </div>
        {footer}
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="rounded-lg border border-white/5 bg-zinc-900/40">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-3 p-3 text-left"
        >
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-orange-400 to-pink-500">
            {assignedStaff.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={assignedStaff.photoUrl}
                alt={assignedStaff.name}
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <div className="flex-1 text-sm font-medium text-white">
            {assignedStaff.name}
            {assignedStaff.specialty && (
              <span className="ml-2 text-[10px] font-normal text-zinc-400">
                {assignedStaff.specialty}
              </span>
            )}
          </div>
          <ChevronDown
            size={14}
            className={"text-zinc-500 transition " + (open ? "rotate-180" : "")}
          />
        </button>
        {open && (
          <div className="space-y-2 border-t border-white/5 px-3 pb-3 pt-2 text-xs text-zinc-300">
            {assignedStaff.career && (
              <div className="text-[11px] text-zinc-400">
                {assignedStaff.career}
              </div>
            )}
            {assignedStaff.bio && <p>{assignedStaff.bio}</p>}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {assignedStaff.phone && (
                <a
                  href={`tel:${assignedStaff.phone}`}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] text-emerald-200 ring-1 ring-emerald-400/30"
                >
                  <Phone size={10} /> {assignedStaff.phone}
                </a>
              )}
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-1 text-[10px] text-sky-200/60 ring-1 ring-sky-400/20"
                title={t("chatComingSoon")}
              >
                <MessageCircle size={10} /> {t("chatLabel")}
              </button>
            </div>
          </div>
        )}
      </div>
      {footer}
    </div>
  );
}
