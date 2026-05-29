"use client";

import { useActionState, useState } from "react";
import {
  addAffiliation,
  toggleAffiliation,
  type AffiliationState,
} from "./affiliationActions";

const initialState: AffiliationState = {};

type Affiliation = {
  id: string;
  hotelId: string;
  hotelName: string | null;
  active: boolean;
};

type HotelOption = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

type Props = {
  gymId: string;
  affiliations: Affiliation[];
  availableHotels: HotelOption[];
};

// 헬스장 게스트 출입 제휴 호텔 관리. InfoCard 비주얼 직접 렌더(상세 페이지 grid 밖,
// 풀폭). 추가(드롭다운+버튼) + 행별 활성/비활성 토글.
export function AffiliationManager({
  gymId,
  affiliations,
  availableHotels,
}: Props) {
  const [state, formAction, pending] = useActionState(
    addAffiliation,
    initialState,
  );
  const [hotelId, setHotelId] = useState("");

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink/60">
        제휴 호텔 (게스트 출입)
      </div>
      <p className="mb-4 text-xs text-zinc-500">
        제휴된 호텔의 투숙객은 체크인~체크아웃 기간 동안 이 헬스장 QR 출입이
        허용됩니다. 비활성으로 바꾸면 즉시 차단됩니다.
      </p>

      {affiliations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-3 py-4 text-center text-xs text-zinc-500">
          제휴된 호텔이 없습니다.
        </div>
      ) : (
        <ul className="space-y-2">
          {affiliations.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-zinc-900">
                  {a.hotelName ?? "(이름 없음)"}
                </div>
                <div className="truncate font-mono text-[11px] text-zinc-400">
                  {a.hotelId}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${
                    a.active
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                      : "bg-zinc-100 text-zinc-500 ring-zinc-300"
                  }`}
                >
                  {a.active ? "활성" : "비활성"}
                </span>
                <form action={toggleAffiliation}>
                  <input type="hidden" name="affiliationId" value={a.id} />
                  <input type="hidden" name="gymId" value={gymId} />
                  <button
                    type="submit"
                    className="inline-flex h-8 items-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                  >
                    {a.active ? "비활성화" : "활성화"}
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="mt-4 border-t border-zinc-200 pt-4">
        <input type="hidden" name="gymId" value={gymId} />
        <span className="text-xs text-zinc-500">제휴 호텔 추가</span>
        <div className="mt-1 flex items-center gap-2">
          <select
            name="hotelId"
            value={hotelId}
            onChange={(e) => setHotelId(e.target.value)}
            className="h-9 min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2.5 text-sm text-zinc-900 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/15"
          >
            <option value="">호텔 선택...</option>
            {availableHotels.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} (/{h.slug}){h.status === "BLOCKED" ? " - 차단됨" : ""}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending || !hotelId}
            className="inline-flex h-9 shrink-0 items-center rounded-md bg-ink px-4 text-xs font-medium text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "추가 중..." : "제휴 추가"}
          </button>
        </div>
        {availableHotels.length === 0 && (
          <p className="mt-2 text-xs text-zinc-400">
            추가할 수 있는 호텔이 없습니다. (모든 호텔이 이미 제휴됨)
          </p>
        )}
        {state.errors?.hotelId && (
          <span className="mt-1 block text-xs text-rose-600">
            {state.errors.hotelId.join(", ")}
          </span>
        )}
        {state.message && (
          <div className="mt-2 rounded-md bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700">
            {state.message}
          </div>
        )}
      </form>
    </div>
  );
}
