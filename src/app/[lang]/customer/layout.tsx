// Customer surface — mobile-first.
// 90%+ of customers open this on a phone. Container caps at max-w-md,
// sticky bottom nav, single-column. Use md:/lg: only for tablet enhancements.
export default function CustomerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col">
      <main className="flex-1 px-4 pb-20 pt-6">{children}</main>
      <nav className="sticky bottom-0 z-10 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-black/95">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <button className="py-1">Browse</button>
          <button className="py-1">My Reservations</button>
          <button className="py-1">Settings</button>
        </div>
      </nav>
    </div>
  );
}
