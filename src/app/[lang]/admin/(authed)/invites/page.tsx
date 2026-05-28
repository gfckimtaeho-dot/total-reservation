import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { baseUrl, cleanupExpiredInvites } from "./actions";
import { InviteForm } from "./InviteForm";
import { PendingInviteRow, VerticalLabel } from "./PendingInviteRow";

function inviteUrlFor(
  vertical: "GYM" | "HOTEL",
  token: string,
  gymBase: string,
  hotelBase: string,
): string {
  const base = vertical === "HOTEL" ? hotelBase : gymBase;
  return base ? `${base}/ko/register?token=${token}` : "";
}

const dateFmt = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function fmt(d: Date | null | undefined): string {
  if (!d) return "-";
  return dateFmt.format(d);
}

function responseHumanized(ms: number): string {
  const h = ms / (1000 * 60 * 60);
  if (h < 1) return `${Math.max(1, Math.round(ms / (1000 * 60)))}분`;
  if (h < 24) return `${Math.round(h * 10) / 10}시간`;
  return `${Math.round((h / 24) * 10) / 10}일`;
}

export default async function AdminInvitesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  await cleanupExpiredInvites();

  const [all, urlBase] = await Promise.all([
    prisma.inviteToken.findMany({
      include: {
        createdBusiness: { select: { name: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    baseUrl(),
  ]);
  const hotelBase = process.env.HOTEL_PUBLIC_BASE_URL?.trim() ?? "";

  const pending = all.filter((t) => !t.usedAt && !t.revokedAt);
  const used = all.filter((t) => !!t.usedAt);
  const revoked = all.filter((t) => !!t.revokedAt);

  const totalIssued = all.length;
  const converted = used.length;
  const conversionRate =
    totalIssued > 0 ? Math.round((converted / totalIssued) * 100) : 0;
  const avgResponseMs =
    used.length > 0
      ? used.reduce(
          (sum, t) => sum + (t.usedAt!.getTime() - t.createdAt.getTime()),
          0,
        ) / used.length
      : 0;
  const avgResponseLabel =
    used.length > 0 ? responseHumanized(avgResponseMs) : "-";

  return (
    <div className="space-y-12">
      <header className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/70">
          Invites
        </span>
        <h1 className="font-heading text-3xl tracking-tight text-ink sm:text-4xl">
          매장 가입 invite 발급
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-ink/70">
          오프라인으로 사장에게 컨택 후 invite 링크를 발급하세요. 발급 후 표시되는 메시지 본문을 그대로 카톡·문자·메일로 전달하면 됩니다. 사장이 7일 안에 링크로 진입해 매장 정보를 입력하면 가입이 완료됩니다.
        </p>
      </header>

      <section>
        <h2 className="font-heading mb-6 text-2xl tracking-tight text-ink">
          새 invite 발급
        </h2>
        <InviteForm />
      </section>

      <section>
        <h2 className="font-heading mb-4 text-2xl tracking-tight text-ink">
          발급 현황
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="총 발급" value={`${totalIssued}`} />
          <StatCard
            label="가입 전환"
            value={`${converted} (${conversionRate}%)`}
          />
          <StatCard label="평균 응답 시간" value={avgResponseLabel} />
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          만료(미사용+미회수)는 페이지 진입 시 자동 삭제되어 통계에 포함되지 않습니다. 사용·회수 invite는 영구 보존.
        </p>
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h3 className="font-heading text-xl tracking-tight text-ink">
            미사용 ({pending.length})
          </h3>
          <span className="text-xs text-zinc-500">
            만료 전 회수 가능
          </span>
        </div>
        {pending.length === 0 ? (
          <EmptyRow text="미사용 invite 없음" />
        ) : (
          <ul className="space-y-2">
            {pending.map((t) => (
              <PendingInviteRow
                key={t.id}
                id={t.id}
                url={inviteUrlFor(t.vertical, t.token, urlBase, hotelBase)}
                vertical={t.vertical}
                businessName={t.expectedBusinessName}
                ownerEmail={t.expectedOwnerEmail}
                ownerPhone={t.expectedOwnerPhone}
                createdAtLabel={fmt(t.createdAt)}
                expiresAtLabel={fmt(t.expiresAt)}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h3 className="font-heading text-xl tracking-tight text-ink">
            가입 완료 ({used.length})
          </h3>
        </div>
        {used.length === 0 ? (
          <EmptyRow text="가입 완료 invite 없음" />
        ) : (
          <ul className="space-y-2">
            {used.map((t) => {
              const responseMs = t.usedAt
                ? t.usedAt.getTime() - t.createdAt.getTime()
                : 0;
              return (
                <li
                  key={t.id}
                  className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink">
                          {t.createdBusiness?.name ??
                            t.expectedBusinessName ??
                            "(매장명 미입력)"}
                        </span>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-200">
                          가입 완료
                        </span>
                        <VerticalLabel vertical={t.vertical} />
                        {t.createdBusiness?.slug && t.vertical === "GYM" && (
                          <Link
                            href={`/${lang}/g/${t.createdBusiness.slug}`}
                            className="text-xs text-emerald-700 underline-offset-2 hover:underline"
                          >
                            /{t.createdBusiness.slug}
                          </Link>
                        )}
                      </div>
                      <div className="text-xs text-zinc-600">
                        {t.expectedOwnerEmail || "이메일 없음"}
                        {t.expectedOwnerPhone
                          ? ` · ${t.expectedOwnerPhone}`
                          : ""}
                      </div>
                      <div className="text-xs text-zinc-500">
                        발급 {fmt(t.createdAt)} · 가입 {fmt(t.usedAt)} · 응답 {responseHumanized(responseMs)}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h3 className="font-heading text-xl tracking-tight text-ink">
            회수 ({revoked.length})
          </h3>
        </div>
        {revoked.length === 0 ? (
          <EmptyRow text="회수 invite 없음" />
        ) : (
          <ul className="space-y-2">
            {revoked.map((t) => (
              <li
                key={t.id}
                className="rounded-xl border border-zinc-200 bg-zinc-50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-700 line-through decoration-zinc-400">
                        {t.expectedBusinessName || "(매장명 미입력)"}
                      </span>
                      <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-700">
                        회수
                      </span>
                      <VerticalLabel vertical={t.vertical} />
                    </div>
                    <div className="text-xs text-zinc-500">
                      {t.expectedOwnerEmail || "이메일 없음"}
                      {t.expectedOwnerPhone
                        ? ` · ${t.expectedOwnerPhone}`
                        : ""}
                    </div>
                    <div className="text-xs text-zinc-500">
                      발급 {fmt(t.createdAt)} · 회수 {fmt(t.revokedAt)}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/60">
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-ink">
        {value}
      </div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-500">
      {text}
    </div>
  );
}
