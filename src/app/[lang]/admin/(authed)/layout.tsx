import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { adminLogout } from "./actions";
import { AdminSidebar } from "./AdminSidebar";

export default async function AdminAuthedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  await requireAdmin();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-zinc-100">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link
            href={`/${lang}`}
            className="font-heading text-2xl tracking-tight text-ink"
          >
            예약가즈아
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
              ADMIN
            </span>
            <form action={adminLogout}>
              <button className="text-sm text-zinc-700 transition hover:text-ink">
                로그아웃
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="flex-1 bg-white">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-8 px-6 py-8 sm:py-10 lg:grid-cols-[200px_1fr]">
          <aside className="hidden lg:block">
            <AdminSidebar lang={lang} />
          </aside>
          <main className="min-w-0">{children}</main>
        </div>
      </div>

      <footer className="border-t border-zinc-100 py-6 text-center text-xs text-zinc-500">
        © 2026 예약가즈아 · Philippines
      </footer>
    </div>
  );
}
