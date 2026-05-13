"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  createMembershipPlan,
  updateMembershipPlan,
  type MembershipPlanState,
} from "./actions";

type Tone = "normal" | "black" | "white";

export type MembershipPlanInitial = {
  id: string;
  name: string;
  durationDays: number;
  pricePhp: number;
  active: boolean;
};

const TONE = {
  normal: {
    card: "bg-white/80 border-amber-200/60",
    label: "text-ink/70",
    input:
      "bg-white border-ink/15 text-ink focus:border-ink focus:outline-none",
    button: "bg-ink text-white hover:bg-ink/90",
    preset: "bg-white text-ink/70 border-ink/15 hover:bg-ink/5",
    presetActive: "bg-ink text-white border-ink",
    hint: "text-ink/50",
    error: "text-rose-600",
    notice: "bg-amber-50 border-amber-200 text-amber-800",
  },
  black: {
    card: "bg-zinc-900 border-white/5",
    label: "text-zinc-400",
    input:
      "bg-zinc-950 border-white/10 text-white focus:border-lime-300 focus:outline-none",
    button: "bg-lime-300 text-zinc-950 hover:bg-lime-200",
    preset: "bg-zinc-950 text-zinc-400 border-white/10 hover:bg-white/5",
    presetActive: "bg-lime-300 text-zinc-950 border-lime-300",
    hint: "text-zinc-500",
    error: "text-rose-400",
    notice: "bg-amber-400/10 border-amber-400/30 text-amber-200",
  },
  white: {
    // Dashboard White Pastel과 통일 — 등록 폼은 lime 섹션. /services와 동일 패턴.
    card: "bg-lime-50 border-lime-200/50",
    label: "text-lime-800",
    input:
      "bg-white border-lime-200 text-ink focus:border-lime-500 focus:outline-none",
    button: "bg-violet-600 text-white hover:bg-violet-700",
    preset: "bg-white text-zinc-700 border-lime-200 hover:bg-lime-100",
    presetActive: "bg-lime-600 text-white border-lime-600",
    hint: "text-zinc-500",
    error: "text-rose-600",
    notice: "bg-amber-50 border-amber-200 text-amber-800",
  },
} as const;

// 헬스장 표준 회원권 기간 — 3/6/12개월. preset으로 빠른 입력.
const DURATION_PRESETS = [
  { days: 90, key: "durationPreset3m" },
  { days: 180, key: "durationPreset6m" },
  { days: 365, key: "durationPreset12m" },
] as const;

const INITIAL: MembershipPlanState = {};

const fmt = (s: string) => (s ? Number(s).toLocaleString("en-US") : "");
const parseDigits = (s: string) => s.replace(/[^\d]/g, "");

export function MembershipPlanForm({
  slug,
  tone,
  mode = "create",
  plan,
  onSuccess,
  hideCard = false,
}: {
  slug: string;
  tone: Tone;
  mode?: "create" | "edit";
  plan?: MembershipPlanInitial;
  onSuccess?: () => void;
  hideCard?: boolean;
}) {
  const t = useTranslations("products.membership");
  const te = useTranslations("products.membership.errors");
  const tk = TONE[tone];

  const action = mode === "edit" ? updateMembershipPlan : createMembershipPlan;
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  const initialName = plan?.name ?? "";
  const initialDuration = plan ? String(plan.durationDays) : "90";
  const initialPrice = plan ? String(plan.pricePhp) : "0";
  const initialActive = plan?.active ?? true;

  const [name, setName] = useState(initialName);
  const [duration, setDuration] = useState(initialDuration);
  const [price, setPrice] = useState(initialPrice);
  const [active, setActive] = useState(initialActive);

  useEffect(() => {
    if (!state.ok || !state.at) return;
    if (mode === "edit") {
      onSuccess?.();
    } else {
      formRef.current?.reset();
      setName("");
      setDuration("90");
      setPrice("0");
      setActive(true);
    }
  }, [state.ok, state.at, mode, onSuccess]);

  function errorOf(key: string): string | null {
    const arr = state.errors?.[key];
    if (!arr || arr.length === 0) return null;
    const first = arr[0]!;
    if (first === "name" || first === "Required" || first.includes("at least"))
      return te("name");
    if (key === "durationDays") return te("duration");
    if (key === "pricePhp") return te("price");
    return first;
  }

  const isEdit = mode === "edit";
  const submitLabel = isEdit ? t("editSubmit") : t("submit");
  const submittingLabel = isEdit ? t("editSubmitting") : t("submitting");

  const wrapperClass = hideCard ? "" : `rounded-2xl border p-6 ${tk.card}`;

  return (
    <section className={wrapperClass}>
      {!hideCard && (
        <h2 className="font-heading text-lg tracking-tight">{t("heading")}</h2>
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
            {t("duration")}
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {DURATION_PRESETS.map((p) => (
              <button
                key={p.days}
                type="button"
                onClick={() => setDuration(String(p.days))}
                className={`rounded-md border px-3 py-1.5 text-sm transition ${
                  duration === String(p.days) ? tk.presetActive : tk.preset
                }`}
              >
                {t(p.key)}
              </button>
            ))}
            <input
              name="durationDays"
              type="text"
              inputMode="numeric"
              required
              value={fmt(duration)}
              onChange={(e) => setDuration(parseDigits(e.target.value))}
              className={`w-24 rounded-lg border px-3 py-1.5 text-sm transition ${tk.input}`}
            />
            <span className={`text-sm ${tk.hint}`}>{t("durationUnit")}</span>
          </div>
          {errorOf("durationDays") && (
            <p className={`mt-1 text-xs ${tk.error}`}>
              {errorOf("durationDays")}
            </p>
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

        {isEdit && (
          <div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="active"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 accent-violet-600"
              />
              <span className={tk.label}>{t("active")}</span>
            </label>
          </div>
        )}

        {isEdit && (
          <div
            className={`rounded-md border px-3 py-2 text-xs ${tk.notice}`}
          >
            {t("priceChangeNotice")}
          </div>
        )}

        {state.errors?._global && (
          <p className={`text-sm ${tk.error}`}>{te("permission")}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className={`rounded-lg px-5 py-2.5 text-sm font-medium transition disabled:opacity-50 ${tk.button}`}
        >
          {pending ? submittingLabel : submitLabel}
        </button>
      </form>
    </section>
  );
}
