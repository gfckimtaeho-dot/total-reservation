"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type Tone = "normal" | "black" | "white";
type RoleFilter = "all" | "TRAINER" | "MANAGER";
type Specialty = "HEALTH" | "YOGA" | "PILATES" | "DANCE";

const TONE = {
  normal: {
    wrap: "bg-white ring-1 ring-amber-200/60",
    label: "text-ink/70",
    field:
      "border-amber-200/60 bg-white text-ink focus:border-ink focus:ring-ink/20",
    submit: "bg-ink text-white hover:bg-ink/90",
    reset: "border-amber-200/60 bg-white text-zinc-600 hover:border-ink",
  },
  black: {
    wrap: "bg-zinc-900 ring-1 ring-white/10",
    label: "text-zinc-300",
    field:
      "border-white/10 bg-zinc-800 text-zinc-100 placeholder-zinc-500 focus:border-lime-300 focus:ring-lime-300/20",
    submit: "bg-lime-300 text-zinc-950 hover:bg-lime-200",
    reset: "border-white/10 bg-zinc-800 text-zinc-300 hover:border-lime-300",
  },
  white: {
    wrap: "bg-white ring-1 ring-zinc-200",
    label: "text-ink/70",
    field:
      "border-zinc-300 bg-white text-ink focus:border-ink focus:ring-ink/20",
    submit: "bg-ink text-white hover:bg-ink/90",
    reset: "border-zinc-300 bg-white text-zinc-600 hover:border-ink",
  },
} as const;

const PILL_ACTIVE = {
  normal: "bg-band/40 text-ink ring-1 ring-ink",
  black: "bg-lime-300/20 text-lime-300 ring-1 ring-lime-300",
  white: "bg-sky-100 text-sky-900 ring-1 ring-sky-700",
} as const;

const PILL_INACTIVE = {
  normal: "bg-white text-zinc-600 ring-1 ring-amber-200/60 hover:ring-ink/40",
  black:
    "bg-zinc-800 text-zinc-400 ring-1 ring-white/10 hover:ring-lime-300/40",
  white: "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:ring-ink/40",
} as const;

const CHECK_ACTIVE = {
  normal: "border-ink bg-band/40 text-ink",
  black: "border-lime-300 bg-lime-300/10 text-lime-300",
  white: "border-sky-700 bg-sky-100 text-sky-900",
} as const;

const CHECK_INACTIVE = {
  normal: "border-amber-200/60 bg-white text-zinc-600 hover:border-ink/40",
  black: "border-white/10 bg-zinc-800 text-zinc-400 hover:border-lime-300/40",
  white: "border-zinc-300 bg-white text-zinc-600 hover:border-ink/40",
} as const;

export function TrainersSearch({
  tone,
  q,
  role,
  specialties,
  onLeave,
}: {
  tone: Tone;
  q: string;
  role: RoleFilter;
  specialties: Specialty[];
  onLeave: boolean;
}) {
  const t = useTranslations("trainers");
  const tk = TONE[tone];
  const [selectedRole, setSelectedRole] = useState<RoleFilter>(role);
  const [selectedSpecs, setSelectedSpecs] = useState<Set<Specialty>>(
    new Set(specialties),
  );
  const [checkLeave, setCheckLeave] = useState(onLeave);

  const roleOpts: { key: RoleFilter; label: string }[] = [
    { key: "all", label: t("roleAll") },
    { key: "TRAINER", label: t("roleTrainer") },
    { key: "MANAGER", label: t("roleManager") },
  ];

  const specOpts: { key: Specialty; label: string }[] = [
    { key: "HEALTH", label: t("specialty.HEALTH") },
    { key: "YOGA", label: t("specialty.YOGA") },
    { key: "PILATES", label: t("specialty.PILATES") },
    { key: "DANCE", label: t("specialty.DANCE") },
  ];

  function toggleSpec(s: Specialty) {
    setSelectedSpecs((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  return (
    <form
      method="get"
      className={`mb-4 flex flex-wrap items-end gap-4 rounded-2xl px-5 py-4 ${tk.wrap}`}
    >
      <label className="flex flex-col gap-1.5">
        <span
          className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${tk.label}`}
        >
          {t("searchNameLabel")}
        </span>
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder={t("searchNamePlaceholder")}
          className={`h-9 rounded-md border px-3 text-sm transition focus:outline-none focus:ring-2 ${tk.field}`}
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span
          className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${tk.label}`}
        >
          {t("searchRoleLabel")}
        </span>
        <div className="flex gap-1">
          {roleOpts.map((r) => {
            const isOn = selectedRole === r.key;
            return (
              <label
                key={r.key}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-sm transition ${
                  isOn ? PILL_ACTIVE[tone] : PILL_INACTIVE[tone]
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={r.key}
                  checked={isOn}
                  onChange={() => setSelectedRole(r.key)}
                  className="sr-only"
                />
                {r.label}
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span
          className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${tk.label}`}
        >
          {t("searchSpecialtyLabel")}
        </span>
        <div className="flex flex-wrap gap-1">
          {specOpts.map((s) => {
            const isOn = selectedSpecs.has(s.key);
            return (
              <label
                key={s.key}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-sm transition ${
                  isOn ? PILL_ACTIVE[tone] : PILL_INACTIVE[tone]
                }`}
              >
                <input
                  type="checkbox"
                  name="specialties"
                  value={s.key}
                  checked={isOn}
                  onChange={() => toggleSpec(s.key)}
                  className="sr-only"
                />
                {s.label}
              </label>
            );
          })}
        </div>
      </div>

      <label
        className={`flex h-9 cursor-pointer items-center gap-2 self-end rounded-md border px-3 text-sm transition ${
          checkLeave ? CHECK_ACTIVE[tone] : CHECK_INACTIVE[tone]
        }`}
      >
        <input
          type="checkbox"
          name="onLeave"
          value="1"
          checked={checkLeave}
          onChange={(e) => setCheckLeave(e.target.checked)}
          className="h-4 w-4 accent-ink"
        />
        {t("searchOnLeave")}
      </label>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          className={`h-9 rounded-md px-4 text-sm font-medium transition ${tk.submit}`}
        >
          {t("searchSubmit")}
        </button>
        <a
          href="?"
          className={`inline-flex h-9 items-center rounded-md border px-3 text-sm transition ${tk.reset}`}
        >
          {t("searchReset")}
        </a>
      </div>
    </form>
  );
}
