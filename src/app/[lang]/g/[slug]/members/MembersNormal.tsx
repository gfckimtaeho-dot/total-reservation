import Link from "next/link";
import { logout } from "@/lib/auth/actions";
import { SidebarNav } from "../dashboard/SidebarNav";
import { MemberAddDialog } from "./MemberAddDialog";
import { MemberRow, type MemberView } from "./MemberRow";

type Props = {
  lang: string;
  slug: string;
  businessName: string;
  members: MemberView[];
};

export function MembersNormal({ lang, slug, businessName, members }: Props) {
  return (
    <div className="flex min-h-screen bg-amber-50/50">
      <aside className="hidden w-60 shrink-0 flex-col bg-band lg:flex">
        <div className="border-b border-ink/10 px-6 py-6">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/70">
            STUDIO
          </span>
          <div className="mt-1 font-heading text-lg tracking-tight text-ink">
            {businessName}
          </div>
          <div className="mt-0.5 text-xs text-ink/60">/g/{slug}</div>
        </div>
        <SidebarNav
          lang={lang}
          slug={slug}
          activeKey="members"
          tone="normal"
        />
        <div className="border-t border-ink/10 px-3 py-4">
          <form action={logout.bind(null, `/${lang}/g/${slug}/login`)}>
            <button className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-ink/80 hover:bg-white/40">
              로그아웃
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <header className="flex items-center justify-between border-b border-amber-200/60 px-8 py-5">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
              MEMBERS
            </span>
            <h1 className="font-heading text-xl tracking-tight text-ink">
              회원관리 · {members.length}명
            </h1>
          </div>
          <MemberAddDialog slug={slug} tone="normal" />
        </header>

        <div className="p-6">
          <div className="overflow-hidden rounded-2xl border border-amber-200/60 bg-white">
            {members.length === 0 ? (
              <EmptyState />
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-amber-200/60 bg-amber-50/40">
                    <Th>이름 / 메모</Th>
                    <Th>성별</Th>
                    <Th>핸드폰</Th>
                    <Th>이메일</Th>
                    <Th>상태</Th>
                    <Th>액션</Th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <MemberRow key={m.id} slug={slug} member={m} tone="normal" />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <footer className="border-t border-amber-200/60 bg-white/50 px-8 py-5 text-xs text-zinc-500">
          예약가즈아 · /g/{slug} ·{" "}
          <Link
            href={`/${lang}/g/${slug}/dashboard`}
            className="hover:text-ink"
          >
            ← 대시보드로
          </Link>
        </footer>
      </main>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/60">
      {children}
    </th>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-20">
      <div className="font-heading text-2xl tracking-tight text-ink">
        아직 등록된 회원이 없어요
      </div>
      <p className="max-w-md text-center text-sm text-zinc-600">
        오른쪽 위 <span className="font-medium text-ink">+ 회원 추가</span>{" "}
        버튼을 눌러 첫 회원을 등록하세요. 등록 후 이메일이 있으면 한 번 클릭으로
        설치 URL을 발송할 수 있습니다.
      </p>
    </div>
  );
}
