import { logout } from "@/lib/auth/actions";
import { requireGymCustomer } from "@/lib/auth/dal";

export default async function CustomerHomePage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const user = await requireGymCustomer(slug);
  const business = user.business!;

  return (
    <div className="flex min-h-screen flex-col bg-amber-50/40">
      <header className="border-b border-amber-200/60 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
              {business.name}
            </span>
            <div className="font-heading text-lg tracking-tight text-ink">
              내 회원증
            </div>
          </div>
          <form action={logout.bind(null, `/${lang}/g/${slug}/login`)}>
            <button className="text-sm text-zinc-600 hover:text-ink">
              로그아웃
            </button>
          </form>
        </div>
      </header>

      <section className="bg-band">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-6 py-12">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/70">
            MEMBER · {business.name}
          </span>
          <h1 className="font-heading text-3xl leading-tight tracking-tight text-ink sm:text-4xl">
            <span className="italic">환영합니다,</span> {user.name} 님.
          </h1>
          <p className="text-sm leading-relaxed text-ink/70">
            {business.name}의 회원으로 등록되셨습니다. 예약·회원증·QR 출입은 다음 마일스톤에서 활성화됩니다.
          </p>
        </div>
      </section>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl space-y-4 px-6 py-12">
          <div className="rounded-2xl border border-amber-200/60 bg-white p-6">
            <h2 className="font-heading text-xl tracking-tight text-ink">
              내 정보
            </h2>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Row label="이름" value={user.name} />
              <Row
                label="성별"
                value={
                  user.gender === "MALE"
                    ? "남"
                    : user.gender === "FEMALE"
                      ? "여"
                      : "-"
                }
              />
              <Row label="핸드폰" value={user.phone ?? "-"} />
              <Row label="이메일" value={user.email ?? "-"} />
            </dl>
          </div>

          <div className="rounded-2xl bg-band/40 p-6 ring-1 ring-amber-200/60">
            <h3 className="font-heading text-lg tracking-tight text-ink">
              📌 폰 홈 화면에 추가하세요
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-700">
              브라우저 메뉴 → "홈 화면에 추가"를 누르면 앱처럼 한 번 클릭으로
              들어옵니다. iPhone(Safari): 공유 버튼 → 홈 화면에 추가. Android(Chrome): 메뉴 → 홈 화면에 추가.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-amber-200/60 bg-white py-6 text-center text-xs text-zinc-500">
        © 2026 예약가즈아 · /g/{slug}
      </footer>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </>
  );
}
