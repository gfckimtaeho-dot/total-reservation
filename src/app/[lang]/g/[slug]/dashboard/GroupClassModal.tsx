"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type {
  GroupOccurrence,
  GroupStudent,
} from "@/lib/calendar/trainerCalendarPro";
import {
  cancelGroupEnrollment,
  moveGroupEnrollment,
  completeGroupEnrollments,
  uncompleteGroupEnrollment,
} from "./group-class-actions";
import { GroupRegisterModal } from "./GroupRegisterModal";

const WD_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;
const WD_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function hm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(
    min % 60,
  ).padStart(2, "0")}`;
}

// 본인 담당 단체수업 1회차 관리 — 격자 셀 탭 시. 등록 수강생 명단 +
// 수강생별 이동·취소 + 새 고객 등록 + 출석 완료 처리(체크리스트).
export function GroupClassModal({
  occ,
  moveTargets,
  slug,
  lang = "ko",
  isToday,
  onClose,
  onChanged,
}: {
  occ: GroupOccurrence;
  moveTargets: GroupOccurrence[];
  slug: string;
  lang?: string;
  isToday: boolean; // 이 회차가 오늘인가 — 완료는 당일만 가능.
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useTranslations("trainerCal");
  const WD = lang === "en" ? WD_EN : WD_KO;
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [moving, setMoving] = useState<GroupStudent | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<GroupStudent | null>(
    null,
  );
  const [showReg, setShowReg] = useState(false);
  // 출석 완료 모드 — 체크된 수강생만 완료 처리.
  const [completing, setCompleting] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const whenLabel = `${occ.month}/${occ.day} ${hm(occ.startMin)}`;
  const full = occ.enrolled >= occ.capacity;
  const pendingStudents = occ.students.filter((s) => !s.completed);

  function doCancel(s: GroupStudent) {
    setErr(null);
    startTransition(async () => {
      const r = await cancelGroupEnrollment({
        slug,
        reservationId: s.reservationId,
      });
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      onChanged();
    });
  }
  function doMove(s: GroupStudent, tgt: GroupOccurrence) {
    setErr(null);
    startTransition(async () => {
      const r = await moveGroupEnrollment({
        slug,
        reservationId: s.reservationId,
        year: tgt.year,
        month: tgt.month,
        day: tgt.day,
      });
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      onChanged();
    });
  }
  // 출석 완료 모드 진입 — 기본은 미완료 수강생 전원 체크.
  function startCompleting() {
    setErr(null);
    setChecked(new Set(pendingStudents.map((s) => s.reservationId)));
    setCompleting(true);
  }
  function toggleChecked(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function doComplete() {
    setErr(null);
    startTransition(async () => {
      const r = await completeGroupEnrollments({
        slug,
        reservationIds: [...checked],
      });
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      onChanged();
    });
  }
  // 완료 취소(당일 한정) — 실수로 완료한 수강생 되돌림 + 권 환불.
  function doUncomplete(s: GroupStudent) {
    setErr(null);
    startTransition(async () => {
      const r = await uncompleteGroupEnrollment({
        slug,
        reservationId: s.reservationId,
      });
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      onChanged();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-purple-400/30 bg-zinc-900 p-5 text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-heading text-base text-white">
              {occ.className}
            </h3>
            <p className="mt-0.5 text-xs tabular-nums text-purple-200/80">
              {whenLabel} · {occ.enrolled}/{occ.capacity}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-xs text-zinc-400 hover:text-zinc-100"
          >
            {t("close")}
          </button>
        </div>
        {err && <p className="mt-2 text-sm text-rose-400">{err}</p>}

        {moving ? (
          <div className="mt-3">
            <p className="text-xs text-purple-200">
              {t("groupMovePick", { name: moving.name })}
            </p>
            {moveTargets.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">
                {t("groupMoveNone")}
              </p>
            ) : (
              <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto">
                {moveTargets.map((tgt) => (
                  <li
                    key={`${tgt.scheduleId}-${tgt.year}-${tgt.month}-${tgt.day}`}
                  >
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => doMove(moving, tgt)}
                      className="flex w-full items-center justify-between rounded-md border border-white/15 px-3 py-2 text-sm transition hover:border-purple-400/50 hover:bg-purple-400/10 disabled:opacity-50"
                    >
                      <span className="tabular-nums">
                        {tgt.month}/{tgt.day} ({WD[tgt.weekdayIdx]}){" "}
                        {hm(tgt.startMin)}
                      </span>
                      <span className="text-xs tabular-nums text-zinc-500">
                        {tgt.enrolled}/{tgt.capacity}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setMoving(null)}
              className="mt-3 text-xs text-zinc-400 hover:text-zinc-100"
            >
              {t("cancel")}
            </button>
          </div>
        ) : completing ? (
          <>
            <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-300/90">
              {t("groupCompleteHeading")}
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              {t("groupCompleteHint")}
            </p>
            <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto">
              {occ.students.map((s) => (
                <li
                  key={s.reservationId}
                  className="rounded-lg bg-zinc-950/60 p-2.5 ring-1 ring-white/10"
                >
                  {s.completed ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-zinc-400">{s.name}</span>
                      <span className="text-xs text-emerald-300">
                        ✓ {t("completed")}
                      </span>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={checked.has(s.reservationId)}
                        onChange={() => toggleChecked(s.reservationId)}
                        className="h-4 w-4 accent-emerald-500"
                      />
                      <span className="text-sm font-medium text-white">
                        {s.name}
                      </span>
                    </label>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCompleting(false)}
                className="rounded-lg border border-white/15 py-2.5 text-sm text-zinc-300 transition hover:bg-white/5"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                disabled={pending || checked.size === 0}
                onClick={doComplete}
                className="rounded-lg border border-emerald-400/50 bg-emerald-400/15 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/25 disabled:opacity-40"
              >
                {t("groupCompleteDo", { n: checked.size })}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
              {t("groupStudentsHeading")}
            </div>
            {occ.students.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">
                {t("groupNoStudents")}
              </p>
            ) : (
              <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto">
                {occ.students.map((s) => (
                  <li
                    key={s.reservationId}
                    className="rounded-lg bg-zinc-950/60 p-2.5 ring-1 ring-white/10"
                  >
                    {s.completed ? (
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm text-zinc-300">
                          {s.name}
                        </span>
                        <span className="shrink-0 text-xs text-emerald-300">
                          ✓ {t("completed")}
                        </span>
                        {isToday && (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => doUncomplete(s)}
                            className="shrink-0 rounded-md border border-white/15 px-2.5 py-1 text-xs text-zinc-300 disabled:opacity-40"
                          >
                            {t("uncomplete")}
                          </button>
                        )}
                      </div>
                    ) : confirmCancel?.reservationId === s.reservationId ? (
                      <div>
                        <p className="text-xs text-zinc-300">
                          {t("groupCancelConfirm", { name: s.name })}
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmCancel(null)}
                            className="rounded-md border border-white/15 py-1.5 text-xs text-zinc-300"
                          >
                            {t("cancel")}
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => doCancel(s)}
                            className="rounded-md border border-rose-400/50 bg-rose-400/15 py-1.5 text-xs font-semibold text-rose-300 disabled:opacity-40"
                          >
                            {t("confirmOk")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                          {s.name}
                        </span>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setMoving(s)}
                          className="shrink-0 rounded-md border border-purple-400/40 bg-purple-400/15 px-2.5 py-1 text-xs text-purple-200 disabled:opacity-40"
                        >
                          {t("move")}
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setConfirmCancel(s)}
                          className="shrink-0 rounded-md border border-white/15 px-2.5 py-1 text-xs text-zinc-300 disabled:opacity-40"
                        >
                          {t("cancel")}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={pendingStudents.length === 0 || !isToday}
                onClick={startCompleting}
                className="rounded-lg border border-emerald-400/50 bg-emerald-400/15 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/25 disabled:opacity-30"
              >
                {t("groupComplete")}
              </button>
              <button
                type="button"
                disabled={full}
                onClick={() => setShowReg(true)}
                className="rounded-lg bg-purple-500/20 py-2.5 text-sm font-semibold text-purple-200 ring-1 ring-purple-400/40 transition hover:bg-purple-500/30 disabled:opacity-30"
              >
                {full ? t("groupClassFull") : t("groupAddStudent")}
              </button>
            </div>
            {!isToday && pendingStudents.length > 0 && (
              <p className="mt-2 text-[11px] text-zinc-500">
                {t("groupCompleteTodayOnly")}
              </p>
            )}
          </>
        )}
      </div>

      {showReg && (
        <GroupRegisterModal
          slug={slug}
          target={{
            scheduleId: occ.scheduleId,
            className: occ.className,
            year: occ.year,
            month: occ.month,
            day: occ.day,
          }}
          whenLabel={whenLabel}
          enrolledCustomerIds={occ.students.map((s) => s.customerId)}
          onClose={() => setShowReg(false)}
          onDone={() => {
            setShowReg(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
