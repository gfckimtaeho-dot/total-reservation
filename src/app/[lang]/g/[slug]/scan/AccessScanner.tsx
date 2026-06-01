"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

// 출입 검증 결과(서버 verifyAccess 반환 형태). reason 은 머신 코드라
// 화면 번역은 여기서(access.reason.*).
type Reason =
  | "GYM_NOT_FOUND"
  | "STAY_NOT_FOUND"
  | "NOT_AFFILIATED"
  | "NOT_OPTED_IN"
  | "NOT_YET"
  | "CHECKED_OUT"
  | "WRONG_GYM"
  | "INACTIVE"
  | "NO_MEMBERSHIP"
  | "MEMBERSHIP_EXPIRED";

type Outcome = {
  result: "ALLOWED" | "DENIED" | "EXPIRED";
  kind: "GUEST" | "MEMBER" | "STAFF";
  name: string | null;
  hotelName: string | null;
  reason: Reason | null;
};

type View =
  | { phase: "idle" }
  | { phase: "verifying" }
  | { phase: "result"; outcome: Outcome }
  | { phase: "error"; message: string };

// 결과/에러 화면 자동 복귀(연속 스캔). 결과는 짧게, 안내성 에러는 조금 길게.
const RESULT_MS = 4000;
const ERROR_MS = 5000;

export function AccessScanner({
  slug,
  gymName,
  dashboardHref,
}: {
  slug: string;
  gymName: string;
  dashboardHref: string;
}) {
  const t = useTranslations("access");
  const tc = useTranslations("common");
  const [view, setView] = useState<View>({ phase: "idle" });
  const [inputValue, setInputValue] = useState("");
  const [cameraOn, setCameraOn] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  const submit = useCallback(
    async (rawToken: string) => {
      const token = rawToken.trim();
      if (!token) return;
      setInputValue("");
      setView({ phase: "verifying" });
      try {
        const res = await fetch("/api/access/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, token }),
        });
        if (!res.ok) {
          setView({ phase: "error", message: t("networkError") });
          return;
        }
        const outcome = (await res.json()) as Outcome;
        setView({ phase: "result", outcome });
      } catch {
        setView({ phase: "error", message: t("networkError") });
      }
    },
    [slug, t],
  );

  const startCamera = useCallback(async () => {
    // BarcodeDetector + getUserMedia 둘 다 secure context(HTTPS) 전용.
    // 미지원/HTTP 면 throw 대신 안내 문구로 fallback.
    const BarcodeDetectorCtor = (
      window as unknown as { BarcodeDetector?: new (opts?: unknown) => { detect: (s: unknown) => Promise<{ rawValue: string }[]> } }
    ).BarcodeDetector;
    if (!BarcodeDetectorCtor || !navigator.mediaDevices?.getUserMedia) {
      setView({ phase: "error", message: t("cameraUnavailable") });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setCameraOn(true);
      const video = videoRef.current;
      if (!video) {
        stopCamera();
        return;
      }
      video.srcObject = stream;
      await video.play();
      const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
      const tick = async () => {
        if (!streamRef.current) return;
        try {
          const codes = await detector.detect(video);
          const value = codes[0]?.rawValue;
          if (value) {
            stopCamera();
            submit(value);
            return;
          }
        } catch {
          // 일시적 detect 실패는 무시하고 다음 프레임에서 재시도.
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setView({ phase: "error", message: t("cameraError") });
      stopCamera();
    }
  }, [t, stopCamera, submit]);

  // 결과/에러는 일정 시간 뒤 idle 로 복귀.
  useEffect(() => {
    if (view.phase !== "result" && view.phase !== "error") return;
    const ms = view.phase === "result" ? RESULT_MS : ERROR_MS;
    const id = setTimeout(() => setView({ phase: "idle" }), ms);
    return () => clearTimeout(id);
  }, [view]);

  // idle 이고 카메라 꺼져 있으면 입력창에 포커스 유지(HID 스캐너 키 수신).
  useEffect(() => {
    if (view.phase === "idle" && !cameraOn) inputRef.current?.focus();
  }, [view, cameraOn]);

  // 언마운트 시 카메라 정리.
  useEffect(() => () => stopCamera(), [stopCamera]);

  return (
    <div
      className="fixed inset-0 flex flex-col bg-zinc-950 text-white"
      onClick={() => {
        if (view.phase === "idle" && !cameraOn) inputRef.current?.focus();
      }}
    >
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-white/50">
            {t("title")}
          </span>
          <span className="text-sm font-medium text-white/80">{gymName}</span>
        </div>
        <Link
          href={dashboardHref}
          className="rounded-lg border border-white/15 px-4 py-2 text-xs font-medium text-white/70 hover:bg-white/5"
        >
          {tc("home")}
        </Link>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-6">
        {view.phase === "result" && (
          <ResultPanel
            outcome={view.outcome}
            t={t}
            onAgain={() => setView({ phase: "idle" })}
          />
        )}

        {view.phase === "error" && (
          <div className="flex max-w-md flex-col items-center gap-6 text-center">
            <p className="text-lg leading-relaxed text-white/80">{view.message}</p>
            <button
              type="button"
              onClick={() => setView({ phase: "idle" })}
              className="rounded-xl bg-white/10 px-6 py-3 text-sm font-semibold hover:bg-white/15"
            >
              {t("scanAgain")}
            </button>
          </div>
        )}

        {view.phase === "verifying" && (
          <p className="text-2xl font-semibold text-white/70">{t("verifying")}</p>
        )}

        {view.phase === "idle" && (
          <div className="flex w-full max-w-md flex-col items-center gap-8">
            <p className="text-center text-base leading-relaxed text-white/60">
              {t("subtitle")}
            </p>

            <form
              className="w-full"
              onSubmit={(e) => {
                e.preventDefault();
                submit(inputValue);
              }}
            >
              <input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={t("inputPlaceholder")}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className="w-full rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-center font-mono text-lg tracking-wider text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
              />
            </form>

            <button
              type="button"
              onClick={startCamera}
              className="rounded-xl border border-white/15 px-5 py-3 text-sm font-medium text-white/70 hover:bg-white/5"
            >
              {t("scanButton")}
            </button>
          </div>
        )}

        {/* 카메라 프리뷰 — 켜졌을 때만 표시. ref 는 항상 마운트(detect 대상). */}
        <div
          className={
            cameraOn
              ? "absolute inset-0 flex flex-col items-center justify-center gap-6 bg-zinc-950"
              : "hidden"
          }
        >
          <video
            ref={videoRef}
            playsInline
            muted
            className="max-h-[70vh] w-auto max-w-full rounded-2xl"
          />
          <button
            type="button"
            onClick={stopCamera}
            className="rounded-xl bg-white/10 px-6 py-3 text-sm font-semibold hover:bg-white/15"
          >
            {t("scanStop")}
          </button>
        </div>
      </main>
    </div>
  );
}

function ResultPanel({
  outcome,
  t,
  onAgain,
}: {
  outcome: Outcome;
  t: ReturnType<typeof useTranslations>;
  onAgain: () => void;
}) {
  const allowed = outcome.result === "ALLOWED";
  const expired = outcome.result === "EXPIRED";

  const tone = allowed
    ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/30"
    : expired
      ? "bg-amber-500/15 text-amber-300 border-amber-400/30"
      : "bg-rose-500/15 text-rose-300 border-rose-400/30";

  const heading = allowed
    ? t("resultAllowed")
    : expired
      ? t("resultExpired")
      : t("resultDenied");

  return (
    <div
      className={`flex w-full max-w-lg flex-col items-center gap-6 rounded-3xl border p-10 text-center ${tone}`}
    >
      <ResultIcon result={outcome.result} />
      <h1 className="text-4xl font-bold tracking-tight">{heading}</h1>

      {allowed ? (
        <div className="flex flex-col items-center gap-2">
          {outcome.name && (
            <p className="text-2xl font-semibold text-white">{outcome.name}</p>
          )}
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/70">
            {t(`badge.${outcome.kind}`)}
          </span>
          {outcome.kind === "GUEST" && outcome.hotelName && (
            <p className="text-sm text-white/60">
              {t("hotelLabel")}: {outcome.hotelName}
            </p>
          )}
        </div>
      ) : (
        outcome.reason && (
          <p className="text-lg text-white/80">{t(`reason.${outcome.reason}`)}</p>
        )
      )}

      <button
        type="button"
        onClick={onAgain}
        className="mt-2 rounded-xl bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/15"
      >
        {t("scanAgain")}
      </button>
    </div>
  );
}

function ResultIcon({ result }: { result: Outcome["result"] }) {
  if (result === "ALLOWED") {
    return (
      <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }
  if (result === "EXPIRED") {
    return (
      <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }
  return (
    <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="m15 9-6 6M9 9l6 6" />
    </svg>
  );
}
