"use client";

import { useTranslations } from "next-intl";
import { UserCog, CalendarClock, Undo2 } from "lucide-react";

// PT 권 카드 안 — 트레이너 표시 + 액션 버튼 row.
// 표시는 사진 + 이름 + 전공 한 줄. 소개/연락/채팅 펼침 X (사용자 요청).
// 액션: 트레이너 변경 / (필요 시) 재예약 / 환불 신청 — 한 줄 wrap.
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
    photoUrl: string | null;
    specialty: string | null;
  } | null;
}) {
  const t = useTranslations("me");

  const trainerHref = `/${lang}/g/${slug}/me/holdings/${packageId}/trainer`;
  const rebookHref = `/${lang}/g/${slug}/me/holdings/${packageId}/rebook`;
  const refundHref = `/${lang}/g/${slug}/me/holdings/refund?kind=PACKAGE&id=${packageId}`;

  const footer = (
    <div className="mt-3 flex flex-wrap gap-2">
      <a
        href={trainerHref}
        className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-700 ring-1 ring-orange-200 hover:bg-orange-50"
      >
        <UserCog size={16} />
        {t("holdingsChangeTrainer")}
      </a>
      {pendingRebookCount > 0 && (
        <a
          href={rebookHref}
          className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-800 ring-1 ring-amber-300 hover:bg-amber-200"
        >
          <CalendarClock size={16} />
          {t("holdingsRebookBadge", { n: pendingRebookCount })}
        </a>
      )}
      <a
        href={refundHref}
        className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50"
      >
        <Undo2 size={16} />
        {t("holdingsRefundRequest")}
      </a>
    </div>
  );

  if (!assignedStaff) {
    return (
      <div className="mt-3">
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-[11px] text-amber-700">
          {t("packageNoTrainer")}
        </div>
        {footer}
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="flex items-center gap-3 rounded-lg border border-orange-100 bg-orange-50/60 px-4 py-2">
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-orange-400 to-rose-500">
          {assignedStaff.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={assignedStaff.photoUrl}
              alt={assignedStaff.name}
              className="h-full w-full object-cover"
            />
          )}
        </div>
        <div className="flex-1">
          <span className="text-lg font-bold tracking-tight text-zinc-900">
            {assignedStaff.name}
          </span>
          {assignedStaff.specialty && (
            <span className="ml-2 text-xs font-normal text-zinc-500">
              {assignedStaff.specialty}
            </span>
          )}
        </div>
      </div>
      {footer}
    </div>
  );
}
