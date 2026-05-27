import Link from "next/link";
import { notFound } from "next/navigation";
import { differenceInYears } from "date-fns";
import { getTranslations } from "next-intl/server";
import { logout } from "@/lib/auth/actions";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { SidebarNav } from "../../dashboard/SidebarNav";
import { MemberAddDialog } from "../MemberAddDialog";
import { OwnerIssuePanel } from "./OwnerIssuePanel";
import { HandoverDialog } from "../../handover/HandoverDialog";
import { PasswordResetButton } from "@/components/PasswordResetButton";
import { copyPasswordResetUrl } from "../actions";

const TK = {
  page: "bg-violet-50/40",
  sidebar: "border-r border-violet-100 bg-violet-50",
  border: "border-violet-100",
  label: "text-ink/60",
  name: "text-ink",
  headerBorder: "border-violet-100",
  section: "rounded-2xl bg-white ring-1 ring-violet-100 p-6",
  title: "text-ink",
  subtle: "text-zinc-600",
  pillActive: "bg-violet-100 text-violet-800",
  pillPending: "bg-amber-100 text-amber-800",
  rowBorder: "border-violet-100",
} as const;

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string; id: string }>;
}) {
  const { lang, slug, id } = await params;
  const auth = await requireGymStaff(slug);
  const business = auth.business!;
  const t = await getTranslations("memberDetail");
  const tn = await getTranslations("nav");
  const tc = await getTranslations("trainerCal");

  const [u, membershipPlans, packagePlans, comboPlans, promotionsRaw] =
    await Promise.all([
      prisma.user.findFirst({
        where: { id, gymId: business.id, role: "CUSTOMER" },
        select: {
          id: true,
          name: true,
          gender: true,
          phone: true,
          email: true,
          dob: true,
          emergencyContactPhone: true,
          note: true,
          status: true,
          locale: true,
          createdAt: true,
          memberships: {
            orderBy: { endDate: "desc" },
            select: {
              id: true,
              startDate: true,
              endDate: true,
              plan: { select: { name: true } },
            },
          },
          packages: {
            where: { refundedAt: null },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              totalCount: true,
              remainingCount: true,
              serviceId: true,
              service: { select: { name: true, capacity: true } },
              assignedStaff: {
                select: {
                  user: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      }),
      prisma.membershipPlan.findMany({
        where: { gymId: business.id, active: true },
        select: { id: true, name: true, pricePhp: true, durationDays: true },
        orderBy: { pricePhp: "asc" },
      }),
      prisma.packagePlan.findMany({
        where: {
          gymId: business.id,
          active: true,
          service: { active: true },
        },
        select: {
          id: true,
          name: true,
          pricePhp: true,
          sessionCount: true,
          service: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.comboPlan.findMany({
        where: { gymId: business.id, active: true },
        select: {
          id: true,
          name: true,
          pricePhp: true,
          membershipPlan: { select: { name: true } },
          packageItems: {
            select: { packagePlan: { select: { name: true } } },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      (async () => {
        const now = new Date();
        return prisma.promotion.findMany({
          where: {
            gymId: business.id,
            active: true,
            startsAt: { lte: now },
            endsAt: { gte: now },
          },
          select: {
            id: true,
            scope: true,
            targetId: true,
            discountType: true,
            discountValue: true,
          },
        });
      })(),
    ]);
  if (!u) notFound();

  const today = new Date();
  const age = u.dob ? differenceInYears(today, u.dob) : null;
  const dobStr = u.dob ? u.dob.toISOString().slice(0, 10) : null;
  const joinedStr = u.createdAt.toISOString().slice(0, 10);

  const statusLabel =
    u.status === "ACTIVE"
      ? t("statusActive")
      : u.status === "PENDING"
        ? t("statusPending")
        : t("statusWithdrawn");
  const statusPill =
    u.status === "ACTIVE" ? TK.pillActive : TK.pillPending;

  // 회원권 + 수업권을 한 표("보유 상품") 안에 보여줌. 구분 컬럼으로 종류 표시.
  type Holding = {
    id: string;
    kind: "MEMBERSHIP" | "PACKAGE_PERSONAL" | "PACKAGE_GROUP";
    item: string;
    info: string;
  };
  const order: Record<Holding["kind"], number> = {
    MEMBERSHIP: 0,
    PACKAGE_PERSONAL: 1,
    PACKAGE_GROUP: 2,
  };
  const holdings: Holding[] = [
    ...u.memberships.map((m) => ({
      id: m.id,
      kind: "MEMBERSHIP" as const,
      item: m.plan?.name ?? t("kindMembership"),
      info: `${m.startDate.toISOString().slice(0, 10)} ~ ${m.endDate
        .toISOString()
        .slice(0, 10)}`,
    })),
    ...u.packages.map((p) => ({
      id: p.id,
      kind: (p.service.capacity > 1
        ? "PACKAGE_GROUP"
        : "PACKAGE_PERSONAL") as Holding["kind"],
      item: p.service?.name ?? t("noValue"),
      info: `${p.remainingCount} / ${p.totalCount}`,
    })),
  ].sort((a, b) => order[a.kind] - order[b.kind]);
  function kindLabel(k: Holding["kind"]): string {
    if (k === "MEMBERSHIP") return t("kindMembership");
    if (k === "PACKAGE_GROUP") return t("kindPackageGroup");
    return t("kindPackagePersonal");
  }

  // 트레이너 양도 — 1:1 service 단위 group. capacity=1 만 양도 가능.
  type HandoverGroup = {
    serviceId: string;
    serviceName: string;
    activePackages: number;
    currentTrainerUserId: string | null;
    currentTrainerName: string | null;
    upcomingReservations: number;
  };
  const handoverGroupsMap = new Map<string, HandoverGroup>();
  for (const p of u.packages) {
    if (p.service.capacity !== 1) continue;
    if (p.remainingCount <= 0) continue;
    const g = handoverGroupsMap.get(p.serviceId);
    if (g) {
      g.activePackages += 1;
    } else {
      handoverGroupsMap.set(p.serviceId, {
        serviceId: p.serviceId,
        serviceName: p.service.name,
        activePackages: 1,
        currentTrainerUserId: p.assignedStaff?.user.id ?? null,
        currentTrainerName: p.assignedStaff?.user.name ?? null,
        upcomingReservations: 0,
      });
    }
  }
  // service 별 미래 예약 카운트 — 영향 요약용. handoverGroups 있을 때만 쿼리.
  if (handoverGroupsMap.size > 0) {
    const upcoming = await prisma.reservation.groupBy({
      by: ["serviceId"],
      where: {
        gymId: business.id,
        customerUserId: u.id,
        status: { in: ["CONFIRMED", "PENDING_PAYMENT"] },
        startAt: { gte: new Date() },
        serviceId: { in: Array.from(handoverGroupsMap.keys()) },
      },
      _count: true,
    });
    for (const row of upcoming) {
      const g = handoverGroupsMap.get(row.serviceId);
      if (g) g.upcomingReservations = row._count;
    }
  }
  const handoverGroups = Array.from(handoverGroupsMap.values());

  return (
    <div className={`flex min-h-screen ${TK.page}`}>
      <aside
        className={`hidden w-60 shrink-0 flex-col lg:flex ${TK.sidebar}`}
      >
        <div className={`border-b px-6 py-6 ${TK.border}`}>
          <span
            className={`text-xs font-semibold uppercase tracking-[0.22em] ${TK.label}`}
          >
            {tn("studio")}
          </span>
          <div
            className={`mt-1 font-heading text-lg tracking-tight ${TK.name}`}
          >
            {business.name}
          </div>
          <div className="mt-0.5 text-xs text-zinc-500">/g/{slug}</div>
        </div>
        <SidebarNav />
        <div className={`border-t px-3 py-4 ${TK.border}`}>
          <form action={logout.bind(null, `/${lang}/g/${slug}/login`)}>
            <button className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50">
              {tn("logout")}
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <header
          className={`flex items-center justify-between border-b px-8 py-5 ${TK.headerBorder}`}
        >
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
              {t("eyebrow")}
            </span>
            <h1
              className={`font-heading text-xl tracking-tight ${TK.title}`}
            >
              {u.name}{" "}
              <span
                className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium align-middle ${statusPill}`}
              >
                {statusLabel}
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {u.status === "ACTIVE" && (
              <PasswordResetButton
                slug={slug}
                id={u.id}
                idField="memberId"
                action={copyPasswordResetUrl}
                label={tc("passwordResetBtn")}
                copyLabel={tc("passwordResetCopy")}
                copiedLabel={tc("passwordResetCopied")}
                hint={tc("passwordResetHint")}
                sentLabel={tc("passwordResetSent")}
              />
            )}
            <MemberAddDialog
              slug={slug}
              lang={lang}
              mode="edit"
              member={{
                id: u.id,
                name: u.name,
                gender: u.gender as "MALE" | "FEMALE" | null,
                phone: u.phone,
                email: u.email,
                dob: dobStr,
                emergencyContactPhone: u.emergencyContactPhone,
                note: u.note,
                locale: u.locale as "en" | "ko",
              }}
            />
            <Link
              href={`/${lang}/g/${slug}/members`}
              className="text-sm transition text-zinc-600 hover:text-ink"
            >
              {t("back")}
            </Link>
          </div>
        </header>

        <div className="mx-auto w-full max-w-5xl space-y-5 p-6">
          {/* Basic */}
          <section className={TK.section}>
            <h2
              className={`font-heading text-2xl tracking-tight ${TK.title}`}
            >
              {t("basicHeading")}
            </h2>
            <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-5 text-base sm:grid-cols-3">
              <Cell
                label={t("labelGender")}
                value={
                  u.gender === "MALE"
                    ? t("genderMale")
                    : u.gender === "FEMALE"
                      ? t("genderFemale")
                      : t("noValue")
                }
              />
              <Cell
                label={t("labelAge")}
                value={age != null ? t("ageUnit", { age }) : t("noValue")}
              />
              <Cell label={t("labelDob")} value={dobStr ?? t("noValue")} />
              <Cell label={t("labelPhone")} value={u.phone ?? t("noValue")} />
              <Cell label={t("labelEmail")} value={u.email ?? t("noValue")} />
              <Cell
                label={t("labelEmergency")}
                value={u.emergencyContactPhone ?? t("noValue")}
              />
              <Cell
                label={t("labelLanguage")}
                value={
                  u.locale === "en" ? t("langEnglish") : t("langKorean")
                }
              />
              <Cell label={t("labelStatus")} value={statusLabel} />
              <Cell label={t("labelJoined")} value={joinedStr} />
            </dl>
            <div className="mt-5">
              <dt
                className={`text-xs font-semibold uppercase tracking-[0.18em] ${TK.subtle}`}
              >
                {t("labelNote")}
              </dt>
              <dd
                className={`mt-1 whitespace-pre-wrap text-base ${TK.title}`}
              >
                {u.note || t("noValue")}
              </dd>
            </div>
          </section>

          {/* 보유 상품 — 회원권 + 1:1 수업권 + 단체 수업권 통합 */}
          <section className={TK.section}>
            <h2
              className={`font-heading text-2xl tracking-tight ${TK.title}`}
            >
              {t("holdingsHeading")}
            </h2>
            {holdings.length === 0 ? (
              <p className={`mt-3 text-base ${TK.subtle}`}>
                {t("holdingsNone")}
              </p>
            ) : (
              <table className="mt-4 w-full text-base">
                <thead>
                  <tr className={`border-b ${TK.rowBorder}`}>
                    <th
                      className={`px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.18em] ${TK.subtle}`}
                    >
                      {t("colKind")}
                    </th>
                    <th
                      className={`px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.18em] ${TK.subtle}`}
                    >
                      {t("colItem")}
                    </th>
                    <th
                      className={`px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.18em] ${TK.subtle}`}
                    >
                      {t("colInfo")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h) => (
                    <tr
                      key={h.id}
                      className={`border-b ${TK.rowBorder}`}
                    >
                      <td
                        className={`px-3 py-3 text-left text-sm ${TK.subtle}`}
                      >
                        {kindLabel(h.kind)}
                      </td>
                      <td className={`px-3 py-3 text-left font-medium ${TK.title}`}>
                        {h.item}
                      </td>
                      <td
                        className={`px-3 py-3 text-center tabular-nums ${TK.title}`}
                      >
                        {h.info}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* 트레이너 담당 — 1:1 서비스만 양도. 단체 수업 제외. */}
          <section className={TK.section}>
            <h2
              className={`font-heading text-2xl tracking-tight ${TK.title}`}
            >
              {t("handoverHeading")}
            </h2>
            <p className={`mt-2 text-base ${TK.subtle}`}>
              {t("handoverHint")}
            </p>
            {handoverGroups.length === 0 ? (
              <p className={`mt-4 text-sm ${TK.subtle}`}>
                {t("handoverEmpty")}
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {handoverGroups.map((g) => (
                  <li
                    key={g.serviceId}
                    className="flex items-center justify-between gap-3 rounded-lg px-4 py-3 bg-white ring-1 ring-ink/10"
                  >
                    <div className="min-w-0">
                      <div className={`truncate text-sm font-semibold ${TK.title}`}>
                        {g.serviceName}
                      </div>
                      <div className={`mt-0.5 text-xs ${TK.subtle}`}>
                        {t("handoverCurrentLabel")}:{" "}
                        {g.currentTrainerName ?? "-"}
                      </div>
                    </div>
                    {g.currentTrainerUserId && (
                      <HandoverDialog
                        slug={slug}
                        customerId={u.id}
                        customerName={u.name}
                        serviceId={g.serviceId}
                        serviceName={g.serviceName}
                        fromStaffUserId={g.currentTrainerUserId}
                        fromStaffName={g.currentTrainerName ?? ""}
                        activePackages={g.activePackages}
                        upcomingReservations={g.upcomingReservations}
                        tone="light"
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 회원권 발급 — 회원관리 → 회원 row → 상세 → 그 자리에서 발급 완결 */}
          <section className={TK.section}>
            <h2
              className={`font-heading text-2xl tracking-tight ${TK.title}`}
            >
              {t("issueHeading")}
            </h2>
            <p className={`mt-2 text-base ${TK.subtle}`}>
              {t("issueHint")}
            </p>
            <div className="mt-4">
              <OwnerIssuePanel
                slug={slug}
                lang={lang}
                customer={{ id: u.id, name: u.name }}
                memberships={membershipPlans}
                packages={packagePlans.map((p) => ({
                  id: p.id,
                  name: p.name,
                  pricePhp: p.pricePhp,
                  sessionCount: p.sessionCount,
                  serviceName: p.service.name,
                }))}
                combos={comboPlans.map((c) => ({
                  id: c.id,
                  name: c.name,
                  pricePhp: c.pricePhp,
                  parts: [
                    ...(c.membershipPlan ? [c.membershipPlan.name] : []),
                    ...c.packageItems.map((it) => it.packagePlan.name),
                  ],
                }))}
                promotions={promotionsRaw}
              />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className={`text-xs font-semibold uppercase tracking-[0.18em] ${TK.subtle}`}>
        {label}
      </dt>
      <dd className={`mt-1 text-base font-medium ${TK.title}`}>{value}</dd>
    </div>
  );
}
