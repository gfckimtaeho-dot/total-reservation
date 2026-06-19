"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  createComboPlan,
  updateComboPlan,
  type MembershipPlanState,
} from "./actions";

type Tone = "normal" | "black" | "white" | "indigo";

export type ComboMembershipOption = {
  id: string;
  name: string;
  pricePhp: number;
  durationDays: number;
  active: boolean;
};

export type ComboPackageOption = {
  id: string;
  name: string;
  pricePhp: number;
  sessionCount: number;
  servicePayoutPhp: number;
  serviceName: string;
  active: boolean;
};

export type ComboPlanInitial = {
  id: string;
  name: string;
  membershipPlanId: string | null;
  pricePhp: number;
  active: boolean;
  packagePlanIds: string[];
};

const TONE = {
  normal: {
    card: "bg-white/80 border-amber-200/60",
    label: "text-ink/70",
    input:
      "bg-white border-ink/15 text-ink focus:border-ink focus:outline-none",
    button: "bg-ink text-white hover:bg-ink/90",
    hint: "text-ink/50",
    error: "text-rose-600",
    notice: "bg-amber-50 border-amber-200 text-amber-800",
    calcCard: "bg-white border-amber-200/60",
    calcRow: "border-amber-200/40",
    marginPos: "text-emerald-700",
    marginNeg: "text-rose-600",
    itemCard: "bg-white border-amber-200/60",
    itemCardActive: "bg-amber-50 border-ink ring-1 ring-ink/40",
  },
  black: {
    card: "bg-zinc-900 border-white/5",
    label: "text-zinc-400",
    input:
      "bg-zinc-950 border-white/10 text-white focus:border-lime-300 focus:outline-none",
    button: "bg-lime-300 text-zinc-950 hover:bg-lime-200",
    hint: "text-zinc-500",
    error: "text-rose-400",
    notice: "bg-amber-400/10 border-amber-400/30 text-amber-200",
    calcCard: "bg-zinc-950 border-white/5",
    calcRow: "border-white/5",
    marginPos: "text-emerald-300",
    marginNeg: "text-rose-300",
    itemCard: "bg-zinc-950 border-white/10",
    itemCardActive: "bg-lime-300/10 border-lime-300 ring-1 ring-lime-300/40",
  },
  white: {
    card: "bg-lime-50 border-lime-200/50",
    label: "text-lime-800",
    input:
      "bg-white border-lime-200 text-ink focus:border-lime-500 focus:outline-none",
    button: "bg-violet-600 text-white hover:bg-violet-700",
    hint: "text-zinc-500",
    error: "text-rose-600",
    notice: "bg-amber-50 border-amber-200 text-amber-800",
    calcCard: "bg-white border-lime-200/60",
    calcRow: "border-lime-200/40",
    marginPos: "text-emerald-600",
    marginNeg: "text-rose-600",
    itemCard: "bg-white border-lime-200/60",
    itemCardActive: "bg-violet-50 border-violet-500 ring-1 ring-violet-400",
  },
  indigo: {
    card: "bg-white border-zinc-200",
    label: "text-zinc-500",
    input:
      "bg-white border-zinc-300 text-zinc-900 focus:border-indigo-500 focus:outline-none",
    button: "bg-indigo-600 text-white hover:bg-indigo-700",
    hint: "text-zinc-500",
    error: "text-rose-600",
    notice: "bg-amber-50 border-amber-200 text-amber-800",
    calcCard: "bg-white border-zinc-200",
    calcRow: "border-zinc-200",
    marginPos: "text-emerald-600",
    marginNeg: "text-rose-600",
    itemCard: "bg-white border-zinc-200",
    itemCardActive: "bg-indigo-50 border-indigo-500 ring-1 ring-indigo-400",
  },
} as const;

const INITIAL: MembershipPlanState = {};

const fmt = (s: string) => (s ? Number(s).toLocaleString("en-US") : "");
const parseDigits = (s: string) => s.replace(/[^\d]/g, "");

export function ComboPlanForm({
  slug,
  tone,
  membershipPlans,
  packagePlans,
  mode = "create",
  plan,
  onSuccess,
  hideCard = false,
}: {
  slug: string;
  tone: Tone;
  membershipPlans: ComboMembershipOption[];
  packagePlans: ComboPackageOption[];
  mode?: "create" | "edit";
  plan?: ComboPlanInitial;
  onSuccess?: () => void;
  hideCard?: boolean;
}) {
  const t = useTranslations("products.combo");
  const te = useTranslations("products.combo.errors");
  const tk = TONE[tone];

  const action = mode === "edit" ? updateComboPlan : createComboPlan;
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  const [name, setName] = useState(plan?.name ?? "");
  const [membershipId, setMembershipId] = useState(plan?.membershipPlanId ?? "");
  const [packageIds, setPackageIds] = useState<Set<string>>(
    new Set(plan?.packagePlanIds ?? []),
  );
  const [price, setPrice] = useState(plan ? String(plan.pricePhp) : "0");
  const [active, setActive] = useState(plan?.active ?? true);

  useEffect(() => {
    if (!state.ok || !state.at) return;
    if (mode === "edit") {
      onSuccess?.();
    } else {
      formRef.current?.reset();
      setName("");
      setMembershipId("");
      setPackageIds(new Set());
      setPrice("0");
      setActive(true);
    }
  }, [state.ok, state.at, mode, onSuccess]);

  function errorOf(key: string): string | null {
    const arr = state.errors?.[key];
    if (!arr || arr.length === 0) return null;
    const first = arr[0]!;
    if (first === "marginNegative") return te("marginNegative");
    if (first === "items") return te("items");
    if (first === "name" || first === "Required" || first.includes("at least"))
      return te("name");
    if (key === "pricePhp") return te("price");
    return first;
  }

  function togglePackage(id: string) {
    setPackageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // 실시간 계산.
  const selectedMembership = useMemo(
    () =>
      membershipId
        ? membershipPlans.find((m) => m.id === membershipId)
        : undefined,
    [membershipId, membershipPlans],
  );
  const selectedPackages = useMemo(
    () => packagePlans.filter((p) => packageIds.has(p.id)),
    [packageIds, packagePlans],
  );

  const listPrice =
    (selectedMembership?.pricePhp ?? 0) +
    selectedPackages.reduce((sum, p) => sum + p.pricePhp, 0);
  const priceNum = Number(price) || 0;
  const discount = listPrice - priceNum;
  const payoutTotal = selectedPackages.reduce(
    (sum, p) => sum + p.servicePayoutPhp * p.sessionCount,
    0,
  );
  const margin = priceNum - payoutTotal;
  const marginNegative = priceNum > 0 && margin < 0;
  const hasItems = !!membershipId || packageIds.size > 0;

  const isEdit = mode === "edit";
  const submitLabel = isEdit ? t("editSubmit") : t("submit");
  const submittingLabel = isEdit ? t("editSubmitting") : t("submitting");
  const wrapperClass = hideCard ? "" : `rounded-2xl border p-6 ${tk.card}`;

  const peso = (n: number) => `₱${n.toLocaleString()}`;

  return (
    <section className={wrapperClass}>
      {!hideCard && (
        <h2 className="font-semibold text-lg tracking-tight">{t("heading")}</h2>
      )}

      <form
        ref={formRef}
        action={formAction}
        className={hideCard ? "space-y-5" : "mt-5 space-y-5"}
      >
        <input type="hidden" name="slug" value={slug} />
        {isEdit && plan && (
          <input type="hidden" name="planId" value={plan.id} />
        )}
        <input
          type="hidden"
          name="packagePlanIds"
          value={JSON.stringify(Array.from(packageIds))}
        />

        <div>
          <label
            className={`text-xs font-medium uppercase tracking-wider ${tk.label}`}
          >
            {t("name")}
          </label>
          <input
            name="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm transition ${tk.input}`}
          />
          {errorOf("name") && (
            <p className={`mt-1 text-xs ${tk.error}`}>{errorOf("name")}</p>
          )}
        </div>

        <div>
          <label
            className={`text-xs font-medium uppercase tracking-wider ${tk.label}`}
          >
            {t("membership")}
          </label>
          <select
            name="membershipPlanId"
            value={membershipId}
            onChange={(e) => setMembershipId(e.target.value)}
            className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm transition ${tk.input}`}
          >
            <option value="">{t("membershipNone")}</option>
            {membershipPlans
              .filter((m) => m.active || m.id === plan?.membershipPlanId)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.durationDays}일 · {peso(m.pricePhp)}
                </option>
              ))}
          </select>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label
              className={`text-xs font-medium uppercase tracking-wider ${tk.label}`}
            >
              {t("packages")}
            </label>
            <span className={`text-xs ${tk.hint}`}>{t("packagesHint")}</span>
          </div>
          {packagePlans.length === 0 ? (
            <div
              className={`mt-2 rounded-md border px-3 py-2 text-sm ${tk.notice}`}
            >
              {t("packagesEmpty")}
            </div>
          ) : (
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {packagePlans
                .filter((p) => p.active || packageIds.has(p.id))
                .map((p) => {
                  const isOn = packageIds.has(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`flex cursor-pointer flex-col gap-1 rounded-lg border px-3 py-3 text-sm transition ${
                        isOn ? tk.itemCardActive : tk.itemCard
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isOn}
                            onChange={() => togglePackage(p.id)}
                            className="h-4 w-4 accent-indigo-600"
                          />
                          <span className="font-medium">{p.name}</span>
                        </span>
                        <span className="tabular-nums">{peso(p.pricePhp)}</span>
                      </span>
                      <span className={`pl-6 text-[11px] ${tk.hint}`}>
                        {p.serviceName} · {p.sessionCount}회
                      </span>
                    </label>
                  );
                })}
            </div>
          )}
          {errorOf("items") && (
            <p className={`mt-1 text-xs ${tk.error}`}>{errorOf("items")}</p>
          )}
        </div>

        <div>
          <label
            className={`text-xs font-medium uppercase tracking-wider ${tk.label}`}
          >
            {t("price")}
          </label>
          <div className="mt-2 flex items-center gap-2">
            <span className={`text-sm ${tk.hint}`}>{t("priceUnit")}</span>
            <input
              name="pricePhp"
              type="text"
              inputMode="numeric"
              required
              value={fmt(price)}
              onChange={(e) => setPrice(parseDigits(e.target.value))}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${tk.input}`}
            />
          </div>
          {errorOf("pricePhp") && (
            <p className={`mt-1 text-xs ${tk.error}`}>{errorOf("pricePhp")}</p>
          )}
        </div>

        {/* 실시간 계산 — 정상가/할인/트레이너 지급/사장 마진 4분할 */}
        {hasItems && (
          <div className={`rounded-xl border p-4 text-sm ${tk.calcCard}`}>
            <div
              className={`grid grid-cols-2 gap-3 border-b pb-3 sm:grid-cols-4 ${tk.calcRow}`}
            >
              <Calc label={t("calcListPrice")} value={peso(listPrice)} tk={tk} />
              <Calc
                label={t("calcDiscount")}
                value={discount > 0 ? `-${peso(discount)}` : "—"}
                valueClass={discount > 0 ? "text-rose-600" : ""}
                tk={tk}
              />
              <Calc
                label={t("calcPayout")}
                value={peso(payoutTotal)}
                hint={t("calcPayoutHint")}
                tk={tk}
              />
              <Calc
                label={t("calcMargin")}
                value={peso(margin)}
                valueClass={margin >= 0 ? tk.marginPos : tk.marginNeg}
                tk={tk}
              />
            </div>
            {marginNegative && (
              <p className={`mt-3 text-xs font-medium ${tk.error}`}>
                {t("marginNegativeError")}
              </p>
            )}
          </div>
        )}

        {isEdit && (
          <div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="active"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 accent-indigo-600"
              />
              <span className={tk.label}>{t("active")}</span>
            </label>
          </div>
        )}

        {state.errors?._global && (
          <p className={`text-sm ${tk.error}`}>{te("permission")}</p>
        )}

        <button
          type="submit"
          disabled={pending || !hasItems || marginNegative}
          className={`rounded-lg px-5 py-2.5 text-sm font-medium transition disabled:opacity-50 ${tk.button}`}
        >
          {pending ? submittingLabel : submitLabel}
        </button>
      </form>
    </section>
  );
}

function Calc({
  label,
  value,
  hint,
  valueClass = "",
  tk,
}: {
  label: string;
  value: string;
  hint?: string;
  valueClass?: string;
  tk: (typeof TONE)[Tone];
}) {
  return (
    <div>
      <div
        className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${tk.label}`}
      >
        {label}
      </div>
      <div
        className={`mt-1 font-mono text-base tabular-nums font-medium ${valueClass}`}
      >
        {value}
      </div>
      {hint && (
        <div className={`mt-0.5 text-[10px] leading-tight ${tk.hint}`}>
          {hint}
        </div>
      )}
    </div>
  );
}
