// Placeholder browse — populated in M1 with real shop list + category filters.
export default function CustomerHome() {
  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Browse shops</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Shop list coming in M1 (Gym + Massage).
      </p>
      <ul className="mt-6 space-y-3">
        {[1, 2, 3].map((i) => (
          <li
            key={i}
            className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div className="text-sm font-medium">Placeholder shop #{i}</div>
            <div className="text-xs text-zinc-500">Category · City</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
