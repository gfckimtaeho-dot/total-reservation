// Placeholder dashboard — populated in M4 with real KPI tiles + reservation table.
export default function BusinessDashboard() {
  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Today's reservations + KPI tiles arrive in M4. For now, M0 just verifies
        the desktop layout shell.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Today", value: "—" },
          { label: "This week", value: "—" },
          { label: "This month", value: "—" },
          { label: "Revenue (PHP)", value: "—" },
        ].map((tile) => (
          <div
            key={tile.label}
            className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div className="text-xs uppercase text-zinc-500">{tile.label}</div>
            <div className="mt-1 text-2xl font-semibold">{tile.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
