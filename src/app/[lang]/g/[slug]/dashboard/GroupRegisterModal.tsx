"use client";

import { useState, useEffect, useTransition } from "react";
import { useTranslations } from "next-intl";
import { searchCustomers } from "./service-actions";
import { registerGroupClass } from "./group-class-actions";

type Cust = { id: string; name: string; phone: string | null };

export type RegisterTarget = {
  scheduleId: string;
  className: string;
  year: number;
  month: number;
  day: number;
};

// 단체수업 1회차에 고객을 등록 — 패널·격자 셀 양쪽이 공용.
// 고객 검색(디바운스 300ms) → 행 탭 시 즉시 registerGroupClass.
export function GroupRegisterModal({
  slug,
  target,
  whenLabel,
  enrolledCustomerIds,
  onClose,
  onDone,
}: {
  slug: string;
  target: RegisterTarget;
  whenLabel: string;
  // 이 회차에 이미 등록된 고객 id — 검색 결과에서 미리 표시(중복 등록 방지).
  enrolledCustomerIds: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("trainerCal");
  const enrolledSet = new Set(enrolledCustomerIds);
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Cust[]>([]);
  const [searched, setSearched] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults([]);
      setSearched(false);
      return;
    }
    const id = setTimeout(() => {
      startTransition(async () => {
        const r = await searchCustomers({ slug, q: term });
        setSearched(true);
        setResults(r.ok ? ((r.data as Cust[]) ?? []) : []);
      });
    }, 300);
    return () => clearTimeout(id);
  }, [q, slug]);

  function pick(custId: string) {
    setErr(null);
    startTransition(async () => {
      const r = await registerGroupClass({
        slug,
        scheduleId: target.scheduleId,
        customerUserId: custId,
        year: target.year,
        month: target.month,
        day: target.day,
      });
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      onDone();
    });
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-purple-400/30 bg-zinc-900 p-5 text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-heading text-base text-white">
          {t("groupRegTitle")}
        </h3>
        <p className="mt-1 text-xs text-purple-200/80">
          {target.className} · {whenLabel}
        </p>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="mt-3 w-full rounded-md border border-white/15 bg-zinc-950 px-3 py-2 text-sm"
        />
        {err && <p className="mt-2 text-sm text-rose-400">{err}</p>}
        <ul className="mt-3 max-h-60 space-y-1 overflow-y-auto">
          {results.map((c) => {
            if (enrolledSet.has(c.id)) {
              return (
                <li key={c.id}>
                  <div className="flex w-full items-center justify-between rounded-md border border-white/10 px-3 py-2 text-sm opacity-70">
                    <span className="font-medium text-zinc-400">
                      {c.name}
                    </span>
                    <span className="text-xs text-emerald-400">
                      {t("groupAlreadyEnrolled")}
                    </span>
                  </div>
                </li>
              );
            }
            return (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => pick(c.id)}
                  className="flex w-full items-center justify-between rounded-md border border-white/15 px-3 py-2 text-sm transition hover:border-purple-400/50 hover:bg-purple-400/10 disabled:opacity-50"
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs text-zinc-500">
                    {c.phone ?? ""}
                  </span>
                </button>
              </li>
            );
          })}
          {pending && (
            <li className="text-xs text-zinc-500">{t("searchTyping")}</li>
          )}
          {!pending &&
            results.length === 0 &&
            (searched ? (
              <li className="text-xs text-zinc-500">{t("noResults")}</li>
            ) : (
              <li className="text-xs text-zinc-500">{t("searchHint")}</li>
            ))}
        </ul>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-zinc-400"
          >
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}
