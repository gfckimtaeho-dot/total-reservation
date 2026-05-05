"use client";

import { useState } from "react";

type Props = {
  publicUrl: string;
  loginUrl: string;
  dashboardUrl: string;
  ownerEmail: string;
};

export function NextVisitCard({
  publicUrl,
  loginUrl,
  dashboardUrl,
  ownerEmail,
}: Props) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function copy(key: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6">
      <h3 className="font-heading text-xl tracking-tight text-ink">
        다음에 다시 들어오시려면
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600">
        브라우저를 닫고 나중에 다시 매장에 들어오시려면 아래 URL을
        북마크하시거나, 가입하신 이메일{" "}
        <span className="font-medium text-ink">{ownerEmail}</span>로 발송된
        환영 메일을 보관해 주세요. 메일에 모든 URL이 박혀 있습니다.
      </p>
      <div className="mt-5 space-y-2">
        <Row
          label="대시보드 (사장 운영 화면)"
          url={dashboardUrl}
          copyKey="dashboard"
          copied={copiedKey === "dashboard"}
          onCopy={(v) => copy("dashboard", v)}
        />
        <Row
          label="로그인 페이지"
          url={loginUrl}
          copyKey="login"
          copied={copiedKey === "login"}
          onCopy={(v) => copy("login", v)}
        />
        <Row
          label="매장 공개 페이지 (외부 공유용)"
          url={publicUrl}
          copyKey="public"
          copied={copiedKey === "public"}
          onCopy={(v) => copy("public", v)}
        />
      </div>
    </div>
  );
}

function Row({
  label,
  url,
  copied,
  onCopy,
}: {
  label: string;
  url: string;
  copyKey: string;
  copied: boolean;
  onCopy: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md bg-zinc-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="min-w-0">
        <div className="text-xs text-zinc-500">{label}</div>
        <div className="truncate font-mono text-xs text-zinc-800">{url}</div>
      </div>
      <button
        type="button"
        onClick={() => onCopy(url)}
        className="inline-flex h-8 shrink-0 items-center rounded-md border border-zinc-300 bg-white px-3 text-xs text-zinc-800 transition hover:border-ink"
      >
        {copied ? "복사됨" : "URL 복사"}
      </button>
    </div>
  );
}
