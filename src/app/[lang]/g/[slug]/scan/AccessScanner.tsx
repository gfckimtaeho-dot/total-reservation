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
  verifyKey,
}: {
  slug: string;
  gymName: string;
  // 직원 세션 스캐너는 대시보드로 돌아가는 링크 제공. 무인 키오스크(키 링크)는
  // 생략 — 손님이 운영 화면으로 새지 않게.
  dashboardHref?: string;
  // 무인 키 링크에서 넘어온 스캐너 키. 있으면 verify 요청에 함께 보내 단말을 인증.
  verifyKey?: string;
}) {
  const t = useTranslations("access");
  const tc = useTranslations("common");
  const [view, setView] = useState<View>({ phase: "idle" });
  const [inputValue, setInputValue] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  // 전면/후면 카메라 선택. 벽걸이 키오스크는 손님이 화면을 마주보므로 보통 전면
  // (user). 기본은 후면(environment) — 직원이 손님 폰을 찍는 경우. 버튼으로 전환.
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const facingRef = useRef<"environment" | "user">("environment");

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  // 무인 연속 스캔 제어:
  //  - lockRef: 검증중/결과표시중엔 새 스캔 잠금(다음 손님은 idle 복귀 후 받음).
  //  - clearedRef: 직전 QR 이 프레임에서 빠진 뒤(빈 프레임 1회)에만 다음 스캔 허용.
  //    같은 폰을 계속 들고 있어도 연타로 중복 스캔되지 않게 하는 디바운스.
  const lockRef = useRef(false);
  const clearedRef = useRef(true);

  const stopCamera = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    // 비디오 엘리먼트가 죽은 스트림을 붙들지 않게 해제 — 재시작 시 기기 점유 방지.
    const video = videoRef.current;
    if (video) video.srcObject = null;
    lockRef.current = false;
    clearedRef.current = true;
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
          body: JSON.stringify(verifyKey ? { slug, token, key: verifyKey } : { slug, token }),
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
    [slug, t, verifyKey],
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
    // 재시작 안전장치: 직전 스트림이 남아있으면 먼저 정리(기기 점유 해제) 후 획득.
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    const constraints: MediaStreamConstraints = {
      // 문자열 facingMode 는 ideal 제약이라 해당 카메라 없으면 다른 걸로 fallback.
      video: { facingMode: facingRef.current },
    };
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      // 카메라 stop 직후 재획득이 기기 점유(NotReadableError/AbortError)로 일시
      // 실패하는 태블릿이 있어 한 번 더 시도. 그래도 실패면 원인(에러명)을 표기.
      const name = (err as DOMException)?.name ?? "";
      if (name === "NotReadableError" || name === "AbortError") {
        await new Promise((r) => setTimeout(r, 400));
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err2) {
        const n2 = (err2 as DOMException)?.name ?? "unknown";
        setView({ phase: "error", message: `${t("cameraError")} (${n2})` });
        stopCamera();
        return;
      }
    }
    try {
      streamRef.current = stream;
      lockRef.current = false;
      clearedRef.current = true;
      setCameraOn(true);
      const video = videoRef.current;
      if (!video) {
        stopCamera();
        return;
      }
      video.srcObject = stream;
      await video.play();
      const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
      // 무인 연속 루프: 한 번 인식해도 카메라를 끄지 않고 계속 돈다.
      const tick = async () => {
        if (!streamRef.current) return;
        try {
          const codes = await detector.detect(video);
          const value = codes[0]?.rawValue;
          if (!value) {
            // 프레임이 비었다 = 직전 손님 폰이 빠졌다. 다음 스캔 허용.
            clearedRef.current = true;
          } else if (clearedRef.current && !lockRef.current) {
            clearedRef.current = false;
            lockRef.current = true;
            submit(value);
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

  // 전면/후면 전환. 현재 스트림을 끊고 반대 카메라로 다시 켠다.
  const flipCamera = useCallback(() => {
    const next = facingRef.current === "environment" ? "user" : "environment";
    facingRef.current = next;
    setFacing(next);
    stopCamera();
    startCamera();
  }, [stopCamera, startCamera]);

  // 브라우저 주소창 숨김(전체화면). 사용자 제스처(버튼 클릭)에서 호출해야 동작.
  // 미지원/거부는 무시. PWA "홈 화면에 추가"로 standalone 설치 시엔 불필요.
  const enterFullscreen = useCallback(() => {
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    try {
      (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.())?.catch?.(() => {});
    } catch {
      // 무시.
    }
  }, []);

  // 결과/에러는 일정 시간 뒤 idle 로 복귀. 카메라 켜져 있으면 잠금 해제로
  // 자동 재스캔 재개(무인). 카메라 꺼진 수동 모드는 그대로 idle 입력 대기.
  useEffect(() => {
    if (view.phase !== "result" && view.phase !== "error") return;
    const ms = view.phase === "result" ? RESULT_MS : ERROR_MS;
    const id = setTimeout(() => {
      lockRef.current = false;
      setView({ phase: "idle" });
    }, ms);
    return () => clearTimeout(id);
  }, [view]);

  // idle 이고 카메라 꺼져 있으면 입력창에 포커스 유지(HID 스캐너 키 수신).
  useEffect(() => {
    if (view.phase === "idle" && !cameraOn) inputRef.current?.focus();
  }, [view, cameraOn]);

  // 언마운트 시 카메라 정리.
  useEffect(() => () => stopCamera(), [stopCamera]);

  // 무인 단말 화면 꺼짐 방지(Screen Wake Lock). secure context(HTTPS) 전용이라
  // 미지원/실패는 조용히 무시. 화면 복귀 시 잠금 재획득(브라우저가 자동 해제하므로).
  useEffect(() => {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
    };
    if (!nav.wakeLock) return;
    let sentinel: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        sentinel = await nav.wakeLock!.request("screen");
      } catch {
        // 미지원/거부 — 무시.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && !cancelled) acquire();
    };
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      sentinel?.release().catch(() => {});
    };
  }, []);

  const showResult = view.phase === "result";
  const showError = view.phase === "error";
  const showVerifying = view.phase === "verifying";
  const showIdleManual = view.phase === "idle" && !cameraOn;

  return (
    <div
      className="fixed inset-0 flex flex-col bg-zinc-950 text-white"
      onClick={() => {
        if (view.phase === "idle" && !cameraOn) inputRef.current?.focus();
      }}
    >
      <header className="relative z-20 flex items-center justify-between px-6 py-4">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-white/50">
            {t("title")}
          </span>
          <span className="text-sm font-medium text-white/80">{gymName}</span>
        </div>
        {dashboardHref && (
          <Link
            href={dashboardHref}
            className="rounded-lg border border-white/15 px-4 py-2 text-xs font-medium text-white/70 hover:bg-white/5"
          >
            {tc("home")}
          </Link>
        )}
      </header>

      <main className="relative flex flex-1 items-center justify-center px-6">
        {/* 카메라 프리뷰 — 켜졌을 때만 풀블리드 베이스 레이어. */}
        <video
          ref={videoRef}
          playsInline
          muted
          className={
            cameraOn
              ? "absolute inset-0 h-full w-full object-cover"
              : "hidden"
          }
        />

        {showResult && (
          <Overlay>
            <ResultPanel
              outcome={(view as { outcome: Outcome }).outcome}
              t={t}
              onAgain={() => {
                lockRef.current = false;
                setView({ phase: "idle" });
              }}
            />
          </Overlay>
        )}

        {showError && (
          <Overlay>
            <div className="flex max-w-md flex-col items-center gap-6 text-center">
              <p className="text-lg leading-relaxed text-white/80">
                {(view as { message: string }).message}
              </p>
              <button
                type="button"
                onClick={() => {
                  lockRef.current = false;
                  setView({ phase: "idle" });
                }}
                className="rounded-xl bg-white/10 px-6 py-3 text-sm font-semibold hover:bg-white/15"
              >
                {t("scanAgain")}
              </button>
            </div>
          </Overlay>
        )}

        {showVerifying && (
          <Overlay>
            <p className="text-2xl font-semibold text-white/70">{t("verifying")}</p>
          </Overlay>
        )}

        {/* 카메라 켜진 idle = 무인 대기 상태. 손님이 폰 QR 을 비추도록 안내 + 전환/중지. */}
        {cameraOn && view.phase === "idle" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-5 bg-gradient-to-t from-zinc-950/90 to-transparent px-6 pb-10 pt-16 text-center">
            <p className="text-base font-medium text-white/80">{t("subtitle")}</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={flipCamera}
                className="pointer-events-auto rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold hover:bg-white/10"
              >
                {facing === "environment" ? t("cameraFront") : t("cameraBack")}
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="pointer-events-auto rounded-xl bg-white/10 px-6 py-3 text-sm font-semibold hover:bg-white/15"
              >
                {t("scanStop")}
              </button>
            </div>
          </div>
        )}

        {/* 수동 모드(카메라 꺼짐): HID 스캐너 입력창 + 카메라 시작 버튼. */}
        {showIdleManual && (
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

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  enterFullscreen();
                  startCamera();
                }}
                className="rounded-xl border border-white/15 px-5 py-3 text-sm font-medium text-white/70 hover:bg-white/5"
              >
                {t("scanButton")}
              </button>
              <button
                type="button"
                onClick={enterFullscreen}
                className="rounded-xl border border-white/15 px-5 py-3 text-sm font-medium text-white/70 hover:bg-white/5"
              >
                {t("fullscreen")}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// 카메라 프리뷰 위에 결과/에러/검증중을 덮는 반투명 오버레이.
function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/80 px-6">
      {children}
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
