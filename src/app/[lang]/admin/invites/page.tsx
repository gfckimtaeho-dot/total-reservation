import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { adminLogout } from "./actions";
import { InviteForm } from "./InviteForm";

export default async function AdminInvitesPage({
  params,
}: {
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

      <section className="bg-band">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-12 sm:py-16">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/70">
            Invites
          </span>
          <h1 className="font-heading max-w-2xl text-4xl leading-[1.1] tracking-tight text-ink sm:text-5xl">
            매장 가입 invite 발급
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-ink/70 sm:text-base">
            오프라인으로 사장에게 컨택 후 invite 링크를 발급하세요. 발급 후 표시되는 메시지 본문을 그대로 카톡·문자·메일로 전달하면 됩니다. 사장이 7일 안에 링크로 진입해 매장 정보를 입력하면 가입이 완료됩니다.
          </p>
        </div>
      </section>

      <main className="flex-1 bg-white">
        <div className="mx-auto w-full max-w-5xl space-y-14 px-6 py-12 sm:py-16">
          <section>
            <h2 className="font-heading mb-6 text-2xl tracking-tight text-ink">
              새 invite 발급
            </h2>
            <InviteForm />
          </section>
        </div>
      </main>

      <footer className="border-t border-zinc-100 py-6 text-center text-xs text-zinc-500">
        © 2026 예약가즈아 · Philippines
      </footer>
    </div>
  );
}
