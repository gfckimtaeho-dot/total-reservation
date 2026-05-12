"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  createService,
  updateService,
  type CreateServiceState,
  type UpdateServiceState,
} from "./actions";

type Tone = "normal" | "black" | "white";

export type ServiceInitial = {
  id: string;
  name: string;
  capacity: number;
  durationMin: number;
  pricePhp: number;
  payoutPhp: number;
};

const TONE = {
  normal: {
    card: "bg-white/80 border-amber-200/60",
    label: "text-ink/70",
    input:
      "bg-white border-ink/15 text-ink focus:border-ink focus:outline-none",
    inputDisabled: "bg-ink/5 text-ink/40 border-ink/10 cursor-not-allowed",
    button: "bg-ink text-white hover:bg-ink/90",
    radioActive: "bg-ink text-white border-ink",
    radioInactive: "bg-white text-ink/70 border-ink/15 hover:bg-ink/5",
    preset: "bg-white text-ink/70 border-ink/15 hover:bg-ink/5",
    presetActive: "bg-ink text-white border-ink",
    hint: "text-ink/50",
    error: "text-rose-600",
  },
  black: {
    card: "bg-zinc-900 border-white/5",
    label: "text-zinc-400",
    input:
      "bg-zinc-950 border-white/10 text-white focus:border-lime-300 focus:outline-none",
    inputDisabled: "bg-zinc-950 text-zinc-600 border-white/5 cursor-not-allowed",
    button: "bg-lime-300 text-zinc-950 hover:bg-lime-200",
    radioActive: "bg-lime-300 text-zinc-950 border-lime-300",
    radioInactive:
      "bg-zinc-950 text-zinc-400 border-white/10 hover:bg-white/5",
    preset: "bg-zinc-950 text-zinc-400 border-white/10 hover:bg-white/5",
    presetActive: "bg-lime-300 text-zinc-950 border-lime-300",
    hint: "text-zinc-500",
    error: "text-rose-400",
  },
  white: {
    card: "bg-white border-violet-100",
    label: "text-violet-700",
    input:
      "bg-white border-violet-200 text-ink focus:border-violet-500 focus:outline-none",
    inputDisabled:
      "bg-zinc-50 text-zinc-400 border-zinc-100 cursor-not-allowed",
    button: "bg-violet-600 text-white hover:bg-violet-700",
    radioActive: "bg-violet-600 text-white border-violet-600",
    radioInactive:
      "bg-white text-zinc-700 border-violet-200 hover:bg-violet-50",
    preset: "bg-white text-zinc-700 border-violet-200 hover:bg-violet-50",
    presetActive: "bg-violet-600 text-white border-violet-600",
    hint: "text-zinc-500",
    error: "text-rose-600",
  },
} as const;

// 현장 운영 노하우: 60분 슬롯은 다음 손님과의 전환 시간이 없어 강사가
// 정리할 틈도 없이 들어가야 함. 50/80/110 — 1시간/1.5시간/2시간에서
// 10분씩 빼서 자연스러운 쉬는 시간을 확보.
const DURATION_PRESETS = [50, 80, 110];

const INITIAL: CreateServiceState | UpdateServiceState = {};

const fmt = (s: string) => (s ? Number(s).toLocaleString("en-US") : "");
const parseDigits = (s: string) => s.replace(/[^\d]/g, "");

export function ServiceForm({
  slug,
  tone,
  mode = "create",
  service,
  onSuccess,
  hideCard = false,
}: {
  slug: string;
  tone: Tone;
  mode?: "create" | "edit";
  service?: ServiceInitial;
  onSuccess?: () => void;
  hideCard?: boolean;
}) {
  const t = useTranslations("services.form");
  const te = useTranslations("services.errors");
  const tk = TONE[tone];

  const action = mode === "edit" ? updateService : createService;
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  const initialType: "personal" | "group" = service
    ? service.capacity === 1
      ? "personal"
      : "group"
    : "personal";
  const initialDuration = service?.durationMin
    ? String(service.durationMin)
    : "50";
  const initialCapacity = service ? String(service.capacity) : "1";
  const initialPrice = service ? String(service.pricePhp) : "0";
  const initialPayout = service ? String(service.payoutPhp) : "0";

  const [type, setType] = useState<"personal" | "group">(initialType);
  const [duration, setDuration] = useState<string>(initialDuration);
  const [capacity, setCapacity] = useState<string>(initialCapacity);
  const [price, setPrice] = useState<string>(initialPrice);
  const [payout, setPayout] = useState<string>(initialPayout);

  useEffect(() => {
    if (!state.ok || !state.at) return;
    if (mode === "edit") {
      onSuccess?.();
    } else {
      formRef.current?.reset();
      setType("personal");
      setDuration("50");
      setCapacity("1");
      setPrice("0");
      setPayout("0");
    }
  }, [state.ok, state.at, mode, onSuccess]);

  // type 전환 시 capacity 기본값 갱신은 **신규 등록 모드에서만**.
  // 수정 모드에선 사용자가 기존 정원을 유지하려는 의도일 수 있어 reset 금지.
  useEffect(() => {
    if (mode === "edit") return;
    setCapacity(type === "personal" ? "1" : "5");
  }, [type, mode]);

  function errorOf(key: string): string | null {
    const arr = state.errors?.[key];
    if (!arr || arr.length === 0) return null;
    const first = arr[0]!;
    if (first === "payoutOverPrice") return te("payoutOverPrice");
    if (first === "name" || first === "Required" || first.includes("at least"))
      return te("name");
    if (key === "durationMin") return te("duration");
    if (key === "capacity") return te("capacity");
    if (key === "pricePhp") return te("price");
    if (key === "payoutPhp") return te("payoutNegative");
    return first;
  }

  const isEdit = mode === "edit";
  const submitLabel = isEdit ? t("editSubmit") : t("submit");
  const submittingLabel = isEdit ? t("editSubmitting") : t("submitting");

  const wrapperClass = hideCard
    ? ""
    : `rounded-2xl border p-6 ${tk.card}`;

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
        <input type="hidden" name="type" value={type} />
        {isEdit && service && (
          <input type="hidden" name="serviceId" value={service.id} />
        )}

        <div>
          <span
            className={`text-xs font-medium uppercase tracking-wider ${tk.label}`}
          >
            {t("typeLabel")}
          </span>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {(["personal", "group"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setType(kind)}
                className={`rounded-lg border px-4 py-3 text-left text-sm transition ${
                  type === kind ? tk.radioActive : tk.radioInactive
                }`}
              >
                <div className="font-medium">
                  {kind === "personal" ? t("typePersonal") : t("typeGroup")}
                </div>
                <div
                  className={`mt-1 text-xs ${
                    type === kind ? "opacity-80" : tk.hint
                  }`}
                >
                  {kind === "personal"
                    ? t("typeHintPersonal")
                    : t("typeHintGroup")}
                </div>
              </button>
            ))}
          </div>
        </div>

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
            defaultValue={service?.name ?? ""}
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
                key={p}
                type="button"
                onClick={() => setDuration(String(p))}
                className={`rounded-md border px-3 py-1.5 text-sm transition ${
                  duration === String(p) ? tk.presetActive : tk.preset
                }`}
              >
                {p}
              </button>
            ))}
            <input
              name="durationMin"
              type="text"
              inputMode="numeric"
              required
              value={fmt(duration)}
              onChange={(e) => setDuration(parseDigits(e.target.value))}
              className={`w-24 rounded-lg border px-3 py-1.5 text-sm transition ${tk.input}`}
            />
            <span className={`text-sm ${tk.hint}`}>{t("durationUnit")}</span>
          </div>
          {errorOf("durationMin") && (
            <p className={`mt-1 text-xs ${tk.error}`}>
              {errorOf("durationMin")}
            </p>
          )}
        </div>

        <div>
          <label
            className={`text-xs font-medium uppercase tracking-wider ${tk.label}`}
          >
            {t("capacity")}
          </label>
          <div className="mt-2 flex items-center gap-3">
            <input
              name="capacity"
              type="text"
              inputMode="numeric"
              disabled={type === "personal"}
              required
              value={fmt(capacity)}
              onChange={(e) => setCapacity(parseDigits(e.target.value))}
              className={`w-28 rounded-lg border px-3 py-2 text-sm transition ${
                type === "personal" ? tk.inputDisabled : tk.input
              }`}
            />
            <span className={`text-xs ${tk.hint}`}>{t("capacityHint")}</span>
          </div>
          {errorOf("capacity") && (
            <p className={`mt-1 text-xs ${tk.error}`}>{errorOf("capacity")}</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
          <div>
            <label
              className={`text-xs font-medium uppercase tracking-wider ${tk.label}`}
            >
              {t("payout")}
            </label>
            <div className="mt-2 flex items-center gap-2">
              <span className={`text-sm ${tk.hint}`}>{t("priceUnit")}</span>
              <input
                name="payoutPhp"
                type="text"
                inputMode="numeric"
                required
                value={fmt(payout)}
                onChange={(e) => setPayout(parseDigits(e.target.value))}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${tk.input}`}
              />
            </div>
            <p className={`mt-1 text-xs ${tk.hint}`}>{t("payoutHint")}</p>
            {errorOf("payoutPhp") && (
              <p className={`mt-1 text-xs ${tk.error}`}>
                {errorOf("payoutPhp")}
              </p>
            )}
          </div>
        </div>

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
