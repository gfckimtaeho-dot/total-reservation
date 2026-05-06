"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { upload } from "@vercel/blob/client";

const SLOT_COUNT = 5;
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export function PhotoUploader({
  slug,
  urls,
  onChange,
  tone,
}: {
  slug: string;
  urls: string[];
  onChange: (urls: string[]) => void;
  tone: "normal" | "black" | "white";
}) {
  const t = useTranslations("trainerAdd");
  const [errors, setErrors] = useState<(string | null)[]>(
    Array(SLOT_COUNT).fill(null),
  );
  const [pendingIdx, setPendingIdx] = useState<number | null>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  function pickFile(idx: number) {
    inputRefs.current[idx]?.click();
  }

  async function handleFile(idx: number, file: File) {
    setErrors((e) => {
      const next = [...e];
      next[idx] = null;
      return next;
    });

    if (file.size > MAX_BYTES) {
      setErrors((e) => {
        const next = [...e];
        next[idx] = `파일이 너무 큽니다 (최대 10MB)`;
        return next;
      });
      return;
    }

    setPendingIdx(idx);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const pathname = `staff/${slug}/${idx}-${Date.now()}.${ext}`;
      const blob = await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/upload/staff",
      });
      const next = [...urls];
      next[idx] = blob.url;
      onChange(next.filter(Boolean));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "업로드 실패";
      setErrors((e) => {
        const next = [...e];
        next[idx] = message;
        return next;
      });
    } finally {
      setPendingIdx(null);
    }
  }

  function removeAt(idx: number) {
    const next = urls.filter((_, i) => i !== idx);
    onChange(next);
  }

  const slots = Array.from({ length: SLOT_COUNT }, (_, i) => urls[i] ?? null);

  const slotBase =
    tone === "black"
      ? "border-white/10 bg-zinc-800 hover:border-lime-300/40"
      : tone === "white"
        ? "border-zinc-300 bg-white hover:border-ink/40"
        : "border-amber-200/60 bg-white hover:border-ink/40";
  const labelText = tone === "black" ? "text-zinc-400" : "text-zinc-600";

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
        {slots.map((url, i) => {
          const isPrimary = i === 0;
          return (
            <div
              key={i}
              className={`flex flex-col items-center gap-2 ${
                isPrimary ? "sm:col-span-2 sm:row-span-2" : ""
              }`}
            >
              <span
                className={`text-[10px] uppercase tracking-[0.18em] ${labelText}`}
              >
                {isPrimary
                  ? t("photoPrimary")
                  : t("photoAdditional", { n: i })}
              </span>
              <button
                type="button"
                onClick={() => pickFile(i)}
                disabled={pendingIdx === i}
                className={`relative aspect-square w-full overflow-hidden rounded-xl border-2 border-dashed transition disabled:opacity-50 ${slotBase}`}
              >
                {url ? (
                  <img
                    src={url}
                    alt=""
                    className="h-full w-full bg-zinc-50 object-contain"
                  />
                ) : (
                  <span
                    className={`flex h-full w-full items-center justify-center text-xs ${labelText}`}
                  >
                    {pendingIdx === i ? t("photoUploading") : t("photoUpload")}
                  </span>
                )}
              </button>
              <input
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(i, f);
                  e.target.value = "";
                }}
              />
              {url && (
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="text-[11px] text-rose-600 hover:underline"
                >
                  {t("photoRemove")}
                </button>
              )}
              {errors[i] && (
                <span className="text-[11px] text-rose-600">{errors[i]}</span>
              )}
            </div>
          );
        })}
      </div>
      <input type="hidden" name="imageUrls" value={JSON.stringify(urls)} />
    </div>
  );
}
