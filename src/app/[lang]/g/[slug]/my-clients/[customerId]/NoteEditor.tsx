"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pencil, Check, X } from "lucide-react";
import { updateReservationNote } from "../actions";

// PT 히스토리 row 의 메모 편집. view 모드(메모 + 연필 버튼) ↔ edit 모드
// (input + 저장/취소). 빈 저장 = 메모 제거.
export function NoteEditor({
  reservationId,
  initialNote,
  slug,
}: {
  reservationId: string;
  initialNote: string;
  slug: string;
}) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialNote);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function startEdit() {
    setValue(initialNote);
    setErr(null);
    setEditing(true);
  }
  function cancelEdit() {
    setValue(initialNote);
    setErr(null);
    setEditing(false);
  }
  function save() {
    setErr(null);
    startTransition(async () => {
      const r = await updateReservationNote({
        slug,
        reservationId,
        note: value,
      });
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              else if (e.key === "Escape") cancelEdit();
            }}
            placeholder={t("myClientsNotePlaceholder")}
            maxLength={80}
            className="flex-1 rounded-md border border-emerald-400/40 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-400/60"
          />
          <button
            type="button"
            onClick={cancelEdit}
            disabled={pending}
            aria-label={t("myClientsNoteCancel")}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-white/15 text-zinc-300 hover:bg-white/5 disabled:opacity-40"
          >
            <X size={14} />
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            aria-label={t("myClientsNoteSave")}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-emerald-400/50 bg-emerald-400/20 text-emerald-300 hover:bg-emerald-400/30 disabled:opacity-40"
          >
            <Check size={14} />
          </button>
        </div>
        {err && <p className="text-xs text-rose-400">{err}</p>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      className="group flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition hover:bg-white/5"
    >
      <span
        className={
          initialNote
            ? "min-w-0 flex-1 truncate text-zinc-200"
            : "min-w-0 flex-1 truncate text-zinc-600"
        }
      >
        {initialNote || t("myClientsNoteEmpty")}
      </span>
      <Pencil
        size={12}
        className="shrink-0 text-zinc-500 opacity-0 transition group-hover:opacity-100"
      />
    </button>
  );
}
