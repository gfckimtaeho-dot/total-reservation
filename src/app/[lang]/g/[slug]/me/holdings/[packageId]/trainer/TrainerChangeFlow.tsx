"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import {
  classifyTrainerChange,
  applyTrainerChange,
  type TrainerChangePreview,
} from "../../actions";

type Trainer = {
  id: string;
  name: string;
  photoUrl: string | null;
  specialties: string[];
  career: string | null;
  bio: string | null;
};

// 페이지 A 클라이언트 — 트레이너 선택 -> 분류 미리보기 모달 -> 확정.
// 분류/확정은 서버 액션. 확정 후 충돌 건이 있으면 재예약 페이지로 이동.
export function TrainerChangeFlow({
  slug,
  lang,
  packageId,
  trainers,
  nextHref,
}: {
  slug: string;
  lang: string;
  packageId: string;
  trainers: Trainer[];
  // 첫 트레이너 지정 후 자연스러운 다음 이동지(예: 예약 화면). 없으면
  // 기본 /me/holdings 로 (기존 트레이너 변경 흐름).
  nextHref: string | null;
}) {
  const t = useTranslations("me");
  const router = useRouter();
  const [selected, setSelected] = useState<Trainer | null>(null);
  const [preview, setPreview] = useState<TrainerChangePreview | null>(null);
  const [classifying, startClassify] = useTransition();
  const [applying, startApply] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pick(trainer: Trainer) {
    if (classifying || applying) return;
    setSelected(trainer);
    setError(null);
    startClassify(async () => {
      const result = await classifyTrainerChange(slug, packageId, trainer.id);
      if (result.ok) {
        setPreview(result);
      } else {
        setSelected(null);
        setError(t("trainerChangeError"));
      }
    });
  }

  function closeModal() {
    if (applying) return;
    setPreview(null);
    setSelected(null);
  }

  function confirm() {
    if (!selected) return;
    setError(null);
    startApply(async () => {
      const result = await applyTrainerChange(slug, packageId, selected.id);
      if (!result.ok) {
        setError(t("trainerChangeError"));
        return;
      }
      if (result.conflictCount > 0) {
        // 충돌 건 재예약이 먼저. nextHref 는 그 다음으로 미룬다(rebook
        // 페이지에서 별도 안내).
        router.push(
          `/${lang}/g/${slug}/me/holdings/${packageId}/rebook`,
        );
      } else if (nextHref) {
        // 첫 트레이너 지정 흐름 — 사용자가 원래 가려던 화면(예약 등)
        // 으로 자연 연결. 매핑 완료 신호로 router.refresh 도 같이.
        router.push(nextHref);
      } else {
        router.push(`/${lang}/g/${slug}/me/holdings`);
      }
      router.refresh();
    });
  }

  return (
    <>
      <section className="rounded-3xl bg-white/70 p-5 ring-1 ring-white/80 backdrop-blur-xl shadow-[0_24px_60px_-30px_rgba(249,115,22,0.45)]">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-600">
          {t("trainerChangePickHint")}
        </div>
        <ul className="mt-3 space-y-2">
          {trainers.map((tr) => {
            const loading = classifying && selected?.id === tr.id;
            return (
              <li key={tr.id}>
                <button
                  type="button"
                  onClick={() => pick(tr)}
                  disabled={classifying || applying}
                  className="flex w-full items-start gap-3 rounded-2xl border border-orange-100 bg-white p-3 text-left transition hover:border-orange-300 hover:bg-orange-50 disabled:opacity-50"
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-orange-400 to-rose-500">
                    {tr.photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={tr.photoUrl}
                        alt={tr.name}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-sm font-medium text-zinc-900">
                        {tr.name}
                      </span>
                      {tr.specialties.length > 0 && (
                        <span className="text-[11px] text-zinc-500">
                          {tr.specialties.join(" · ")}
                        </span>
                      )}
                    </div>
                    {tr.career && (
                      <div className="mt-1 text-[11px] text-zinc-500">
                        {tr.career}
                      </div>
                    )}
                    {tr.bio && (
                      <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                        {tr.bio}
                      </p>
                    )}
                  </div>
                  {loading ? (
                    <span className="shrink-0 text-[11px] text-zinc-500">
                      {t("trainerChangeChecking")}
                    </span>
                  ) : (
                    <ChevronRight
                      size={16}
                      className="mt-0.5 shrink-0 text-zinc-400"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        {error && !preview && (
          <div className="mt-3 text-xs text-rose-700">{error}</div>
        )}
      </section>

      {preview && preview.ok && selected && (
        <SummaryModal
          trainerName={preview.trainerName}
          autoCount={preview.autoMovable.length}
          conflicts={preview.conflicts}
          lang={lang}
          applying={applying}
          error={error}
          onConfirm={confirm}
          onClose={closeModal}
        />
      )}
    </>
  );
}

function SummaryModal({
  trainerName,
  autoCount,
  conflicts,
  lang,
  applying,
  error,
  onConfirm,
  onClose,
}: {
  trainerName: string;
  autoCount: number;
  conflicts: { id: string; startIso: string; serviceName: string }[];
  lang: string;
  applying: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("me");
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hasFuture = autoCount > 0 || conflicts.length > 0;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-3xl border border-orange-200/80 bg-white p-6 shadow-[0_30px_80px_-20px_rgba(249,115,22,0.45)]">
        <div className="font-heading text-lg font-bold tracking-tight text-zinc-900">
          {t("trainerChangeSummaryTitle", { name: trainerName })}
        </div>

        {!hasFuture ? (
          <p className="mt-3 text-sm leading-relaxed text-zinc-700">
            {t("trainerChangeNoFuture")}
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {autoCount > 0 && (
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
                {t("trainerChangeAutoLine", {
                  n: autoCount,
                  name: trainerName,
                })}
              </div>
            )}
            {conflicts.length > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
                <div className="text-sm text-amber-800">
                  {t("trainerChangeConflictLine", { n: conflicts.length })}
                </div>
                <ul className="mt-2 space-y-1">
                  {conflicts.map((c) => (
                    <li
                      key={c.id}
                      className="text-xs tabular-nums text-amber-700"
                    >
                      {formatResv(c.startIso, c.serviceName, lang)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-3 text-xs text-rose-700">{error}</div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={applying}
            className="flex-1 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_15px_40px_-15px_rgba(249,115,22,0.55)] hover:brightness-110 disabled:opacity-60"
          >
            {applying
              ? t("trainerChangeApplying")
              : t("trainerChangeConfirmYes")}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={applying}
            className="rounded-full bg-white px-4 py-2.5 text-sm text-zinc-700 ring-1 ring-orange-200 hover:bg-orange-50 disabled:opacity-60"
          >
            {t("trainerChangeConfirmNo")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function formatResv(iso: string, serviceName: string, lang: string): string {
  const d = new Date(iso);
  const label = new Intl.DateTimeFormat(lang === "en" ? "en-US" : "ko-KR", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${label} · ${serviceName}`;
}
