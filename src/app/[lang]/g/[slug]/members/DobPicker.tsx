"use client";

import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { ko, enUS } from "react-day-picker/locale";
import "react-day-picker/style.css";
import { useTranslations } from "next-intl";

export function DobPicker({
  name,
  lang,
  label,
  initialDate,
}: {
  name: string;
  lang: string;
  label: string;
  initialDate?: Date;
}) {
  const t = useTranslations("memberAdd");
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(initialDate);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const locale = lang === "en" ? enUS : ko;
  const today = new Date();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const dateStr = date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0",
      )}-${String(date.getDate()).padStart(2, "0")}`
    : "";

  const display = date
    ? new Intl.DateTimeFormat(lang === "en" ? "en-US" : "ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(date)
    : t("dobPlaceholder");

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800">
          {label}
        </span>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="h-11 rounded-md px-3 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-ink/20 border border-violet-200 bg-white text-ink hover:border-violet-500"
        >
          <span className={date ? "" : "text-zinc-400"}>{display}</span>
        </button>
        <input type="hidden" name={name} value={dateStr} />
      </label>

      {open && (
        <div className="absolute left-0 top-full z-[60] mt-1 rounded-lg p-2 shadow-xl bg-white ring-1 ring-violet-100 [--rdp-accent-color:#7c3aed]">

          <DayPicker
            mode="single"
            selected={date}
            onSelect={(d) => {
              setDate(d);
              setOpen(false);
            }}
            locale={locale}
            captionLayout="dropdown"
            startMonth={new Date(1900, 0)}
            endMonth={today}
            defaultMonth={
              date ?? new Date(today.getFullYear() - 30, today.getMonth())
            }
          />
        </div>
      )}
    </div>
  );
}
