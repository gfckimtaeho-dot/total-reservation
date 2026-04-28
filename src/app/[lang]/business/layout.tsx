// Business surface — desktop-first.
// 90%+ of business owners/staff use a laptop or desktop. Container caps at
// max-w-screen-2xl, sidebar nav on lg+, dense data layouts. Mobile collapses
// the sidebar to a drawer (M6 polish).
export default function BusinessLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-screen-2xl">
      <aside className="hidden w-60 shrink-0 border-r border-zinc-200 bg-zinc-50/50 p-6 lg:block dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="text-sm font-semibold">Business</div>
        <nav className="mt-6 space-y-1 text-sm">
          <div className="rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            Dashboard
          </div>
          <div className="rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            Reservations
          </div>
          <div className="rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            Services
          </div>
          <div className="rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            Shop
          </div>
          <div className="rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            Staff
          </div>
        </nav>
      </aside>
      <main className="flex-1 p-6 lg:p-8">{children}</main>
    </div>
  );
}
