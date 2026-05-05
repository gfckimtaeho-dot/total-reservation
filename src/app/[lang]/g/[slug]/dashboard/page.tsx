import Link from "next/link";
import { headers } from "next/headers";
import { logout } from "@/lib/auth/actions";
import { requireGymStaff } from "@/lib/auth/dal";
import { PwaInstallCard } from "./PwaInstallCard";
import { NextVisitCard } from "./NextVisitCard";

export default async function GymDashboardPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const user = await requireGymStaff(slug);
  const business = user.business!;
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const base = `${proto}://${host}`;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-zinc-100">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link
            href={`/${lang}`}
            className="font-heading text-2xl tracking-tight text-ink"
          >
            {business.name}
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
              {user.role}
            </span>
            <span className="hidden text-sm text-zinc-700 sm:inline">
              {user.name}
            </span>
            <Link
              href={`/${lang}/g/${slug}/settings`}
              className="text-sm text-zinc-700 transition hover:text-ink"
            >
              설정
            </Link>
            <form action={logout.bind(null, `/${lang}/g/${slug}/login`)}>
              <button className="text-sm text-zinc-700 transition hover:text-ink">
                로그아웃
              </button>
            </form>
          </div>
        </div>
      </header>

      <section className="bg-band">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-16 sm:py-20">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/70">
            DASHBOARD · {business.slug}
          </span>
          <h1 className="font-heading max-w-3xl text-4xl leading-[1.1] tracking-tight text-ink sm:text-5xl">
            <span className="italic">환영합니다,</span> {business.name}.
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-ink/70">
            매장 가입이 완료됐습니다. 무료 체험 90일이 시작됐어요. 다음 단계로
            매장 사진·영업시간·트레이너·서비스를 채워주세요. 각 영역은 다음
            마일스톤에서 순차로 활성화됩니다.
          </p>
        </div>
      </section>

      <main className="flex-1 bg-white">
        <div className="mx-auto w-full max-w-5xl space-y-10 px-6 py-12 sm:py-16">
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <PendingCard label="매장 사진" body="최대 10장 업로드" />
            <PendingCard label="영업시간" body="요일별 + 휴게시간" />
            <PendingCard label="서비스" body="PT · 요가 · 단체 수업…" />
            <PendingCard label="트레이너" body="권한 + 사진 + 경력" />
            <PendingCard label="멤버십" body="출입권 발급" />
            <PendingCard label="예약" body="빈 시간 자동 계산" />
          </section>

          <NextVisitCard
            publicUrl={`${base}/${lang}/g/${slug}`}
            loginUrl={`${base}/${lang}/g/${slug}/login`}
            dashboardUrl={`${base}/${lang}/g/${slug}/dashboard`}
            ownerEmail={user.email}
          />

          <PwaInstallCard />
        </div>
      </main>

      <footer className="border-t border-zinc-100 py-6 text-center text-xs text-zinc-500">
        © 2026 예약가즈아 · /g/{business.slug}
      </footer>
    </div>
  );
}

function PendingCard({ label, body }: { label: string; body: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 transition hover:border-zinc-300">
      <h3 className="font-heading text-lg tracking-tight text-ink">{label}</h3>
      <p className="mt-1 text-sm text-zinc-600">{body}</p>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
        다음 마일스톤
      </p>
    </div>
  );
}
