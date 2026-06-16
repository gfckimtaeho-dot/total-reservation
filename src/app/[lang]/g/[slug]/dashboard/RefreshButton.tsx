"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

// 사장/매니저 dashboard 헤더의 새로고침 버튼. router.refresh() 로 현재 라우트의
// 서버 컴포넌트(KPI/타임라인/캘린더/출입현황)를 페이지 리로드 없이 재실행한다.
// useTransition 의 isPending 으로 갱신 동안 아이콘을 회전시켜 진행 표시.
export function RefreshButton({ label }: { label: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={isPending}
      className="inline-flex items-center gap-2 rounded-xl bg-violet-50 px-4 py-2.5 text-sm font-semibold text-ink ring-1 ring-violet-200 transition hover:bg-violet-100 disabled:opacity-60"
    >
      <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
      {label}
    </button>
  );
}
