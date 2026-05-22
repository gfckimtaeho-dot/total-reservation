import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { requireGymCustomer } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { TrainerChangeFlow } from "./TrainerChangeFlow";

type T = (key: string, vars?: Record<string, string | number>) => string;

// 페이지 A — 트레이너 변경. 활성 트레이너 목록에서 새 담당을 고른다.
// 미래 예약 분류/확정은 클라이언트(TrainerChangeFlow) + 서버 액션이 처리.
export default async function TrainerChangePage({
  params,
}: {
  params: Promise<{ lang: string; slug: string; packageId: string }>;
}) {
  const { lang, slug, packageId } = await params;
  const user = await requireGymCustomer(slug);
  const business = user.business!;
  const t = (await getTranslations("me")) as unknown as T;
  // 전문분야 enum 라벨은 trainers 네임스페이스(specialty.*)를 공유.
  const ts = (await getTranslations("trainers")) as unknown as T;

  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
    select: {
      id: true,
      gymId: true,
      userId: true,
      assignedStaffId: true,
      service: { select: { name: true, capacity: true } },
      assignedStaff: {
        select: { user: { select: { name: true } } },
      },
    },
  });

  // 본인 소유 + 1:1 권만. 아니면 보유 서비스로 되돌림.
  if (
    !pkg ||
    pkg.gymId !== business.id ||
    pkg.userId !== user.id ||
    pkg.service.capacity !== 1
  ) {
    redirect(`/${lang}/g/${slug}/me/holdings`);
  }

  // 후보 트레이너 — 매장의 트레이너/매니저. 현재 담당은 제외. 계정
  // 활성화(user.status) 여부는 안 따짐 — 매장 근무 트레이너인지와 본인
  // 앱 계정 활성화는 별개라, 앱 전반의 staff 목록 컨벤션(role 로만 필터)
  // 을 따른다.
  const trainers = await prisma.staff.findMany({
    where: {
      gymId: business.id,
      role: { in: ["TRAINER", "MANAGER"] },
      ...(pkg.assignedStaffId ? { NOT: { id: pkg.assignedStaffId } } : {}),
    },
    select: {
      id: true,
      photoUrl: true,
      specialties: true,
      customSpecialty: true,
      career: true,
      bio: true,
      user: { select: { name: true } },
    },
    orderBy: { user: { name: "asc" } },
  });

  const currentTrainerName = pkg.assignedStaff?.user.name ?? null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute -top-32 left-1/4 h-[28rem] w-[28rem] rounded-full bg-rose-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 top-1/3 h-[24rem] w-[24rem] rounded-full bg-sky-400/15 blur-3xl" />

      <header className="relative border-b border-white/5">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-5">
          <Link
            href={`/${lang}/g/${slug}/me/holdings`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10"
            aria-label={t("trainerChangeBack")}
          >
            <ChevronLeft size={18} />
          </Link>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-200/90">
              {business.name}
            </div>
            <div className="mt-0.5 font-heading text-lg tracking-tight text-white">
              {t("trainerChangeTitle")}
            </div>
          </div>
        </div>
      </header>

      <main className="relative">
        <div className="mx-auto max-w-3xl space-y-5 px-6 py-6">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <div className="text-sm font-medium text-white">
              {pkg.service.name}
            </div>
            <div className="mt-1 text-xs text-zinc-400">
              {currentTrainerName
                ? t("trainerChangeCurrent", { name: currentTrainerName })
                : t("trainerChangeNoCurrent")}
            </div>
          </section>

          {trainers.length === 0 ? (
            <section className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-5 backdrop-blur-xl">
              <p className="text-sm text-amber-100">
                {t("trainerChangeNoTrainers")}
              </p>
            </section>
          ) : (
            <TrainerChangeFlow
              slug={slug}
              lang={lang}
              packageId={pkg.id}
              trainers={trainers.map((s) => ({
                id: s.id,
                name: s.user.name,
                photoUrl: s.photoUrl,
                specialties: [
                  ...s.specialties.map((x) => ts(`specialty.${x}`)),
                  ...(s.customSpecialty ? [s.customSpecialty] : []),
                ],
                career: s.career,
                bio: s.bio,
              }))}
            />
          )}
        </div>
      </main>
    </div>
  );
}
