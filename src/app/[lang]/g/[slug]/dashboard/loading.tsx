import { getTheme } from "@/lib/theme";
import { verifySession } from "@/lib/auth/dal";
import { SidebarNav } from "./SidebarNav";

// /dashboard 세그먼트 전용 로딩 — 부모 [slug]/loading.tsx 를 오버라이드.
// 버그 수정: 부모 로딩은 getTheme() 기반이라 트레이너(테마=normal)일 때
// suspend 시마다 normal 사장 대시보드 스켈레톤(사이드바+amber)이 깜빡였다가
// 검정 트레이너 화면으로 복귀 → "normal 갔다가 돌아옴" 증상. role을 보고
// 트레이너면 검정 스켈레톤을 렌더해 깜빡임 자체를 제거.

const PAGE_BG = {
  normal: "bg-amber-50/50",
  black: "bg-zinc-950 text-zinc-200",
  white: "bg-white",
} as const;

const SIDEBAR_BG = {
  normal: "bg-band",
  black: "bg-black",
  white: "border-r border-violet-100 bg-violet-50",
} as const;

const SIDEBAR_BORDER = {
  normal: "border-ink/10",
  black: "border-white/5",
  white: "border-violet-100",
} as const;

const HEADER_BORDER = {
  normal: "border-amber-200/60",
  black: "border-white/5",
  white: "border-zinc-100",
} as const;

const SKELETON = {
  normal: "bg-amber-100/70",
  black: "bg-zinc-800/70",
  white: "bg-zinc-100",
} as const;

function TrainerSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-black text-zinc-100">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <div className="h-5 w-28 animate-pulse rounded bg-zinc-800/70" />
          <div className="mt-2 h-3 w-40 animate-pulse rounded bg-zinc-800/70" />
        </div>
        <div className="h-7 w-20 animate-pulse rounded-md bg-zinc-800/70" />
      </header>
      <main className="flex-1 space-y-4 p-4">
        <div className="h-44 animate-pulse rounded-2xl bg-zinc-900 ring-1 ring-white/10" />
        <div className="h-72 animate-pulse rounded-2xl bg-zinc-900 ring-1 ring-white/10" />
      </main>
    </div>
  );
}

export default async function DashboardLoading() {
  const user = await verifySession();
  if (user?.role === "TRAINER") return <TrainerSkeleton />;

  const theme = await getTheme();
  return (
    <div className={`flex min-h-screen ${PAGE_BG[theme]}`}>
      <aside
        className={`hidden w-60 shrink-0 flex-col lg:flex ${SIDEBAR_BG[theme]}`}
      >
        <div className={`border-b px-6 py-6 ${SIDEBAR_BORDER[theme]}`}>
          <div className={`h-3 w-16 animate-pulse rounded ${SKELETON[theme]}`} />
          <div
            className={`mt-2 h-5 w-32 animate-pulse rounded ${SKELETON[theme]}`}
          />
          <div
            className={`mt-1 h-3 w-20 animate-pulse rounded ${SKELETON[theme]}`}
          />
        </div>
        <SidebarNav tone={theme} />
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <header
          className={`flex items-center justify-between border-b px-8 py-5 ${HEADER_BORDER[theme]}`}
        >
          <div>
            <div
              className={`h-3 w-20 animate-pulse rounded ${SKELETON[theme]}`}
            />
            <div
              className={`mt-2 h-6 w-40 animate-pulse rounded ${SKELETON[theme]}`}
            />
          </div>
        </header>

        <div className="mx-auto w-full max-w-5xl space-y-5 p-6">
          <div
            className={`h-32 animate-pulse rounded-2xl ${SKELETON[theme]}`}
          />
          <div
            className={`h-48 animate-pulse rounded-2xl ${SKELETON[theme]}`}
          />
          <div
            className={`h-64 animate-pulse rounded-2xl ${SKELETON[theme]}`}
          />
        </div>
      </main>
    </div>
  );
}
