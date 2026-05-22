"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import {
  loadMeDayBooking,
  joinScheduledClass,
  cancelReservation,
  cancelGroupEnrollment,
  type MeDayBookingResult,
} from "./actions";
import type { MeCalCell } from "@/lib/calendar/meCalendar";

// 고객 캘린더 날짜 클릭 시 뜨는 데이 시트(모달).
//  - 과거/오늘: 그 날 본인 예약을 서비스명/강사/시간으로 표시(액션 없음).
//  - 미래: 기존 예약(변경·취소) + 예약하기. 예약 후보는 loadMeDayBooking 으로
//    "그 날 실제 가능한 것"만 받는다 — 트레이너 휴무·정원 마감을 미리 거른다.
// 헤더의 backdrop-blur 가 fixed 자식을 가두므로 createPortal 로 body 에 띄운다.

type Rel = "past" | "today" | "future";

const WD_KO = ["일", "월", "화", "수", "목", "금", "토"];
const WD_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function hm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(
    min % 60,
  ).padStart(2, "0")}`;
}

export function MeDaySheet({
  slug,
  lang,
  cell,
  rel,
  withinHorizon,
  onClose,
}: {
  slug: string;
  lang: string;
  cell: MeCalCell;
  rel: Rel;
  withinHorizon: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("me");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // 인라인 확인 — 취소·등록 같은 결과 있는 액션은 한 번 더 확인. 키 = 행 식별자.
  const [confirmKey, setConfirmKey] = useState<string | null>(null);

  const isFuture = rel === "future";
  // 예약하기 섹션 노출 조건 — 미래 + 영업일 + 예약 가능 기간 안.
  const showBooking = isFuture && cell.isOpen && withinHorizon;

  const [booking, setBooking] = useState<MeDayBookingResult | null>(null);
  const [loadingBooking, setLoadingBooking] = useState(showBooking);

  useEffect(() => {
    if (!showBooking) return;
    let alive = true;
    loadMeDayBooking(slug, cell.dayKey)
      .then((r) => {
        if (alive) {
          setBooking(r);
          setLoadingBooking(false);
        }
      })
      .catch(() => {
        if (alive) {
          setLoadingBooking(false);
          setError(t("meDayError"));
        }
      });
    return () => {
      alive = false;
    };
    // cell.dayKey 고정 — 시트는 한 날짜에 대해 한 번만 연다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [y, m, d] = cell.dayKey.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const dateLabel = new Intl.DateTimeFormat(
    lang === "en" ? "en-US" : "ko-KR",
    { timeZone: "UTC", month: "long", day: "numeric" },
  ).format(new Date(Date.UTC(y, m - 1, d, 12)));
  const wd = (lang === "en" ? WD_EN : WD_KO)[
    new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  ];

  function finish() {
    setError(null);
    onClose();
    router.refresh();
  }

  function act(fn: () => Promise<{ ok: boolean }>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (r.ok) finish();
      else setError(t("meDayError"));
    });
  }

  function goBook(packageId: string) {
    router.push(
      `/${lang}/g/${slug}/me/reservations/new?pkg=${packageId}&date=${cell.dayKey}`,
    );
  }
  function goMove(reservationId: string) {
    router.push(
      `/${lang}/g/${slug}/me/reservations/${reservationId}/move`,
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-zinc-900 p-5 text-zinc-100 sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-heading text-lg tracking-tight text-white">
              {dateLabel}
            </div>
            <div className="mt-0.5 text-xs text-zinc-400">{wd}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("meDayClose")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 text-zinc-300 hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>

        {/* 휴무일 — 미래 클릭 시 안내 */}
        {isFuture && !cell.isOpen && (
          <div className="mt-4 rounded-xl border border-zinc-600/40 bg-zinc-700/20 p-4 text-sm text-zinc-300">
            {t("meDayClosed")}
          </div>
        )}

        {/* 내 예약 — 과거/오늘/미래 공통, 있을 때만 */}
        {cell.events.length > 0 && (
          <section className="mt-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              {t("meDayMyReservations")}
            </h3>
            <ul className="mt-2 space-y-2">
              {cell.events.map((ev) => {
                const done = ev.status === "COMPLETED";
                const canAct = isFuture && cell.isOpen && !done;
                const rowKey = `ev-${ev.id}`;
                return (
                  <li
                    key={ev.id}
                    className="rounded-xl border border-white/10 bg-white/5 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          "font-mono text-xs tabular-nums " +
                          (ev.kind === "group"
                            ? "text-emerald-300"
                            : "text-sky-300")
                        }
                      >
                        {hm(ev.startMin)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                        {done && "✓ "}
                        {ev.label}
                      </span>
                      {ev.staffName && (
                        <span className="shrink-0 text-xs text-zinc-400">
                          {ev.staffName}
                        </span>
                      )}
                    </div>
                    {canAct && (
                      <div className="mt-2 flex justify-end gap-1.5">
                        {confirmKey === rowKey ? (
                          <InlineConfirm
                            t={t}
                            pending={pending}
                            onYes={() =>
                              act(() =>
                                ev.kind === "group"
                                  ? cancelGroupEnrollment(slug, ev.id)
                                  : cancelReservation(slug, ev.id),
                              )
                            }
                            onNo={() => setConfirmKey(null)}
                          />
                        ) : (
                          <>
                            {ev.kind === "pt" && (
                              <button
                                type="button"
                                onClick={() => goMove(ev.id)}
                                className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-zinc-200 ring-1 ring-white/15 hover:bg-white/10"
                              >
                                {t("actionChange")}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setConfirmKey(rowKey)}
                              className="rounded-full bg-rose-400/10 px-3 py-1.5 text-xs font-medium text-rose-300 ring-1 ring-rose-400/30 hover:bg-rose-400/20"
                            >
                              {t("actionCancel")}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* 예약하기 — 미래 + 영업일 + 기간 안 */}
        {showBooking && (
          <section className="mt-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              {t("meDayBook")}
            </h3>
            {loadingBooking ? (
              <p className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-zinc-400">
                {t("meDayLoading")}
              </p>
            ) : !booking || booking.options.length === 0 ? (
              <p className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-relaxed text-zinc-400">
                {booking?.hasPasses
                  ? t("meDayNoneToday")
                  : t("meDayNoPass")}
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {booking.options.map((opt) => {
                  if (opt.kind === "group") {
                    const rowKey = `gc-${opt.scheduleId}`;
                    return (
                      <li
                        key={rowKey}
                        className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs tabular-nums text-emerald-300">
                            {hm(opt.startMin)}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                            {t("meDayGroupLabel", {
                              service: opt.serviceName,
                            })}
                          </span>
                        </div>
                        <div className="mt-2 flex justify-end">
                          {confirmKey === rowKey ? (
                            <InlineConfirm
                              t={t}
                              pending={pending}
                              onYes={() =>
                                act(() =>
                                  joinScheduledClass(
                                    slug,
                                    opt.scheduleId,
                                    y,
                                    m,
                                    d,
                                  ),
                                )
                              }
                              onNo={() => setConfirmKey(null)}
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmKey(rowKey)}
                              className="rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-400/30 hover:bg-emerald-400/25"
                            >
                              {t("classJoinBtn")}
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  }
                  // 1:1 — 그날 불가해도 빼지 않고 사유와 함께 비활성으로.
                  const sub = opt.available
                    ? opt.trainerName
                      ? t("meDayWithTrainer", { name: opt.trainerName })
                      : ""
                    : opt.reason === "leave"
                      ? t("meDayTrainerLeave", { trainer: opt.trainerName })
                      : opt.reason === "full"
                        ? t("meDayTrainerFull", {
                            trainer: opt.trainerName,
                          })
                        : t("meDayTrainerOff", {
                            trainer: opt.trainerName,
                            weekday: wd,
                          });
                  return (
                    <li
                      key={`pkg-${opt.packageId}`}
                      className={
                        "rounded-xl border p-3 " +
                        (opt.available
                          ? "border-sky-400/20 bg-sky-400/5"
                          : "border-white/10 bg-white/[0.03]")
                      }
                    >
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <div
                            className={
                              "truncate text-sm font-medium " +
                              (opt.available
                                ? "text-white"
                                : "text-zinc-500")
                            }
                          >
                            {t("meDayOneToOneLabel", {
                              service: opt.serviceName,
                            })}
                          </div>
                          {sub && (
                            <div className="mt-0.5 text-[11px] text-zinc-500">
                              {sub}
                            </div>
                          )}
                        </div>
                        {/* 불가한 날은 예약 버튼 자체를 숨김 — 사유 텍스트만 남긴다. */}
                        {opt.available && (
                          <button
                            type="button"
                            onClick={() => goBook(opt.packageId)}
                            className="shrink-0 rounded-full bg-sky-400/15 px-3 py-1.5 text-xs font-semibold text-sky-200 ring-1 ring-sky-400/30 hover:bg-sky-400/25"
                          >
                            {t("actionBook")}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {/* 미래 영업일이지만 예약 가능 기간(3개월) 밖 */}
        {isFuture && cell.isOpen && !withinHorizon && (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-xs leading-relaxed text-zinc-400">
            {t("meDayTooFar")}
          </div>
        )}

        {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}
      </div>
    </div>,
    document.body,
  );
}

function InlineConfirm({
  t,
  pending,
  onYes,
  onNo,
}: {
  t: (k: string) => string;
  pending: boolean;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-zinc-400">{t("meDayConfirm")}</span>
      <button
        type="button"
        disabled={pending}
        onClick={onYes}
        className="rounded-full bg-rose-400/20 px-3 py-1.5 text-xs font-semibold text-rose-200 ring-1 ring-rose-400/40 disabled:opacity-50"
      >
        {t("meDayYes")}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={onNo}
        className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-zinc-300 ring-1 ring-white/15 disabled:opacity-50"
      >
        {t("cancelConfirmNo")}
      </button>
    </div>
  );
}
