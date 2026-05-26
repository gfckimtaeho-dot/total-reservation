"use client";

// 트레이너 양도 다이얼로그 — /my-clients/[customerId] 권 카드 옆 + /members/[id] OWNER 액션에서 공통 사용.
// 진입: 트리거 버튼 클릭 → 백드롭 + 가운데 dialog. lazy load candidates.
//
// V8 다크 톤 / 운영 라이트 톤 둘 다 지원 — tone prop.

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";
import {
  handoverServiceAssignment,
  listHandoverCandidates,
} from "@/lib/handover/actions";

type Tone = "dark" | "light";

type Props = {
  slug: string;
  customerId: string;
  customerName: string;
  serviceId: string;
  serviceName: string;
  fromStaffUserId: string; // 현재 담당 User.id — 본인(트레이너) 또는 현재 매핑(OWNER)
  fromStaffName: string;
  activePackages: number;
  upcomingReservations: number;
  tone: Tone;
  triggerClassName?: string;
  // 양도 성공 후 이동할 URL. 트레이너 측은 본인 담당 잃을 수 있어 /my-clients 목록으로,
  // OWNER 측은 현재 페이지 유지를 위해 undefined (router.refresh 만).
  successHref?: string;
};

export function HandoverDialog({
  slug,
  customerId,
  customerName,
  serviceId,
  serviceName,
  fromStaffUserId,
  fromStaffName,
  activePackages,
  upcomingReservations,
  tone,
  triggerClassName,
  successHref,
}: Props) {
  const t = useTranslations("handover");
  const router = useRouter();
  const titleId = useId();

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [candidates, setCandidates] = useState<
    { userId: string; name: string }[] | null
  >(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => setMounted(true), []);

  // ESC 닫기.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // 후보 lazy load — 열릴 때 한 번.
  useEffect(() => {
    if (!open || candidates !== null) return;
    void (async () => {
      const r = await listHandoverCandidates({
        slug,
        excludeUserId: fromStaffUserId,
      });
      if ("ok" in r && r.ok) {
        setCandidates(r.candidates);
      } else {
        setError(r.error);
        setCandidates([]);
      }
    })();
  }, [open, candidates, slug, fromStaffUserId]);

  function execute() {
    if (!picked) return;
    setError(null);
    startTransition(async () => {
      const r = await handoverServiceAssignment({
        slug,
        customerId,
        serviceId,
        toStaffUserId: picked,
      });
      if ("ok" in r && r.ok) {
        if (successHref) {
          // 트레이너 본인이 담당을 잃을 수 있는 케이스 — server action 의
          // revalidatePath 가 현재 페이지(/my-clients/[customerId]) 를 즉시
          // 백그라운드 refetch 하면, 가드(본인 담당 권 없음) 가 not-found 를
          // 던져 404 가 잠깐 swap in 된다. 1.2s 메시지 대기 동안 그 깜빡임이
          // 노출됐던 문제 — 즉시 push 해서 새 URL 로 먼저 이동. 성공 피드백은
          // 목적지(/my-clients) 의 담당 고객 수 변화로 대체.
          setOpen(false);
          setPicked(null);
          setCandidates(null);
          router.push(successHref);
        } else {
          // OWNER/MANAGER — 가드 통과되므로 메시지 잠깐 표시 후 refresh.
          const toName =
            candidates?.find((c) => c.userId === picked)?.name ?? "";
          const msg =
            r.reservationsCancelled > 0
              ? t("successWithCancel", {
                  toName,
                  transferred: r.reservationsTransferred,
                  cancelled: r.reservationsCancelled,
                })
              : t("successOk", { toName });
          setSuccess(msg);
          setTimeout(() => {
            setOpen(false);
            setSuccess(null);
            setPicked(null);
            setCandidates(null);
            router.refresh();
          }, 1200);
        }
      } else {
        setError(r.error);
      }
    });
  }

  const tk = STYLE[tone];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={triggerClassName ?? tk.trigger}
      >
        {t("actionLabel")}
      </button>

      {open && mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div className={`relative w-full max-w-md rounded-2xl p-5 shadow-2xl ${tk.panel}`}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("cancel")}
                className={`absolute right-3 top-3 text-lg ${tk.close}`}
              >
                ×
              </button>

              <h2
                id={titleId}
                className={`pr-8 text-base font-bold tracking-tight ${tk.title}`}
              >
                {t("title", { service: serviceName })}
              </h2>
              <p className={`mt-1 text-xs ${tk.sub}`}>
                {customerName} · {t("currentTrainer")}: {fromStaffName}
              </p>

              <div className={`mt-3 rounded-lg p-2.5 text-xs ${tk.impact}`}>
                {t("impact", {
                  pkg: activePackages,
                  res: upcomingReservations,
                })}
              </div>

              <div className="mt-4">
                <div className={`mb-2 text-xs font-semibold ${tk.label}`}>
                  {t("selectTrainer")}
                </div>
                {candidates === null ? (
                  <div className={`text-xs ${tk.sub}`}>...</div>
                ) : candidates.length === 0 ? (
                  <div className={`text-xs ${tk.sub}`}>{t("noCandidates")}</div>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {candidates.map((c) => (
                      <li key={c.userId}>
                        <label
                          className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                            picked === c.userId ? tk.optActive : tk.optIdle
                          }`}
                        >
                          <input
                            type="radio"
                            name="handover-pick"
                            value={c.userId}
                            checked={picked === c.userId}
                            onChange={() => setPicked(c.userId)}
                            className="accent-orange-500"
                          />
                          <span>{c.name}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <p className={`mt-3 text-[11px] ${tk.note}`}>{t("note")}</p>

              {error && (
                <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${tk.error}`} role="alert">
                  {error}
                </div>
              )}
              {success && (
                <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${tk.success}`}>
                  {success}
                </div>
              )}

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className={tk.cancelBtn}
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  onClick={execute}
                  disabled={!picked || pending || !!success}
                  className={`${tk.execBtn} disabled:opacity-50`}
                >
                  {pending ? t("executing") : t("execute")}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

const STYLE: Record<
  Tone,
  {
    trigger: string;
    panel: string;
    close: string;
    title: string;
    sub: string;
    label: string;
    impact: string;
    optIdle: string;
    optActive: string;
    note: string;
    error: string;
    success: string;
    cancelBtn: string;
    execBtn: string;
  }
> = {
  dark: {
    trigger:
      "rounded-md border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-500/25",
    panel: "bg-zinc-900 text-zinc-100 ring-1 ring-white/10",
    close: "text-zinc-400 hover:text-white",
    title: "text-white",
    sub: "text-zinc-400",
    label: "text-zinc-300",
    impact: "bg-amber-500/10 text-amber-200 ring-1 ring-amber-400/30",
    optIdle: "bg-zinc-950/40 text-zinc-200 ring-1 ring-white/5 hover:ring-orange-400/40",
    optActive:
      "bg-gradient-to-r from-orange-500/20 to-pink-500/20 text-white ring-1 ring-orange-400/60",
    note: "text-zinc-500",
    error: "bg-rose-950/50 text-rose-200 ring-1 ring-rose-500/40",
    success: "bg-emerald-950/50 text-emerald-200 ring-1 ring-emerald-500/40",
    cancelBtn:
      "rounded-md border border-white/10 px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/5",
    execBtn:
      "rounded-md bg-gradient-to-r from-orange-500 to-pink-500 px-4 py-1.5 text-sm font-bold text-white shadow-md hover:brightness-110",
  },
  light: {
    trigger:
      "rounded-md border border-orange-300 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 transition hover:bg-orange-100",
    panel: "bg-white text-zinc-900 ring-1 ring-ink/10",
    close: "text-zinc-500 hover:text-zinc-900",
    title: "text-ink",
    sub: "text-ink/60",
    label: "text-ink/80",
    impact: "bg-amber-50 text-amber-900 ring-1 ring-amber-300",
    optIdle: "bg-zinc-50 text-zinc-900 ring-1 ring-ink/10 hover:ring-orange-300",
    optActive:
      "bg-orange-50 text-zinc-900 ring-1 ring-orange-400",
    note: "text-ink/50",
    error: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
    success: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    cancelBtn:
      "rounded-md border border-ink/10 px-3 py-1.5 text-sm text-ink/70 hover:bg-zinc-50",
    execBtn:
      "rounded-md bg-gradient-to-r from-orange-500 to-rose-500 px-4 py-1.5 text-sm font-bold text-white shadow-sm hover:brightness-110",
  },
};
