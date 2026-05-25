import { verifySession } from "@/lib/auth/dal";
import { SidebarNav } from "./SidebarNav";

// /dashboard 세그먼트 전용 로딩 — 부모 [slug]/loading.tsx 를 오버라이드.
// 트레이너면 검정 스켈레톤을 렌더해 깜빡임 자체를 제거.

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

  return (
    <div className="flex min-h-screen bg-white">
      <aside className="hidden w-60 shrink-0 flex-col lg:flex border-r border-violet-100 bg-violet-50">
        <div className="border-b px-6 py-6 border-violet-100">
          <div className="h-3 w-16 animate-pulse rounded bg-zinc-100" />
          <div className="mt-2 h-5 w-32 animate-pulse rounded bg-zinc-100" />
          <div className="mt-1 h-3 w-20 animate-pulse rounded bg-zinc-100" />
        </div>
        <SidebarNav />
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <header className="flex items-center justify-between border-b px-8 py-5 border-zinc-100">
          <div>
            <div className="h-3 w-20 animate-pulse rounded bg-zinc-100" />
            <div className="mt-2 h-6 w-40 animate-pulse rounded bg-zinc-100" />
          </div>
        </header>

        <div className="mx-auto w-full max-w-5xl space-y-5 p-6">
          <div className="h-32 animate-pulse rounded-2xl bg-zinc-100" />
          <div className="h-48 animate-pulse rounded-2xl bg-zinc-100" />
          <div className="h-64 animate-pulse rounded-2xl bg-zinc-100" />
        </div>
      </main>
    </div>
  );
}
