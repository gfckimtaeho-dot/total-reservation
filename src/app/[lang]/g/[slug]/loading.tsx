import { verifySession } from "@/lib/auth/dal";
import { SidebarNav } from "./dashboard/SidebarNav";

// 트레이너는 테마 쿠키가 보통 normal이라, 공용 로딩이 normal 사장 스켈레톤을
// 깜빡였다 검정 트레이너 화면으로 복귀하는 "왔다 갔다" 증상을 냈다.
// 어떤 라우트의 suspense든 트레이너면 검정 스켈레톤만 보이게 차단.
function TrainerSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-black text-zinc-100">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <div className="h-5 w-28 animate-pulse rounded bg-zinc-800/70" />
          <div className="mt-2 h-3 w-40 animate-pulse rounded bg-zinc-800/70" />
        </div>
        <div className="h-7 w-28 animate-pulse rounded-md bg-zinc-800/70" />
      </header>
      <main className="flex-1 space-y-4 p-4">
        <div className="h-44 animate-pulse rounded-2xl bg-zinc-900 ring-1 ring-white/10" />
        <div className="h-72 animate-pulse rounded-2xl bg-zinc-900 ring-1 ring-white/10" />
      </main>
    </div>
  );
}

export default async function GymLoading() {
  const user = await verifySession();
  if (user?.role === "TRAINER") return <TrainerSkeleton />;

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-200 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <div className="h-5 w-32 animate-pulse rounded bg-zinc-100" />
            <div className="h-4 w-40 animate-pulse rounded bg-zinc-100" />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="h-9 w-24 animate-pulse rounded-lg bg-zinc-100" />
            <div className="h-9 w-20 animate-pulse rounded-lg bg-zinc-100" />
          </div>
        </div>
        <div className="mt-3">
          <SidebarNav orientation="top" />
        </div>
      </header>

      <main className="overflow-x-hidden">
        <div className="space-y-5 p-6">
          <div className="h-28 animate-pulse rounded-2xl bg-zinc-100" />
          <div className="h-48 animate-pulse rounded-2xl bg-zinc-100" />
          <div className="h-64 animate-pulse rounded-2xl bg-zinc-100" />
        </div>
      </main>
    </div>
  );
}
