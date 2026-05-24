import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireGymStaff } from "@/lib/auth/dal";
import { listMyAssignedCustomers } from "@/app/[lang]/g/[slug]/dashboard/service-actions";
import { MyClientsList } from "./MyClientsList";

type Row = {
  id: string;
  name: string;
  phone: string | null;
  services: { name: string; isGroup: boolean; remaining: number }[];
};

// 트레이너 본인 담당 고객 리스트 — listMyAssignedCustomers 재활용.
// 200 명까진 한 번에 SSR(매장 평균보다 충분히 큼). 검색은 client filter.
// 운영 톤(다크) — dashboard 와 통일.
export default async function MyClientsPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  await requireGymStaff(slug);
  const t = await getTranslations("dashboard");

  const r = await listMyAssignedCustomers({ slug, limit: 200 });
  const rows: Row[] = r.ok
    ? ((r.data as { rows: Row[] }).rows ?? [])
    : [];
  rows.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-x-0 -top-20 h-[40rem] bg-gradient-to-b from-purple-700/30 via-pink-500/15 to-transparent" />
      <div className="pointer-events-none absolute -right-40 top-1/4 h-[28rem] w-[28rem] rounded-full bg-emerald-500/15 blur-3xl" />

      <header className="relative flex items-center gap-3 border-b border-white/5 px-5 py-3">
        <h1 className="font-heading truncate text-2xl font-bold tracking-tight text-white">
          {t("myClientsTitle")}
        </h1>
        <span className="ml-auto rounded-full bg-white/5 px-2.5 py-1 text-xs tabular-nums text-zinc-400 ring-1 ring-white/10">
          {rows.length}
        </span>
        <Link
          href={`/${lang}/g/${slug}/dashboard`}
          className="shrink-0 rounded-md border border-white/15 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/5"
        >
          {t("myClientsBack")}
        </Link>
      </header>

      <main className="relative flex-1 p-4">
        <MyClientsList rows={rows} lang={lang} slug={slug} />
      </main>
    </div>
  );
}
