"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type Gender = "all" | "MALE" | "FEMALE";

const TK = {
  wrap: "bg-white border border-zinc-200",
  label: "text-zinc-500",
  field:
    "border-zinc-300 bg-white text-zinc-900 focus:border-indigo-500 focus:ring-indigo-500/20",
  submit: "bg-indigo-600 text-white hover:bg-indigo-700",
  reset: "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400",
} as const;

const RADIO_ACTIVE = "bg-indigo-600 text-white";
const RADIO_INACTIVE =
  "bg-white text-zinc-600 ring-1 ring-zinc-300 hover:ring-zinc-400";

const CHECK_ACTIVE = "border-indigo-600 bg-indigo-50 text-indigo-700";
const CHECK_INACTIVE =
  "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400";

export function MembersSearch({
  q,
  gender,
  expiringSoon,
}: {
  q: string;
  gender: Gender;
  expiringSoon: boolean;
}) {
  const t = useTranslations("members");
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
      className={`mb-4 flex flex-wrap items-end gap-4 rounded-2xl px-5 py-4 ${TK.wrap}`}
    >
      <label className="flex flex-col gap-1.5">
        <span
          className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${TK.label}`}
        >
          {t("searchNameLabel")}
        </span>
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder={t("searchNamePlaceholder")}
          className={`h-9 rounded-md border px-3 text-sm transition focus:outline-none focus:ring-2 ${TK.field}`}
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span
          className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${TK.label}`}
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
                  isOn ? RADIO_ACTIVE : RADIO_INACTIVE
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
          checkSoon ? CHECK_ACTIVE : CHECK_INACTIVE
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
          className={`h-9 rounded-md px-4 text-sm font-medium transition ${TK.submit}`}
        >
          {t("searchSubmit")}
        </button>
        <a
          href="?"
          className={`inline-flex h-9 items-center rounded-md border px-3 text-sm transition ${TK.reset}`}
        >
          {t("searchReset")}
        </a>
      </div>
    </form>
  );
}
