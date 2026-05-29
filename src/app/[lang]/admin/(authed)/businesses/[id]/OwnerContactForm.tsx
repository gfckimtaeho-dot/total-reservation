"use client";

import { useActionState, useState } from "react";
import {
  updateOwnerContact,
  type OwnerContactState,
} from "../actions";

const initialState: OwnerContactState = {};

type Props = {
  businessId: string;
  vertical: "GYM" | "HOTEL";
  ownerId: string;
  name: string;
  loginId: string | null;
  initialEmail: string | null;
  initialPhone: string | null;
};

// 사장 카드 — 이름/loginId 는 정적, email/전화 만 수정 가능.
// InfoCard 와 동일한 비주얼(rounded-2xl border bg-zinc-50 p-5 + label)을 직접 렌더.
export function OwnerContactForm({
  businessId,
  vertical,
  ownerId,
  name,
  loginId,
  initialEmail,
  initialPhone,
}: Props) {
  const [state, formAction, pending] = useActionState(
    updateOwnerContact,
    initialState,
  );
  const [email, setEmail] = useState(initialEmail ?? "");
  const [phone, setPhone] = useState(initialPhone ?? "");

  const dirty =
    email.trim() !== (initialEmail ?? "") ||
    phone.trim() !== (initialPhone ?? "");

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink/60">
        사장
      </div>

      <dl className="space-y-1.5">
        <StaticRow k="이름" v={name} />
        <StaticRow k="loginId" v={loginId ?? "-"} mono />
      </dl>

      <form action={formAction} className="mt-3 space-y-3">
        <input type="hidden" name="vertical" value={vertical} />
        <input type="hidden" name="id" value={businessId} />
        <input type="hidden" name="ownerId" value={ownerId} />

        <label className="block">
          <span className="text-xs text-zinc-500">email</span>
          <input
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
            placeholder="(없음)"
            className="mt-1 h-9 w-full rounded-md border border-zinc-300 bg-white px-2.5 font-mono text-xs text-zinc-900 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/15"
          />
          {state.errors?.email && (
            <span className="mt-1 block text-xs text-rose-600">
              {state.errors.email.join(", ")}
            </span>
          )}
        </label>

        <label className="block">
          <span className="text-xs text-zinc-500">전화</span>
          <input
            type="tel"
            name="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="off"
            placeholder="(없음)"
            className="mt-1 h-9 w-full rounded-md border border-zinc-300 bg-white px-2.5 font-mono text-xs text-zinc-900 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/15"
          />
          {state.errors?.phone && (
            <span className="mt-1 block text-xs text-rose-600">
              {state.errors.phone.join(", ")}
            </span>
          )}
        </label>

        {state.message && (
          <div className="rounded-md bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700">
            {state.message}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          {state.ok && !dirty && (
            <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
              저장됨
            </span>
          )}
          <button
            type="submit"
            disabled={pending || !dirty}
            className="inline-flex h-9 items-center rounded-md bg-ink px-4 text-xs font-medium text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "저장 중..." : "연락처 저장"}
          </button>
        </div>
      </form>
    </div>
  );
}

function StaticRow({
  k,
  v,
  mono,
}: {
  k: string;
  v: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="text-xs text-zinc-500">{k}</dt>
      <dd
        className={`min-w-0 truncate text-right text-zinc-900 ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {v}
      </dd>
    </div>
  );
}
