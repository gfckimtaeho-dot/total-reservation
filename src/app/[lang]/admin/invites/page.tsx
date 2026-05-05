import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "@/lib/db/client";
import { requireAdmin } from "@/lib/auth/dal";
import { adminLogout, revokeInvite } from "./actions";
import { InviteForm } from "./InviteForm";

type InviteStatus = "pending" | "used" | "expired" | "revoked";

function statusOf(invite: {
  usedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}): InviteStatus {
  if (invite.revokedAt) return "revoked";
  if (invite.usedAt) return "used";
  if (invite.expiresAt < new Date()) return "expired";
  return "pending";
}

const STATUS_LABEL: Record<InviteStatus, string> = {
  pending: "사용 가능",
  used: "사용 완료",
  expired: "만료",
  revoked: "회수됨",
};

const STATUS_TONE: Record<InviteStatus, string> = {
  pending: "bg-emerald-100 text-emerald-800",
  used: "bg-zinc-200 text-zinc-700",
  expired: "bg-amber-100 text-amber-800",
  revoked: "bg-rose-100 text-rose-800",
};

export default async function AdminInvitesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  await requireAdmin();

  // Lazy cleanup: drop expired unused invites on every admin visit.
  // used/revoked invites are kept — they're per-business audit records
  // and don't affect operations downstream.
  await prisma.inviteToken.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
      usedAt: null,
      revokedAt: null,
    },
  });

  const invites = await prisma.inviteToken.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });

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
            오프라인으로 사장에게 컨택 후 invite 링크를 발급해 메일·메신저로 전달하세요. 사장이 7일 안에 링크로 진입해 매장 정보를 입력하면 가입이 완료됩니다.
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

          <section>
            <h2 className="font-heading mb-6 text-2xl tracking-tight text-ink">
              발급 이력
            </h2>
            {invites.length === 0 ? (
              <p className="text-sm text-zinc-500">
                아직 발급된 invite가 없습니다.
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white">
                {invites.map((iv) => {
                  const st = statusOf(iv);
                  const url = `${base}/ko/register?token=${iv.token}`;
                  return (
                    <li
                      key={iv.id}
                      className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex h-5 items-center rounded-full px-2 text-xs font-medium ${STATUS_TONE[st]}`}
                          >
                            {STATUS_LABEL[st]}
                          </span>
                          <span className="text-sm font-medium text-zinc-900">
                            {iv.expectedBusinessName ?? "(이름 메모 없음)"}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-500">
                          {iv.expectedOwnerEmail ?? "이메일 미기재"}
                          {iv.expectedOwnerPhone
                            ? ` · ${iv.expectedOwnerPhone}`
                            : ""}
                          {" · 만료 "}
                          {iv.expiresAt.toISOString().slice(0, 10)}
                        </div>
                        {st === "pending" && (
                          <code className="mt-1 block break-all text-xs text-zinc-700">
                            {url}
                          </code>
                        )}
                      </div>
                      {st === "pending" && (
                        <form action={revokeInvite}>
                          <input type="hidden" name="id" value={iv.id} />
                          <button className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3 text-xs text-zinc-800 transition hover:border-rose-400 hover:text-rose-700">
                            회수
                          </button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </main>

      <footer className="border-t border-zinc-100 py-6 text-center text-xs text-zinc-500">
        © 2026 예약가즈아 · Philippines
      </footer>
    </div>
  );
}
