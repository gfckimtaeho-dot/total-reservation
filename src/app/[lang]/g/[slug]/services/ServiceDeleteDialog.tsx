"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import {
  previewServiceDeletionImpact,
  applyServiceDeletion,
  type ServiceDeletionImpact,
} from "./actions";

// 종목 폐지 다이얼로그. ScheduleDeleteDialog 와 동일 패턴 — 영향 검사 → 자동 환불 → soft delete.
// 헤더 backdrop-blur containing block 회피용 portal 필수.

export function ServiceDeleteDialog({
  slug,
  serviceId,
  serviceName,
  onClose,
  onDeleted,
}: {
  slug: string;
  serviceId: string;
  serviceName: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useTranslations("services.serviceDelete");
  const [loading, setLoading] = useState(true);
  const [impact, setImpact] = useState<ServiceDeletionImpact | null>(null);
  const [applying, startApply] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void previewServiceDeletionImpact(slug, serviceId).then((r) => {
      if (cancelled) return;
      setImpact(r);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [slug, serviceId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !applying) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [applying, onClose]);

  function apply() {
    setError(null);
    startApply(async () => {
      const r = await applyServiceDeletion({ slug, serviceId });
      if (r.error) {
        setError(t("errorApply"));
        return;
      }
      onDeleted();
    });
  }

  const hasImpact =
    impact?.ok &&
    (impact.affectedMembers.length > 0 ||
      impact.futureReservationsCount > 0 ||
      impact.activeSchedulesCount > 0);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        className="absolute inset-0 bg-zinc-900/50 backdrop-blur-sm"
        onClick={() => {
          if (!applying) onClose();
        }}
      />
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 text-zinc-100 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.18em] text-zinc-400">
              {t("eyebrow")}
            </div>
            <div className="mt-0.5 truncate text-base font-semibold text-white">
              {serviceName}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={applying}
            aria-label={t("close")}
            className="ml-3 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-5">
          {loading && (
            <div className="py-12 text-center text-sm text-zinc-400">
              {t("loading")}
            </div>
          )}

          {!loading && impact && !impact.ok && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
              {t("errorPreview")}
            </div>
          )}

          {!loading && impact?.ok && !hasImpact && (
            <div className="space-y-3 text-sm text-zinc-300">
              <p>{t("noImpact")}</p>
            </div>
          )}

          {!loading && impact?.ok && hasImpact && (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                <div className="font-semibold">{t("warningTitle")}</div>
                <p className="mt-1 text-amber-200/90">
                  {t("warningBody", {
                    schedules: impact.activeSchedulesCount,
                    members: impact.affectedMembers.length,
                    reservations: impact.futureReservationsCount,
                  })}
                </p>
              </div>

              {impact.affectedMembers.length > 0 && (
                <div>
                  <div className="mb-2 flex items-baseline justify-between text-xs uppercase tracking-[0.18em] text-zinc-400">
                    <span>{t("membersHeader")}</span>
                    <span className="tabular-nums text-zinc-300">
                      {t("totalRefund", {
                        amount: money(impact.totalRefundPhp),
                      })}
                    </span>
                  </div>
                  <ul className="divide-y divide-white/5 rounded-xl border border-white/10 bg-white/[0.02]">
                    {impact.affectedMembers.map((m) => (
                      <li
                        key={m.packageId}
                        className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2 text-sm"
                      >
                        <span className="truncate text-zinc-200">
                          {m.customerName}
                        </span>
                        <span className="tabular-nums text-zinc-400">
                          {t("remainingLabel", { n: m.remainingCount })}
                        </span>
                        <span className="tabular-nums font-medium text-emerald-300">
                          {money(m.refundPhp)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
              {error}
            </div>
          )}
        </div>

        {!loading && impact?.ok && (
          <div className="flex flex-wrap gap-2 border-t border-white/10 bg-zinc-900/60 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={applying}
              className="flex-1 rounded-full bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-white/10 disabled:opacity-50"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={applying}
              className="flex-1 rounded-full bg-gradient-to-r from-rose-500 to-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_15px_40px_-15px_rgba(244,63,94,0.55)] hover:brightness-110 disabled:opacity-60"
            >
              {applying
                ? t("applying")
                : hasImpact
                  ? t("deleteWithRefund")
                  : t("deleteConfirm")}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function money(php: number): string {
  return `₱${php.toLocaleString("en-PH")}`;
}
