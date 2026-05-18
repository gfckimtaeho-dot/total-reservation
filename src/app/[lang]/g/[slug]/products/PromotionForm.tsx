"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { NativePickerInput } from "@/components/NativePickerInput";
import {
  createPromotion,
  updatePromotion,
  type MembershipPlanState,
} from "./actions";

type Tone = "normal" | "black" | "white";

type Scope =
  | "ALL"
  | "MEMBERSHIP_ONLY"
  | "PACKAGE_ONLY"
  | "SPECIFIC_MEMBERSHIP"
  | "SPECIFIC_PACKAGE";

type DiscountType = "PERCENT" | "FIXED";

export type PromotionTargetOption = {
  id: string;
  name: string;
  pricePhp: number;
};

export type PromotionInitial = {
  id: string;
  name: string;
  scope: Scope;
  targetId: string | null;
  discountType: DiscountType;
  discountValue: number;
  startsAt: string;
  endsAt: string;
  active: boolean;
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
    preview: "bg-white border-amber-200/60",
    previewRow: "border-amber-200/40",
    scopePill: "bg-white text-ink/70 border-ink/15 hover:bg-ink/5",
    scopePillActive: "bg-ink text-white border-ink",
    typeBtn: "bg-white text-ink/70 border-ink/15 hover:bg-ink/5",
    typeBtnActive: "bg-ink text-white border-ink",
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
    preview: "bg-zinc-950 border-white/5",
    previewRow: "border-white/5",
    scopePill: "bg-zinc-950 text-zinc-400 border-white/10 hover:bg-white/5",
    scopePillActive: "bg-lime-300 text-zinc-950 border-lime-300",
    typeBtn: "bg-zinc-950 text-zinc-400 border-white/10 hover:bg-white/5",
    typeBtnActive: "bg-lime-300 text-zinc-950 border-lime-300",
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
    preview: "bg-white border-lime-200/60",
    previewRow: "border-lime-200/40",
    scopePill: "bg-white text-zinc-700 border-lime-200 hover:bg-lime-100",
    scopePillActive: "bg-lime-600 text-white border-lime-600",
    typeBtn: "bg-white text-zinc-700 border-lime-200 hover:bg-lime-100",
    typeBtnActive: "bg-lime-600 text-white border-lime-600",
  },
} as const;

const SCOPES: Scope[] = [
  "ALL",
  "MEMBERSHIP_ONLY",
  "PACKAGE_ONLY",
  "SPECIFIC_MEMBERSHIP",
  "SPECIFIC_PACKAGE",
];

const INITIAL: MembershipPlanState = {};

const fmt = (s: string) => (s ? Number(s).toLocaleString("en-US") : "");
const parseDigits = (s: string) => s.replace(/[^\d]/g, "");

function applyDiscount(
  basePrice: number,
  discountType: DiscountType,
  discountValue: number,
): number {
  if (discountType === "PERCENT") {
    return Math.max(0, Math.round(basePrice * (1 - discountValue / 100)));
  }
  return Math.max(0, basePrice - discountValue);
}

// 이벤트 기간은 날짜 단위. ISO string에서 날짜 부분(YYYY-MM-DD)만 잘라 씀.
// 기간 경계는 UTC 고정(00:00:00Z ~ 23:59:59.999Z, actions.ts)이라
// slice가 TZ 무관하게 정확 — 편집 시 날짜 drift 없음.
function toDateInput(iso: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function PromotionForm({
  slug,
  tone,
  membershipPlans,
  packagePlans,
  lang = "ko",
  mode = "create",
  promotion,
  onSuccess,
  hideCard = false,
}: {
  slug: string;
  tone: Tone;
  membershipPlans: PromotionTargetOption[];
  packagePlans: PromotionTargetOption[];
  lang?: string;
  mode?: "create" | "edit";
  promotion?: PromotionInitial;
  onSuccess?: () => void;
  hideCard?: boolean;
}) {
  const t = useTranslations("products.promotion");
  const te = useTranslations("products.promotion.errors");
  const tk = TONE[tone];

  const action = mode === "edit" ? updatePromotion : createPromotion;
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  // 기본값: 이름·범위·할인. 시작은 오늘, 종료는 30일 후 (UX 친화 기본값).
  const todayLocal = toDateInput(new Date().toISOString());
  const monthLater = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return toDateInput(d.toISOString());
  })();

  const [name, setName] = useState(promotion?.name ?? "");
  const [scope, setScope] = useState<Scope>(promotion?.scope ?? "ALL");
  const [targetId, setTargetId] = useState(promotion?.targetId ?? "");
  const [discountType, setDiscountType] = useState<DiscountType>(
    promotion?.discountType ?? "PERCENT",
  );
  const [discountValue, setDiscountValue] = useState(
    promotion ? String(promotion.discountValue) : "10",
  );
  const [startsAt, setStartsAt] = useState(
    promotion?.startsAt ? toDateInput(promotion.startsAt) : todayLocal,
  );
  const [endsAt, setEndsAt] = useState(
    promotion?.endsAt ? toDateInput(promotion.endsAt) : monthLater,
  );
  const [active, setActive] = useState(promotion?.active ?? true);

  useEffect(() => {
    if (!state.ok || !state.at) return;
    if (mode === "edit") {
      onSuccess?.();
    } else {
      formRef.current?.reset();
      setName("");
      setScope("ALL");
      setTargetId("");
      setDiscountType("PERCENT");
      setDiscountValue("10");
      setStartsAt(todayLocal);
      setEndsAt(monthLater);
      setActive(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.at, mode, onSuccess]);

  function errorOf(key: string): string | null {
    const arr = state.errors?.[key];
    if (!arr || arr.length === 0) return null;
    const first = arr[0]!;
    if (first === "target") return te("target");
    if (first === "period") return te("period");
    if (first === "discountPercent") return te("discountPercent");
    if (first === "name" || first === "Required" || first.includes("at least"))
      return te("name");
    if (key === "discountValue") return te("discount");
    return first;
  }

  const showTargetSelect =
    scope === "SPECIFIC_MEMBERSHIP" || scope === "SPECIFIC_PACKAGE";
  const targetOptions =
    scope === "SPECIFIC_MEMBERSHIP" ? membershipPlans : packagePlans;

  // 미리보기: scope에 따라 적용 대상 plan 목록 + 할인 적용 가격 표시.
  const previewItems = useMemo(() => {
    const valueNum = Number(discountValue) || 0;
    let items: { label: string; price: number }[] = [];
    if (scope === "ALL") {
      items = [
        ...membershipPlans.map((m) => ({ label: m.name, price: m.pricePhp })),
        ...packagePlans.map((p) => ({ label: p.name, price: p.pricePhp })),
      ];
    } else if (scope === "MEMBERSHIP_ONLY") {
      items = membershipPlans.map((m) => ({ label: m.name, price: m.pricePhp }));
    } else if (scope === "PACKAGE_ONLY") {
      items = packagePlans.map((p) => ({ label: p.name, price: p.pricePhp }));
    } else if (scope === "SPECIFIC_MEMBERSHIP") {
      const m = membershipPlans.find((x) => x.id === targetId);
      if (m) items = [{ label: m.name, price: m.pricePhp }];
    } else if (scope === "SPECIFIC_PACKAGE") {
      const p = packagePlans.find((x) => x.id === targetId);
      if (p) items = [{ label: p.name, price: p.pricePhp }];
    }
    return items.map((i) => ({
      ...i,
      after: applyDiscount(i.price, discountType, valueNum),
    }));
  }, [scope, targetId, discountType, discountValue, membershipPlans, packagePlans]);

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
        {isEdit && promotion && (
          <input type="hidden" name="promotionId" value={promotion.id} />
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
            {t("scopeLabel")}
          </label>
          <input type="hidden" name="scope" value={scope} />
          <div className="mt-2 flex flex-wrap gap-2">
            {SCOPES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setScope(s);
                  if (s !== "SPECIFIC_MEMBERSHIP" && s !== "SPECIFIC_PACKAGE") {
                    setTargetId("");
                  }
                }}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                  scope === s ? tk.scopePillActive : tk.scopePill
                }`}
              >
                {t(`scope.${s}`)}
              </button>
            ))}
          </div>
        </div>

        {showTargetSelect && (
          <div>
            <label
              className={`text-xs font-medium uppercase tracking-wider ${tk.label}`}
            >
              {t("targetLabel")}
            </label>
            <select
              name="targetId"
              required
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm transition ${tk.input}`}
            >
              <option value="">{t("targetPlaceholder")}</option>
              {targetOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} · {peso(o.pricePhp)}
                </option>
              ))}
            </select>
            {errorOf("targetId") && (
              <p className={`mt-1 text-xs ${tk.error}`}>
                {errorOf("targetId")}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label
              className={`text-xs font-medium uppercase tracking-wider ${tk.label}`}
            >
              {t("discountTypeLabel")}
            </label>
            <input type="hidden" name="discountType" value={discountType} />
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["PERCENT", "FIXED"] as const).map((dt) => (
                <button
                  key={dt}
                  type="button"
                  onClick={() => setDiscountType(dt)}
                  className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                    discountType === dt ? tk.typeBtnActive : tk.typeBtn
                  }`}
                >
                  {t(`discountType.${dt}`)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label
              className={`text-xs font-medium uppercase tracking-wider ${tk.label}`}
            >
              {t("discountValueLabel")}
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                name="discountValue"
                type="text"
                inputMode="numeric"
                required
                value={fmt(discountValue)}
                onChange={(e) => setDiscountValue(parseDigits(e.target.value))}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${tk.input}`}
              />
              <span className={`text-sm ${tk.hint}`}>
                {discountType === "PERCENT" ? "%" : "₱"}
              </span>
            </div>
            {errorOf("discountValue") && (
              <p className={`mt-1 text-xs ${tk.error}`}>
                {errorOf("discountValue")}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label
              className={`text-xs font-medium uppercase tracking-wider ${tk.label}`}
            >
              {t("startsAt")}
            </label>
            <NativePickerInput
              type="date"
              lang={lang}
              name="startsAt"
              required
              value={startsAt}
              onChange={(e) => setStartsAt(e.currentTarget.value)}
              className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm transition ${tk.input}`}
            />
            {errorOf("startsAt") && (
              <p className={`mt-1 text-xs ${tk.error}`}>{errorOf("startsAt")}</p>
            )}
          </div>
          <div>
            <label
              className={`text-xs font-medium uppercase tracking-wider ${tk.label}`}
            >
              {t("endsAt")}
            </label>
            <NativePickerInput
              type="date"
              lang={lang}
              name="endsAt"
              required
              value={endsAt}
              onChange={(e) => setEndsAt(e.currentTarget.value)}
              className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm transition ${tk.input}`}
            />
            {errorOf("endsAt") && (
              <p className={`mt-1 text-xs ${tk.error}`}>{errorOf("endsAt")}</p>
            )}
          </div>
        </div>

        {/* 콤보 주의 */}
        <div className={`rounded-md border px-3 py-2 text-xs ${tk.notice}`}>
          {t("noteCombo")}
        </div>

        {/* 적용 미리보기 — 사장이 즉시 어느 상품에 어떻게 적용될지 확인 */}
        <div className={`rounded-xl border p-4 ${tk.preview}`}>
          <div
            className={`flex items-center justify-between border-b pb-2 ${tk.previewRow}`}
          >
            <h3 className={`text-sm font-medium ${tk.label}`}>
              {t("previewHeading")}
            </h3>
            <span className="text-xs">
              {previewItems.length === 0
                ? t("previewEmpty")
                : `${previewItems.length}`}
            </span>
          </div>
          {previewItems.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-sm">
              {previewItems.map((item, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 tabular-nums"
                >
                  <span className="truncate font-medium">{item.label}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-zinc-500 line-through">
                      {peso(item.price)}
                    </span>
                    <span className={tk.hint}>{t("previewArrow")}</span>
                    <span className={`font-medium ${tk.label}`}>
                      {peso(item.after)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
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
