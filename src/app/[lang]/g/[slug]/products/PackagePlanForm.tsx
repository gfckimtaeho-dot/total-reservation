"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslations } from "next-intl";
import {
  createPackagePlan,
  updatePackagePlan,
  type MembershipPlanState,
} from "./actions";

type Tone = "normal" | "black" | "white";

export type PackageServiceOption = {
  id: string;
  name: string;
  pricePhp: number;
  payoutPhp: number;
  capacity: number;
};

export type PackagePlanInitial = {
  id: string;
  name: string;
  serviceId: string;
  sessionCount: number;
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
    calcCard: "bg-white border-amber-200/60",
    calcRow: "border-amber-200/40",
    marginPos: "text-emerald-700",
    marginNeg: "text-rose-600",
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
    calcCard: "bg-zinc-950 border-white/5",
    calcRow: "border-white/5",
    marginPos: "text-emerald-300",
    marginNeg: "text-rose-300",
  },
  white: {
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
    calcCard: "bg-white border-lime-200/60",
    calcRow: "border-lime-200/40",
    marginPos: "text-emerald-600",
    marginNeg: "text-rose-600",
  },
} as const;

const SESSION_PRESETS = [5, 10, 20] as const;
const DISCOUNT_PRESETS = [5, 10, 15, 20, 30] as const;

const INITIAL: MembershipPlanState = {};

const fmt = (s: string) => (s ? Number(s).toLocaleString("en-US") : "");
const parseDigits = (s: string) => s.replace(/[^\d]/g, "");

export function PackagePlanForm({
  slug,
  tone,
  services,
  mode = "create",
  plan,
  onSuccess,
  hideCard = false,
}: {
  slug: string;
  tone: Tone;
  services: PackageServiceOption[];
  mode?: "create" | "edit";
  plan?: PackagePlanInitial;
  onSuccess?: () => void;
  hideCard?: boolean;
}) {
  const t = useTranslations("products.package");
  const te = useTranslations("products.package.errors");
  const tk = TONE[tone];

  const action = mode === "edit" ? updatePackagePlan : createPackagePlan;
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  const initialServiceId = plan?.serviceId ?? services[0]?.id ?? "";
  const initialSessions = plan ? String(plan.sessionCount) : "5";
  const initialPrice = plan ? String(plan.pricePhp) : "0";
  const initialActive = plan?.active ?? true;

  const [serviceId, setServiceId] = useState(initialServiceId);
  const [sessions, setSessions] = useState(initialSessions);
  const [price, setPrice] = useState(initialPrice);
  const [active, setActive] = useState(initialActive);
  const [name, setName] = useState(plan?.name ?? "");

  useEffect(() => {
    if (!state.ok || !state.at) return;
    if (mode === "edit") {
      onSuccess?.();
    } else {
      formRef.current?.reset();
      setName("");
      setServiceId(services[0]?.id ?? "");
      setSessions("5");
      setPrice("0");
      setActive(true);
    }
  }, [state.ok, state.at, mode, onSuccess, services]);

  function errorOf(key: string): string | null {
    const arr = state.errors?.[key];
    if (!arr || arr.length === 0) return null;
    const first = arr[0]!;
    if (first === "marginNegative") return te("marginNegative");
    if (first === "name" || first === "Required" || first.includes("at least"))
      return te("name");
    if (key === "sessionCount") return te("sessions");
    if (key === "pricePhp") return te("price");
    if (key === "serviceId" || first === "service") return te("service");
    return first;
  }

  const selectedService = useMemo(
    () => services.find((s) => s.id === serviceId),
    [services, serviceId],
  );

  // 실시간 계산 — 트레이너 지급은 service.payoutPhp × 회수, 마진은 가격 − 지급.
  const sessionsNum = Number(sessions) || 0;
  const priceNum = Number(price) || 0;
  const payoutPerSession = selectedService?.payoutPhp ?? 0;
  const payoutTotal = payoutPerSession * sessionsNum;
  const perSessionPrice = sessionsNum > 0 ? Math.round(priceNum / sessionsNum) : 0;
  const margin = priceNum - payoutTotal;
  const marginNegative = priceNum > 0 && margin < 0;

  // 정가(listPrice) = 서비스 단가 × 회수. 할인 preset과 비교 기준점.
  // 사용자가 마음대로 입력 가능하지만 정가를 보면서 할인율을 직관적으로 결정.
  const listPrice = (selectedService?.pricePhp ?? 0) * sessionsNum;
  const currentDiscountPct =
    listPrice > 0 && priceNum < listPrice
      ? Math.round((1 - priceNum / listPrice) * 100)
      : 0;
  const currentDiscountAmount = Math.max(0, listPrice - priceNum);

  // 서비스 변경 시 가격을 새 정가로 reset — 사용자가 다른 서비스를 골랐다는 건
  // 가격 시작점도 다르다는 의미. 회수만 바꿀 땐 reset 안 함(할인율 보호).
  // 첫 mount는 skip — edit 모드의 기존 가격을 덮어쓰지 않게.
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (listPrice > 0) {
      setPrice(String(listPrice));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  function applyDiscountPreset(pct: number) {
    if (listPrice <= 0) return;
    setPrice(String(Math.round(listPrice * (1 - pct / 100))));
  }

  const isEdit = mode === "edit";
  const submitLabel = isEdit ? t("editSubmit") : t("submit");
  const submittingLabel = isEdit ? t("editSubmitting") : t("submitting");
  const wrapperClass = hideCard ? "" : `rounded-2xl border p-6 ${tk.card}`;

  const peso = (n: number) => `₱${n.toLocaleString()}`;

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

        {services.length === 0 && (
          <div
            className={`rounded-md border px-3 py-2 text-sm ${tk.notice}`}
          >
            {t("noServices")}
          </div>
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
            {t("service")}
          </label>
          <select
            name="serviceId"
            required
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            disabled={services.length === 0}
            className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm transition disabled:opacity-50 ${tk.input}`}
          >
            <option value="" disabled>
              {t("servicePlaceholder")}
            </option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {peso(s.pricePhp)} / {peso(s.payoutPhp)} payout
              </option>
            ))}
          </select>
          {errorOf("serviceId") && (
            <p className={`mt-1 text-xs ${tk.error}`}>{errorOf("serviceId")}</p>
          )}
        </div>

        <div>
          <label
            className={`text-xs font-medium uppercase tracking-wider ${tk.label}`}
          >
            {t("sessions")}
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {SESSION_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setSessions(String(p))}
                className={`rounded-md border px-3 py-1.5 text-sm transition ${
                  sessions === String(p) ? tk.presetActive : tk.preset
                }`}
              >
                {p}
                {t("sessionUnit")}
              </button>
            ))}
            <input
              name="sessionCount"
              type="text"
              inputMode="numeric"
              required
              value={fmt(sessions)}
              onChange={(e) => setSessions(parseDigits(e.target.value))}
              className={`w-24 rounded-lg border px-3 py-1.5 text-sm transition ${tk.input}`}
            />
            <span className={`text-sm ${tk.hint}`}>{t("sessionUnit")}</span>
          </div>
          {errorOf("sessionCount") && (
            <p className={`mt-1 text-xs ${tk.error}`}>
              {errorOf("sessionCount")}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-2">
            <label
              className={`text-xs font-medium uppercase tracking-wider ${tk.label}`}
            >
              {t("price")}
            </label>
            {listPrice > 0 && (
              <span className={`text-xs tabular-nums ${tk.hint}`}>
                {t("listPriceLabel")}{" "}
                <span className="font-medium text-zinc-700">
                  ₱{listPrice.toLocaleString()}
                </span>
                <span className="ml-1 text-[10px]">
                  ({t("listPriceFormula")})
                </span>
              </span>
            )}
          </div>

          {/* 할인 빠른 선택 — 정가에서 자동 계산. 사장이 영업 즉석에서 사용. */}
          {listPrice > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className={`text-[10px] uppercase tracking-wider ${tk.hint}`}>
                {t("discountQuickPick")}
              </span>
              {DISCOUNT_PRESETS.map((pct) => {
                const isActive = currentDiscountPct === pct;
                return (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => applyDiscountPreset(pct)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                      isActive ? tk.presetActive : tk.preset
                    }`}
                  >
                    {pct}%
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setPrice(String(listPrice))}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                  currentDiscountPct === 0 ? tk.presetActive : tk.preset
                }`}
              >
                {t("noDiscount")}
              </button>
            </div>
          )}

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

          {/* 현재 할인율 자동 표시 — 입력값이 정가 미만이면 자동 계산 */}
          {currentDiscountPct > 0 && (
            <p className="mt-1.5 text-xs font-medium text-rose-600">
              {t("currentDiscount", {
                pct: currentDiscountPct,
                amount: `₱${currentDiscountAmount.toLocaleString()}`,
              })}
            </p>
          )}
          {errorOf("pricePhp") && (
            <p className={`mt-1 text-xs ${tk.error}`}>{errorOf("pricePhp")}</p>
          )}
        </div>

        {/* 실시간 계산 카드 — 사장이 가격 입력 시 즉시 마진 확인 */}
        {selectedService && sessionsNum > 0 && (
          <div
            className={`rounded-xl border p-4 text-sm ${tk.calcCard}`}
          >
            <div
              className={`grid grid-cols-3 gap-3 border-b pb-3 ${tk.calcRow}`}
            >
              <Calc label={t("calcPerSession")} value={peso(perSessionPrice)} tk={tk} />
              <Calc
                label={t("calcPayout")}
                value={peso(payoutTotal)}
                hint={t("calcPayoutHint")}
                tk={tk}
              />
              <Calc
                label={t("calcMargin")}
                value={peso(margin)}
                valueClass={
                  margin >= 0 ? tk.marginPos : tk.marginNeg
                }
                tk={tk}
              />
            </div>
            {marginNegative && (
              <p className={`mt-3 text-xs font-medium ${tk.error}`}>
                {t("marginNegativeWarning")}
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
                className="h-4 w-4 accent-violet-600"
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
          disabled={pending || services.length === 0}
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
      <div className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${tk.label}`}>
        {label}
      </div>
      <div className={`mt-1 font-mono text-base tabular-nums font-medium ${valueClass}`}>
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
