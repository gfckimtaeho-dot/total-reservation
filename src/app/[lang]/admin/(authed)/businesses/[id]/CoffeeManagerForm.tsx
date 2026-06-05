"use client";

import { useActionState, useState } from "react";
import {
  issueCoffeeManager,
  type CoffeeManagerState,
} from "../actions";

const initialState: CoffeeManagerState = {};

type Props = {
  businessId: string;
  exists: boolean; // 이미 COFFEE_MANAGER 가 있으면 재발급 모드
  initialName: string;
  initialEmail: string;
  initialPhone: string;
};

// 커피매니저(카페 사장) 발급 카드 — HOTEL 가맹점 상세 전용.
// admin 이 이름+이메일(+선택 전화)을 입력하면 호텔 DB 에 계정/토큰을 만들고
// 설정 링크 메일을 보낸다(actions.issueCoffeeManager). 메일 실패 시 링크를 노출해
// admin 이 복사 전달.
export function CoffeeManagerForm({
  businessId,
  exists,
  initialName,
  initialEmail,
  initialPhone,
}: Props) {
  const [state, formAction, pending] = useActionState(
    issueCoffeeManager,
    initialState,
  );
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [copied, setCopied] = useState(false);

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 막힌 환경 — 아래 input 을 직접 선택해 복사.
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/60">
          커피매니저
        </span>
        {exists && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">
            재발급
          </span>
        )}
      </div>
      <p className="mb-3 text-xs text-zinc-500">
        {exists
          ? "이미 등록된 카페 사장에게 설정 링크를 다시 보냅니다. 입력값으로 정보가 갱신됩니다."
          : "카페 사장 이메일로 아이디/비밀번호 설정 링크를 보냅니다. 설정 후 호텔 커피 화면으로 입장합니다."}
      </p>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="id" value={businessId} />

        <label className="block">
          <span className="text-xs text-zinc-500">카페 사장 이름</span>
          <input
            type="text"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            placeholder="홍길동"
            className="mt-1 h-9 w-full rounded-md border border-zinc-300 bg-white px-2.5 text-xs text-zinc-900 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/15"
          />
          {state.errors?.name && (
            <span className="mt-1 block text-xs text-rose-600">
              {state.errors.name.join(", ")}
            </span>
          )}
        </label>

        <label className="block">
          <span className="text-xs text-zinc-500">이메일</span>
          <input
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
            placeholder="cafe@example.com"
            className="mt-1 h-9 w-full rounded-md border border-zinc-300 bg-white px-2.5 font-mono text-xs text-zinc-900 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/15"
          />
          {state.errors?.email && (
            <span className="mt-1 block text-xs text-rose-600">
              {state.errors.email.join(", ")}
            </span>
          )}
        </label>

        <label className="block">
          <span className="text-xs text-zinc-500">전화 (선택)</span>
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

        {state.ok && (
          <div
            className={`rounded-md px-2.5 py-2 text-xs ${
              state.mailed
                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
            }`}
          >
            {state.mailed
              ? `초대 메일을 ${state.emailedTo} 로 보냈습니다.`
              : "메일 발송에 실패했어요. 아래 링크를 카페 사장에게 직접 전달해 주세요."}
            {state.url && (
              <div className="mt-2 flex items-center gap-1.5">
                <input
                  readOnly
                  value={state.url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="h-8 w-full rounded border border-zinc-300 bg-white px-2 font-mono text-[11px] text-zinc-700"
                />
                <button
                  type="button"
                  onClick={() => copyUrl(state.url!)}
                  className="h-8 shrink-0 rounded border border-zinc-300 bg-white px-2.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  {copied ? "복사됨" : "복사"}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-9 items-center rounded-md bg-ink px-4 text-xs font-medium text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending
              ? "발송 중..."
              : exists
                ? "설정 링크 재발급"
                : "커피매니저 발급"}
          </button>
        </div>
      </form>
    </div>
  );
}
