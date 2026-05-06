"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type Tone = "normal" | "black" | "white";
type Gender = "all" | "MALE" | "FEMALE";

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

const RADIO_ACTIVE = {
  normal: "bg-band/40 text-ink ring-1 ring-ink",
  black: "bg-lime-300/20 text-lime-300 ring-1 ring-lime-300",
  white: "bg-sky-100 text-sky-900 ring-1 ring-sky-700",
} as const;

const RADIO_INACTIVE = {
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

export function MembersSearch({
  tone,
  q,
  gender,
  expiringSoon,
}: {
  tone: Tone;
  q: string;
  gender: Gender;
  expiringSoon: boolean;
}) {
  const t = useTranslations("members");
  const tk = TONE[tone];
  const [selectedGender, setSelectedGender] = useState<Gender>(gender);
  const [checkSoon, setCheckSoon] = useState<boolean>(expiringSoon);

  const genders: { key: Gender; label: string }[] = [
    { key: "all", label: t("genderAll") },
    { key: "MALE", label: t("genderMale") },
    { key: "FEMALE", label: t("genderFemale") },
  ];

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
          {t("searchGenderLabel")}
        </span>
        <div className="flex gap-1">
          {genders.map((g) => {
            const isOn = selectedGender === g.key;
            return (
              <label
                key={g.key}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-sm transition ${
                  isOn ? RADIO_ACTIVE[tone] : RADIO_INACTIVE[tone]
                }`}
              >
                <input
                  type="radio"
                  name="gender"
                  value={g.key}
                  checked={isOn}
                  onChange={() => setSelectedGender(g.key)}
                  className="sr-only"
                />
                {g.label}
              </label>
            );
          })}
        </div>
      </div>

      <label
        className={`flex h-9 cursor-pointer items-center gap-2 self-end rounded-md border px-3 text-sm transition ${
          checkSoon ? CHECK_ACTIVE[tone] : CHECK_INACTIVE[tone]
        }`}
      >
        <input
          type="checkbox"
          name="expiringSoon"
          value="1"
          checked={checkSoon}
          onChange={(e) => setCheckSoon(e.target.checked)}
          className="h-4 w-4 accent-ink"
        />
        {t("searchExpiringSoon")}
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
