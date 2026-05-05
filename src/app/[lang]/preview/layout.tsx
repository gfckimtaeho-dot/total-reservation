// Preview routes — design variant playground. No auth, no DB. Mock data only.
// Delete after a variant is chosen and promoted to production dashboard.

export default function PreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-zinc-50">{children}</div>;
}
