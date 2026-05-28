"use client";

import { useState, useTransition } from "react";
import { copyText } from "@/lib/clipboard";
import { emailInvite, revokeInvite } from "./actions";

export function VerticalLabel({ vertical }: { vertical: "GYM" | "HOTEL" }) {
  const isHotel = vertical === "HOTEL";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ${
        isHotel
          ? "text-sky-700 ring-sky-300"
          : "text-emerald-700 ring-emerald-300"
      }`}
    >
      {isHotel ? "호텔" : "헬스장"}
    </span>
  );
}

type Props = {
  id: string;
  url: string;
  vertical: "GYM" | "HOTEL";
  businessName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  createdAtLabel: string;
  expiresAtLabel: string;
};

export function PendingInviteRow(props: Props) {
  const {
    id,
    url,
    vertical,
    businessName,
    ownerEmail,
    ownerPhone,
    createdAtLabel,
    expiresAtLabel,
  } = props;

  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sendStatus, setSendStatus] = useState<
    "idle" | "ok" | "error"
  >("idle");
  const [sendMessage, setSendMessage] = useState("");
  const [sendPending, startSend] = useTransition();
  const [revokePending, startRevoke] = useTransition();

  async function copy() {
    await copyText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function send() {
    setSendStatus("idle");
    setSendMessage("");
    startSend(async () => {
      const fd = new FormData();
      fd.append("tokenId", id);
      fd.append("vertical", vertical);
      const res = await emailInvite(fd);
      if (res.ok) {
        setSendStatus("ok");
        setSendMessage(`재발송 완료 (${ownerEmail})`);
      } else {
        setSendStatus("error");
        setSendMessage(res.message ?? "발송 실패");
      }
    });
  }

  function revoke() {
    startRevoke(async () => {
      const fd = new FormData();
      fd.append("id", id);
      fd.append("vertical", vertical);
      await revokeInvite(fd);
    });
  }

  return (
    <li className="rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">
              {businessName || "(매장명 미입력)"}
            </span>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 ring-1 ring-amber-200">
              미사용
            </span>
            <VerticalLabel vertical={vertical} />
          </div>
          <div className="text-xs text-zinc-600">
            {ownerEmail || "이메일 없음"}
            {ownerPhone ? ` · ${ownerPhone}` : ""}
          </div>
          <div className="text-xs text-zinc-500">
            발급 {createdAtLabel} · 만료 {expiresAtLabel}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copy}
            className="inline-flex h-8 items-center rounded-md border border-zinc-300 bg-white px-2.5 text-xs text-zinc-800 transition hover:border-ink"
          >
            {copied ? "복사됨" : "URL 복사"}
          </button>
          <button
            type="button"
            onClick={send}
            disabled={sendPending || !ownerEmail}
            className="inline-flex h-8 items-center rounded-md border border-zinc-300 bg-white px-2.5 text-xs text-zinc-800 transition hover:border-ink disabled:opacity-50"
            title={!ownerEmail ? "이메일이 없어 발송 불가" : undefined}
          >
            {sendPending ? "발송 중..." : "메일 재발송"}
          </button>
          {confirming ? (
            <>
              <button
                type="button"
                onClick={revoke}
                disabled={revokePending}
                className="inline-flex h-8 items-center rounded-md bg-rose-600 px-2.5 text-xs font-medium text-white transition hover:bg-rose-700 disabled:opacity-60"
              >
                {revokePending ? "회수 중..." : "정말 회수"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={revokePending}
                className="inline-flex h-8 items-center rounded-md border border-zinc-300 bg-white px-2.5 text-xs text-zinc-700 transition hover:border-ink"
              >
                취소
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="inline-flex h-8 items-center rounded-md border border-rose-200 bg-rose-50 px-2.5 text-xs font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
            >
              회수
            </button>
          )}
        </div>
      </div>

      {sendMessage && (
        <div
          className={`mt-2 text-xs ${
            sendStatus === "ok" ? "text-emerald-700" : "text-rose-600"
          }`}
        >
          {sendMessage}
        </div>
      )}
    </li>
  );
}
