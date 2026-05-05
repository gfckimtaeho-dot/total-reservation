import Link from "next/link";
import { LoginForm } from "./LoginForm";

export default async function AdminLoginPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

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
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
            ADMIN
          </span>
        </div>
      </header>

      <section className="bg-band">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-16 sm:py-20">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/70">
            Operator console
          </span>
          <h1 className="font-heading max-w-2xl text-4xl leading-[1.1] tracking-tight text-ink sm:text-5xl">
            관리자 로그인
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-ink/70 sm:text-base">
            가맹점 invite 발급·구독 승인·환불·차단 등 운영 권한이 있는 계정만 진입 가능합니다.
          </p>
        </div>
      </section>

      <main className="flex-1 bg-white">
        <div className="mx-auto w-full max-w-md px-6 py-16">
          <LoginForm />
        </div>
      </main>

      <footer className="border-t border-zinc-100 py-6 text-center text-xs text-zinc-500">
        © 2026 예약가즈아 · Philippines
      </footer>
    </div>
  );
}
