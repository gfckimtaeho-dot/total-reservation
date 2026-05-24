// /me 영역 공통 로딩 shell — V18 Sunset Peach 톤. 각 page 의 loading.tsx 가
// 이 컴포넌트만 호출하면 됨. RSC stream 도중 흰 화면 대신 헤더 + 카드 골격을
// 보여줘 사용자가 "rendering 멈춤"으로 오해하지 않도록.
//
// rows prop 으로 본문 skeleton 카드 개수만 페이지마다 조정 (기본 3).

export function MeLoadingShell({ rows = 3 }: { rows?: number }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-orange-50 via-rose-50 to-amber-50 font-sans text-zinc-900">
      <div className="pointer-events-none absolute -top-32 left-1/4 h-[28rem] w-[28rem] rounded-full bg-orange-200/60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 right-0 h-[24rem] w-[28rem] rounded-full bg-rose-200/50 blur-3xl" />

      <header className="relative border-b border-orange-100">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-6 py-3">
          <div className="h-7 w-32 animate-pulse rounded-md bg-orange-100" />
          <div className="h-10 w-10 animate-pulse rounded-full bg-orange-100" />
        </div>
      </header>

      <main className="relative">
        <div className="mx-auto max-w-3xl space-y-2 px-6 py-6">
          {Array.from({ length: rows }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </main>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-orange-200/60 bg-white/90 p-5 backdrop-blur">
      <div className="flex items-baseline justify-between gap-3">
        <div className="h-7 w-40 animate-pulse rounded-md bg-orange-100" />
        <div className="h-6 w-20 animate-pulse rounded-md bg-orange-100" />
      </div>
      <div className="mt-2 h-4 w-56 animate-pulse rounded-md bg-orange-50" />
      <div className="mt-4 h-9 w-32 animate-pulse rounded-full bg-orange-50" />
    </div>
  );
}
