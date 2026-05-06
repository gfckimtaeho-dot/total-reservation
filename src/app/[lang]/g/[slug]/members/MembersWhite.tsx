import Link from "next/link";
import { logout } from "@/lib/auth/actions";
import { SidebarNav } from "../dashboard/SidebarNav";
import { MemberAddDialog } from "./MemberAddDialog";
import { MemberRow, type MemberView } from "./MemberRow";
import { MembersSearch } from "./MembersSearch";

type Props = {
  lang: string;
  slug: string;
  businessName: string;
  members: MemberView[];
  q: string;
  gender: "all" | "MALE" | "FEMALE";
  expiringSoon: boolean;
};

export function MembersWhite({
  lang,
  slug,
  businessName,
  members,
  q,
  gender,
  expiringSoon,
}: Props) {
  const filtered = Boolean(q) || gender !== "all" || expiringSoon;

  return (
    <div className="flex min-h-screen bg-white">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-zinc-100 bg-white lg:flex">
        <div className="border-b border-zinc-100 px-6 py-6">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
            STUDIO
          </span>
          <div className="mt-1 font-heading text-lg tracking-tight text-ink">
            {businessName}
          </div>
          <div className="mt-0.5 text-xs text-zinc-500">/g/{slug}</div>
        </div>
        <SidebarNav lang={lang} slug={slug} activeKey="members" tone="white" />
        <div className="border-t border-zinc-100 px-3 py-4">
          <form action={logout.bind(null, `/${lang}/g/${slug}/login`)}>
            <button className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50">
              로그아웃
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <header className="flex items-center justify-between border-b border-zinc-100 px-8 py-5">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
              MEMBERS
            </span>
            <h1 className="font-heading text-xl tracking-tight text-ink">
              회원관리 · {members.length}명
              {filtered && (
                <span className="ml-2 text-sm font-normal text-zinc-500">
                  (필터됨)
                </span>
              )}
            </h1>
          </div>
          <MemberAddDialog slug={slug} tone="white" />
        </header>

        <div className="p-6">
          <MembersSearch
            tone="white"
            q={q}
            gender={gender}
            expiringSoon={expiringSoon}
          />
          <div className="overflow-hidden rounded-2xl bg-sky-50 p-2 ring-1 ring-sky-200/50">
            <div className="overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200">
              {members.length === 0 ? (
                <EmptyState filtered={filtered} />
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-sky-50/60">
                      <Th>회원이름</Th>
                      <Th>나이</Th>
                      <Th>전화번호</Th>
                      <Th>멤버십 만료일</Th>
                      <Th>잔여 수업권</Th>
                      <Th>액션</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <MemberRow
                        key={m.id}
                        slug={slug}
                        member={m}
                        tone="white"
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <footer className="border-t border-zinc-100 px-8 py-5 text-xs text-zinc-500">
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

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-20">
      <div className="font-heading text-2xl tracking-tight text-ink">
        {filtered ? "조건에 맞는 회원이 없어요" : "아직 등록된 회원이 없어요"}
      </div>
      <p className="max-w-md text-center text-sm text-zinc-600">
        {filtered ? (
          <>
            검색 조건을 바꾸거나{" "}
            <a href="?" className="underline hover:text-ink">
              초기화
            </a>{" "}
            해 보세요.
          </>
        ) : (
          <>
            오른쪽 위 <span className="font-medium text-ink">+ 회원 추가</span>{" "}
            버튼을 눌러 첫 회원을 등록하세요.
          </>
        )}
      </p>
    </div>
  );
}
