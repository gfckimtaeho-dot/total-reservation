"use client";

import { useActionState, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  regenerateScannerKey,
  sendScannerLink,
  type ScannerKeyState,
  type ScannerEmailState,
} from "./actions";

// 무인 출입 스캐너 영구 링크 관리. 키가 있으면 링크 표시 + 복사 + 재발급 + 메일
// 발송. 키가 없으면 "링크 생성". 링크 자체가 로그인 없는 영구 인증 수단이다.
export function ScannerLinkCard({
  slug,
  lang,
  scannerKey,
  defaultEmail,
  origin,
}: {
  slug: string;
  lang: string;
  scannerKey: string | null;
  defaultEmail: string;
  origin: string;
}) {
  const t = useTranslations("settings");
  const [keyState, regenAction, regenPending] = useActionState<ScannerKeyState, FormData>(
    regenerateScannerKey.bind(null, slug),
    { status: "idle" },
  );
  const [emailState, emailAction, emailPending] = useActionState<ScannerEmailState, FormData>(
    sendScannerLink.bind(null, slug),
    { status: "idle" },
  );

  const [copied, setCopied] = useState(false);
  const linkRef = useRef<HTMLInputElement>(null);

  const scanUrl = scannerKey ? `${origin}/${lang}/g/${slug}/scan/${scannerKey}` : "";

  async function copyLink() {
    if (!scanUrl) return;
    try {
      // clipboard API 는 secure context(HTTPS) 전용 — 실패 시 입력 선택으로 fallback.
      await navigator.clipboard.writeText(scanUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      linkRef.current?.select();
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      {scannerKey ? (
        <>
          <div className="flex flex-col gap-2">
            <span className="text-xs text-zinc-500">{t("scannerLink.linkLabel")}</span>
            <div className="flex gap-2">
              <input
                ref={linkRef}
                readOnly
                value={scanUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-700 focus:border-ink focus:outline-none"
              />
              <button
                type="button"
                onClick={copyLink}
                className="shrink-0 rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                {copied ? t("scannerLink.copied") : t("scannerLink.copy")}
              </button>
            </div>
          </div>

          <form action={emailAction} className="flex flex-col gap-2">
            <span className="text-xs text-zinc-500">{t("scannerLink.emailLabel")}</span>
            <div className="flex gap-2">
              <input
                type="email"
                name="email"
                defaultValue={defaultEmail}
                placeholder="tablet@example.com"
                className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-ink focus:outline-none"
              />
              <button
                type="submit"
                disabled={emailPending}
                className="shrink-0 rounded-md bg-ink px-4 py-2 text-xs font-medium text-white transition hover:bg-ink/90 disabled:opacity-50"
              >
                {emailPending ? t("scannerLink.sending") : t("scannerLink.sendEmail")}
              </button>
            </div>
            {emailState.status === "sent" && (
              <p className="text-xs text-emerald-600">{t("scannerLink.sent")}</p>
            )}
            {emailState.status === "fallback" && (
              <p className="text-xs text-amber-600">{t("scannerLink.fallback")}</p>
            )}
            {emailState.status === "error" && (
              <p className="text-xs text-rose-600">
                {t(`scannerLink.err_${emailState.message}`)}
              </p>
            )}
          </form>

          <form action={regenAction}>
            <button
              type="submit"
              disabled={regenPending}
              className="rounded-md border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
            >
              {regenPending ? t("scannerLink.regenerating") : t("scannerLink.regenerate")}
            </button>
            <p className="mt-2 text-xs text-zinc-500">{t("scannerLink.regenerateHint")}</p>
            {keyState.status === "generated" && (
              <p className="mt-1 text-xs text-emerald-600">{t("scannerLink.generated")}</p>
            )}
          </form>
        </>
      ) : (
        <form action={regenAction} className="flex flex-col gap-2">
          <p className="text-sm text-zinc-600">{t("scannerLink.notSet")}</p>
          <button
            type="submit"
            disabled={regenPending}
            className="w-fit rounded-md bg-ink px-4 py-2 text-xs font-medium text-white transition hover:bg-ink/90 disabled:opacity-50"
          >
            {regenPending ? t("scannerLink.generating") : t("scannerLink.generate")}
          </button>
          {keyState.status === "error" && (
            <p className="text-xs text-rose-600">{t("scannerLink.err_forbidden")}</p>
          )}
        </form>
      )}
    </div>
  );
}
