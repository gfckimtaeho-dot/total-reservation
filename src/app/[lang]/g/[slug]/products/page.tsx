import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { logout } from "@/lib/auth/actions";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { getTheme } from "@/lib/theme";
import { SidebarNav } from "../dashboard/SidebarNav";
import { MembershipPlanForm } from "./MembershipPlanForm";
import { EditMembershipButton } from "./EditMembershipButton";
import { DeleteMembershipButton } from "./DeleteMembershipButton";
import { ServiceForm } from "../services/ServiceForm";
import { EditServiceButton } from "../services/EditServiceButton";
import { DeleteServiceButton } from "../services/DeleteServiceButton";
import { ScheduleManager } from "../services/ScheduleManager";
import { PackagePlanForm } from "./PackagePlanForm";
import { EditPackageButton } from "./EditPackageButton";
import { DeletePackageButton } from "./DeletePackageButton";
import { ComboPlanForm } from "./ComboPlanForm";
import { EditComboButton } from "./EditComboButton";
import { DeleteComboButton } from "./DeleteComboButton";
import { PromotionForm } from "./PromotionForm";
import { EditPromotionButton } from "./EditPromotionButton";
import { DeletePromotionButton } from "./DeletePromotionButton";

type TabKey = "membership" | "service" | "package" | "combo" | "promotion";

const TAB_KEYS: TabKey[] = [
  "membership",
  "service",
  "package",
  "combo",
  "promotion",
];

const PAGE_BG = {
  normal: "bg-amber-50/50",
  black: "bg-zinc-950 text-zinc-200",
  white: "bg-white",
} as const;

const SIDEBAR_BG = {
  normal: "bg-band",
  black: "bg-black",
  white: "border-r border-violet-100 bg-violet-50",
} as const;

const SIDEBAR_BORDER = {
  normal: "border-ink/10",
  black: "border-white/5",
  white: "border-violet-100",
} as const;

const SIDEBAR_LABEL = {
  normal: "text-ink/70",
  black: "text-lime-300/80",
  white: "text-ink/60",
} as const;

const SIDEBAR_NAME = {
  normal: "text-ink",
  black: "text-white",
  white: "text-ink",
} as const;

const HEADER_BORDER = {
  normal: "border-amber-200/60",
  black: "border-white/5",
  white: "border-violet-100",
} as const;

const TITLE = {
  normal: "text-ink",
  black: "text-white",
  white: "text-ink",
} as const;

const EYEBROW = {
  normal: "text-ink/60",
  black: "text-lime-300/80",
  white: "text-ink/60",
} as const;

const TAB_ACTIVE = {
  normal: "bg-ink text-white",
  black: "bg-lime-300 text-zinc-950",
  white: "bg-violet-600 text-white",
} as const;

const TAB_INACTIVE = {
  normal: "text-ink/70 hover:bg-ink/5",
  black: "text-zinc-400 hover:bg-white/5",
  white: "text-zinc-600 hover:bg-zinc-100",
} as const;

// 탭별 목록 카드 색 — dashboard 멀티 파스텔 패턴. 각 카탈로그가 자기 정체성을 가짐.
// 회원권=violet-100, 수업=amber-50, 횟수권=sky-50, 콤보=violet-50, 이벤트=lime-50.
const LIST_CARD = {
  membership: {
    normal: "bg-white/80 border-amber-200/60",
    black: "bg-zinc-900 border-white/5",
    white: "bg-sky-50 border-sky-200/60",
  },
  service: {
    normal: "bg-white/80 border-amber-200/60",
    black: "bg-zinc-900 border-white/5",
    white: "bg-amber-50 border-amber-200/60",
  },
  package: {
    normal: "bg-white/80 border-amber-200/60",
    black: "bg-zinc-900 border-white/5",
    white: "bg-sky-50 border-sky-200/60",
  },
  combo: {
    normal: "bg-white/80 border-amber-200/60",
    black: "bg-zinc-900 border-white/5",
    white: "bg-violet-50 border-violet-200/60",
  },
  promotion: {
    normal: "bg-white/80 border-amber-200/60",
    black: "bg-zinc-900 border-white/5",
    white: "bg-lime-50 border-lime-200/60",
  },
} as const;

const LIST_HEAD = {
  membership: {
    normal: "text-ink/60 border-ink/10",
    black: "text-zinc-400 border-white/5",
    white: "text-sky-800 border-sky-200/60",
  },
  service: {
    normal: "text-ink/60 border-ink/10",
    black: "text-zinc-400 border-white/5",
    white: "text-amber-800 border-amber-200/60",
  },
  package: {
    normal: "text-ink/60 border-ink/10",
    black: "text-zinc-400 border-white/5",
    white: "text-sky-800 border-sky-200/60",
  },
  combo: {
    normal: "text-ink/60 border-ink/10",
    black: "text-zinc-400 border-white/5",
    white: "text-violet-800 border-violet-200/60",
  },
  promotion: {
    normal: "text-ink/60 border-ink/10",
    black: "text-zinc-400 border-white/5",
    white: "text-lime-800 border-lime-200/60",
  },
} as const;

const LIST_ROW = {
  membership: {
    normal: "border-ink/5",
    black: "border-white/5",
    white: "border-sky-200/40",
  },
  service: {
    normal: "border-ink/5",
    black: "border-white/5",
    white: "border-amber-200/40",
  },
  package: {
    normal: "border-ink/5",
    black: "border-white/5",
    white: "border-sky-200/40",
  },
  combo: {
    normal: "border-ink/5",
    black: "border-white/5",
    white: "border-violet-200/40",
  },
  promotion: {
    normal: "border-ink/5",
    black: "border-white/5",
    white: "border-lime-200/40",
  },
} as const;

const PILL_ACTIVE = {
  normal: "bg-emerald-100 text-emerald-800",
  black: "bg-lime-300/20 text-lime-300",
  white: "bg-emerald-100 text-emerald-700",
} as const;

const PILL_INACTIVE = {
  normal: "bg-zinc-100 text-zinc-500",
  black: "bg-zinc-800 text-zinc-500",
  white: "bg-zinc-100 text-zinc-500",
} as const;

const MARGIN_TONE = {
  normal: "text-emerald-700",
  black: "text-emerald-300",
  white: "text-emerald-600",
} as const;

const MARGIN_NEGATIVE = {
  normal: "text-rose-600",
  black: "text-rose-300",
  white: "text-rose-600",
} as const;

// 진행 중 vs 예정 vs 종료 — 이벤트 상태 색.
const STATE_BADGE = {
  upcoming: {
    normal: "bg-amber-100 text-amber-800",
    black: "bg-amber-300/20 text-amber-300",
    white: "bg-amber-100 text-amber-800",
  },
  active: {
    normal: "bg-emerald-100 text-emerald-800",
    black: "bg-lime-300/20 text-lime-300",
    white: "bg-emerald-100 text-emerald-700",
  },
  ended: {
    normal: "bg-zinc-100 text-zinc-500",
    black: "bg-zinc-800 text-zinc-500",
    white: "bg-zinc-100 text-zinc-500",
  },
} as const;

function pickTab(v: string | string[] | undefined): TabKey {
  const s = Array.isArray(v) ? v[0] : v;
  if (
    s === "membership" ||
    s === "service" ||
    s === "package" ||
    s === "combo" ||
    s === "promotion"
  ) {
    return s;
  }
  return "membership";
}

function fmtDate(d: Date, lang: string): string {
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function promotionState(
  p: { startsAt: Date; endsAt: Date; active: boolean },
  now: Date,
): "upcoming" | "active" | "ended" {
  if (!p.active || now >= p.endsAt) return "ended";
  if (now < p.startsAt) return "upcoming";
  return "active";
}

export default async function GymProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang, slug } = await params;
  const sp = await searchParams;
  const activeTab = pickTab(sp.tab);

  const auth = await requireGymStaff(slug);
  const business = auth.business!;
  const theme = await getTheme();
  const t = await getTranslations("products");
  const tn = await getTranslations("nav");
  const tsr = await getTranslations("services");

  // 탭별 데이터 — 보이는 탭 데이터만 조회. 다른 탭은 form select에 필요한
  // 최소 데이터(예: 횟수권 폼은 services list, 콤보 폼은 memberships+packages)는
  // 함께 fetch해야 함.
  const [
    membershipPlans,
    services,
    staffRows,
    packagePlans,
    comboPlans,
    promotions,
  ] = await Promise.all([
    prisma.membershipPlan.findMany({
      where: { gymId: business.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.service.findMany({
      where: { gymId: business.id, active: true },
      orderBy: { createdAt: "asc" },
      include: {
        schedules: {
          where: { active: true },
          orderBy: { startMinute: "asc" },
          include: {
            staff: { include: { user: { select: { name: true } } } },
          },
        },
      },
    }),
    prisma.staff.findMany({
      where: { gymId: business.id, role: "TRAINER" },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.packagePlan.findMany({
      where: { gymId: business.id, service: { active: true } },
      orderBy: { createdAt: "asc" },
      include: { service: true },
    }),
    prisma.comboPlan.findMany({
      where: { gymId: business.id },
      orderBy: { createdAt: "asc" },
      include: {
        membershipPlan: true,
        packageItems: {
          include: { packagePlan: { include: { service: true } } },
        },
      },
    }),
    prisma.promotion.findMany({
      where: { gymId: business.id },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const staffOptions = staffRows.map((s) => ({ id: s.id, name: s.user.name }));
  const peso = (n: number) => `₱${n.toLocaleString()}`;
  const now = new Date();

  return (
    <div className={`flex min-h-screen ${PAGE_BG[theme]}`}>
      <aside
        className={`hidden w-60 shrink-0 flex-col lg:flex ${SIDEBAR_BG[theme]}`}
      >
        <div className={`border-b px-6 py-6 ${SIDEBAR_BORDER[theme]}`}>
          <span
            className={`text-xs font-semibold uppercase tracking-[0.22em] ${SIDEBAR_LABEL[theme]}`}
          >
            {tn("studio")}
          </span>
          <div
            className={`mt-1 font-heading text-lg tracking-tight ${SIDEBAR_NAME[theme]}`}
          >
            {business.name}
          </div>
          <div
            className={`mt-0.5 text-xs ${
              theme === "normal" ? "text-ink/60" : "text-zinc-500"
            }`}
          >
            /g/{slug}
          </div>
        </div>
        <SidebarNav tone={theme} />
        <div className={`border-t px-3 py-4 ${SIDEBAR_BORDER[theme]}`}>
          <form action={logout.bind(null, `/${lang}/g/${slug}/login`)}>
            <button
              className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm ${
                theme === "black"
                  ? "text-zinc-400 hover:bg-white/5"
                  : theme === "white"
                    ? "text-zinc-700 hover:bg-zinc-50"
                    : "text-ink/80 hover:bg-white/40"
              }`}
            >
              {tn("logout")}
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <header
          className={`flex items-center justify-between border-b px-8 py-5 ${HEADER_BORDER[theme]}`}
        >
          <div>
            <span
              className={`text-xs font-semibold uppercase tracking-[0.22em] ${EYEBROW[theme]}`}
            >
              {t("eyebrow")}
            </span>
            <h1
              className={`font-heading text-xl tracking-tight ${TITLE[theme]}`}
            >
              {t("pageTitle")}
            </h1>
          </div>
          <Link
            href={`/${lang}/g/${slug}/dashboard`}
            className={`text-sm transition ${
              theme === "black"
                ? "text-zinc-400 hover:text-lime-300"
                : "text-zinc-600 hover:text-ink"
            }`}
          >
            {t("back")}
          </Link>
        </header>

        <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
          {/* 탭 nav */}
          <nav className="flex flex-wrap gap-1.5">
            {TAB_KEYS.map((tab) => {
              const isActive = tab === activeTab;
              return (
                <Link
                  key={tab}
                  href={`/${lang}/g/${slug}/products?tab=${tab}`}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                    isActive ? TAB_ACTIVE[theme] : TAB_INACTIVE[theme]
                  }`}
                >
                  {t(`tabs.${tab}`)}
                </Link>
              );
            })}
          </nav>

          {/* === 회원권 탭 === */}
          {activeTab === "membership" && (
            <>
              <MembershipPlanForm slug={slug} tone={theme} />

              <section
                className={`rounded-2xl border ${LIST_CARD.membership[theme]}`}
              >
                <div
                  className={`flex items-center justify-between border-b px-6 py-4 ${LIST_HEAD.membership[theme]}`}
                >
                  <h2 className="font-heading text-base tracking-tight">
                    {t("membership.listHeading")}
                  </h2>
                  <span className="text-xs">
                    {membershipPlans.length === 0
                      ? ""
                      : `${membershipPlans.length}`}
                  </span>
                </div>

                {membershipPlans.length === 0 ? (
                  <div
                    className={`px-6 py-12 text-center text-sm ${
                      theme === "black" ? "text-zinc-500" : "text-ink/50"
                    }`}
                  >
                    {t("membership.empty")}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr
                          className={`border-b text-xs ${LIST_HEAD.membership[theme]}`}
                        >
                          <th className="px-4 py-3 text-center font-medium">
                            {t("membership.colName")}
                          </th>
                          <th className="px-4 py-3 text-center font-medium">
                            {t("membership.colDuration")}
                          </th>
                          <th className="px-4 py-3 text-center font-medium">
                            {t("membership.colPrice")}
                          </th>
                          <th className="px-4 py-3 text-center font-medium">
                            {t("membership.colActive")}
                          </th>
                          <th className="px-4 py-3 text-center font-medium">
                            {t("membership.colActions")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {membershipPlans.map((p) => (
                          <tr
                            key={p.id}
                            className={`border-b ${LIST_ROW.membership[theme]}`}
                          >
                            <td className="px-4 py-3 text-left font-medium">
                              {p.name}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {p.durationDays.toLocaleString()}{" "}
                              {t("membership.durationUnit")}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums font-medium">
                              {peso(p.pricePhp)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  p.active
                                    ? PILL_ACTIVE[theme]
                                    : PILL_INACTIVE[theme]
                                }`}
                              >
                                {p.active
                                  ? t("membership.active")
                                  : t("membership.inactive")}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-3">
                                <EditMembershipButton
                                  slug={slug}
                                  plan={{
                                    id: p.id,
                                    name: p.name,
                                    durationDays: p.durationDays,
                                    pricePhp: p.pricePhp,
                                    active: p.active,
                                  }}
                                  tone={theme}
                                />
                                <DeleteMembershipButton
                                  slug={slug}
                                  planId={p.id}
                                  planName={p.name}
                                  tone={theme}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}

          {/* === 수업 서비스 탭 === */}
          {activeTab === "service" && (
            <>
              <ServiceForm slug={slug} tone={theme} />

              <section
                className={`rounded-2xl border ${LIST_CARD.service[theme]}`}
              >
                <div
                  className={`flex items-center justify-between border-b px-6 py-4 ${LIST_HEAD.service[theme]}`}
                >
                  <h2 className="font-heading text-base tracking-tight">
                    {tsr("list.heading")}
                  </h2>
                  <span className="text-xs">
                    {services.length === 0 ? "" : `${services.length}`}
                  </span>
                </div>

                {services.length === 0 ? (
                  <div
                    className={`px-6 py-12 text-center text-sm ${
                      theme === "black" ? "text-zinc-500" : "text-ink/50"
                    }`}
                  >
                    {tsr("list.empty")}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr
                          className={`border-b text-xs ${LIST_HEAD.service[theme]}`}
                        >
                          <th className="px-4 py-3 text-center font-medium">
                            {tsr("list.typeCol")}
                          </th>
                          <th className="px-4 py-3 text-center font-medium">
                            {tsr("list.nameCol")}
                          </th>
                          <th className="px-4 py-3 text-center font-medium">
                            {tsr("list.staffCol")}
                          </th>
                          <th className="px-4 py-3 text-center font-medium">
                            {tsr("list.durationCol")}
                          </th>
                          <th className="px-4 py-3 text-center font-medium">
                            {tsr("list.priceCol")}
                          </th>
                          <th className="px-4 py-3 text-center font-medium">
                            {tsr("list.payoutCol")}
                          </th>
                          <th className="px-4 py-3 text-center font-medium">
                            {tsr("list.marginCol")}
                          </th>
                          <th className="px-4 py-3 text-center font-medium">
                            {tsr("list.actionsCol")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {services.map((s) => {
                          const isPersonal = s.capacity === 1;
                          const margin = s.pricePhp - s.payoutPhp;
                          const trainerName =
                            !isPersonal && s.schedules.length > 0
                              ? (s.schedules[0]!.staff?.user.name ?? "")
                              : "";
                          return (
                            <tr
                              key={s.id}
                              className={`border-b ${LIST_ROW.service[theme]}`}
                            >
                              <td className="px-4 py-3 text-center">
                                <span
                                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                    isPersonal
                                      ? "bg-zinc-100 text-zinc-700"
                                      : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {isPersonal
                                    ? tsr("list.personal")
                                    : tsr("list.groupCount", { count: s.capacity })}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-left font-medium">
                                {s.name}
                              </td>
                              <td className="px-4 py-3 text-left">
                                {trainerName || (
                                  <span className="text-ink/40">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                {tsr("list.duration", { n: s.durationMin })}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                {peso(s.pricePhp)}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                {peso(s.payoutPhp)}
                              </td>
                              <td
                                className={`px-4 py-3 text-right tabular-nums font-medium ${
                                  margin >= 0
                                    ? MARGIN_TONE[theme]
                                    : MARGIN_NEGATIVE[theme]
                                }`}
                              >
                                {peso(margin)}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-1">
                                  {!isPersonal && (
                                    <ScheduleManager
                                      slug={slug}
                                      service={{
                                        id: s.id,
                                        name: s.name,
                                        durationMin: s.durationMin,
                                        capacity: s.capacity,
                                      }}
                                      schedules={s.schedules.map((sc) => ({
                                        id: sc.id,
                                        kind: sc.kind,
                                        weekdays: sc.weekdays,
                                        specificDate: sc.specificDate,
                                        startMinute: sc.startMinute,
                                        validFrom: sc.validFrom,
                                        validUntil: sc.validUntil,
                                        note: sc.note,
                                        staff: sc.staff
                                          ? {
                                              id: sc.staff.id,
                                              user: {
                                                name: sc.staff.user.name,
                                              },
                                            }
                                          : null,
                                      }))}
                                      staffOptions={staffOptions}
                                      tone={theme}
                                      lang={lang}
                                    />
                                  )}
                                  <EditServiceButton
                                    slug={slug}
                                    service={{
                                      id: s.id,
                                      name: s.name,
                                      capacity: s.capacity,
                                      durationMin: s.durationMin,
                                      pricePhp: s.pricePhp,
                                      payoutPhp: s.payoutPhp,
                                    }}
                                    tone={theme}
                                  />
                                  <DeleteServiceButton
                                    slug={slug}
                                    serviceId={s.id}
                                    serviceName={s.name}
                                    tone={theme}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}

          {/* === 횟수권 탭 === */}
          {activeTab === "package" && (
            <>
              <PackagePlanForm
                slug={slug}
                tone={theme}
                services={services.map((s) => ({
                  id: s.id,
                  name: s.name,
                  pricePhp: s.pricePhp,
                  payoutPhp: s.payoutPhp,
                  capacity: s.capacity,
                }))}
              />

              <section
                className={`rounded-2xl border ${LIST_CARD.package[theme]}`}
              >
                <div
                  className={`flex items-center justify-between border-b px-6 py-4 ${LIST_HEAD.package[theme]}`}
                >
                  <h2 className="font-heading text-base tracking-tight">
                    {t("package.listHeading")}
                  </h2>
                  <span className="text-xs">
                    {packagePlans.length === 0
                      ? ""
                      : `${packagePlans.length}`}
                  </span>
                </div>

                {packagePlans.length === 0 ? (
                  <div
                    className={`px-6 py-12 text-center text-sm ${
                      theme === "black" ? "text-zinc-500" : "text-ink/50"
                    }`}
                  >
                    {t("package.empty")}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr
                          className={`border-b text-xs ${LIST_HEAD.package[theme]}`}
                        >
                          <th className="px-4 py-3 text-center font-medium">
                            {t("package.colName")}
                          </th>
                          <th className="px-4 py-3 text-center font-medium">
                            {t("package.colService")}
                          </th>
                          <th className="px-4 py-3 text-center font-medium">
                            {t("package.colSessions")}
                          </th>
                          <th className="px-4 py-3 text-center font-medium">
                            {t("package.colPerSession")}
                          </th>
                          <th className="px-4 py-3 text-center font-medium">
                            {t("package.colPrice")}
                          </th>
                          <th className="px-4 py-3 text-center font-medium">
                            {t("package.colPayout")}
                          </th>
                          <th className="px-4 py-3 text-center font-medium">
                            {t("package.colMargin")}
                          </th>
                          <th className="px-4 py-3 text-center font-medium">
                            {t("package.colActive")}
                          </th>
                          <th className="px-4 py-3 text-center font-medium">
                            {t("package.colActions")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {packagePlans.map((p) => {
                          const payoutTotal =
                            p.service.payoutPhp * p.sessionCount;
                          const margin = p.pricePhp - payoutTotal;
                          const perSession = Math.round(
                            p.pricePhp / p.sessionCount,
                          );
                          return (
                            <tr
                              key={p.id}
                              className={`border-b ${LIST_ROW.package[theme]}`}
                            >
                              <td className="px-4 py-3 text-left font-medium">
                                {p.name}
                              </td>
                              <td className="px-4 py-3 text-left">
                                {p.service.name}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                {p.sessionCount}
                                {t("package.sessionUnit")}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                {peso(perSession)}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums font-medium">
                                {peso(p.pricePhp)}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                {peso(payoutTotal)}
                              </td>
                              <td
                                className={`px-4 py-3 text-right tabular-nums font-medium ${
                                  margin >= 0
                                    ? MARGIN_TONE[theme]
                                    : MARGIN_NEGATIVE[theme]
                                }`}
                              >
                                {peso(margin)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span
                                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                    p.active
                                      ? PILL_ACTIVE[theme]
                                      : PILL_INACTIVE[theme]
                                  }`}
                                >
                                  {p.active
                                    ? t("package.active")
                                    : t("package.inactive")}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-center gap-3">
                                  <EditPackageButton
                                    slug={slug}
                                    plan={{
                                      id: p.id,
                                      name: p.name,
                                      serviceId: p.serviceId,
                                      sessionCount: p.sessionCount,
                                      pricePhp: p.pricePhp,
                                      active: p.active,
                                    }}
                                    services={services.map((s) => ({
                                      id: s.id,
                                      name: s.name,
                                      pricePhp: s.pricePhp,
                                      payoutPhp: s.payoutPhp,
                                      capacity: s.capacity,
                                    }))}
                                    tone={theme}
                                  />
                                  <DeletePackageButton
                                    slug={slug}
                                    planId={p.id}
                                    planName={p.name}
                                    tone={theme}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}

          {/* === 콤보 탭 === */}
          {activeTab === "combo" && (
            <>
              <ComboPlanForm
                slug={slug}
                tone={theme}
                membershipPlans={membershipPlans.map((m) => ({
                  id: m.id,
                  name: m.name,
                  pricePhp: m.pricePhp,
                  durationDays: m.durationDays,
                  active: m.active,
                }))}
                packagePlans={packagePlans.map((p) => ({
                  id: p.id,
                  name: p.name,
                  pricePhp: p.pricePhp,
                  sessionCount: p.sessionCount,
                  servicePayoutPhp: p.service.payoutPhp,
                  serviceName: p.service.name,
                  active: p.active,
                }))}
              />

              <section
                className={`rounded-2xl border ${LIST_CARD.combo[theme]}`}
              >
                <div
                  className={`flex items-center justify-between border-b px-6 py-4 ${LIST_HEAD.combo[theme]}`}
                >
                  <h2 className="font-heading text-base tracking-tight">
                    {t("combo.listHeading")}
                  </h2>
                  <span className="text-xs">
                    {comboPlans.length === 0 ? "" : `${comboPlans.length}`}
                  </span>
                </div>

                {comboPlans.length === 0 ? (
                  <div
                    className={`px-6 py-12 text-center text-sm ${
                      theme === "black" ? "text-zinc-500" : "text-ink/50"
                    }`}
                  >
                    {t("combo.empty")}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr
                          className={`border-b text-xs ${LIST_HEAD.combo[theme]}`}
                        >
                          <th className="px-4 py-3 text-center font-medium">
                            {t("combo.colName")}
                          </th>
                          <th className="px-4 py-3 text-center font-medium">
                            {t("combo.colItems")}
                          </th>
                          <th className="px-4 py-3 text-center font-medium">
                            {t("combo.colListPrice")}
                          </th>
                          <th className="px-4 py-3 text-center font-medium">
                            {t("combo.colComboPrice")}
                          </th>
                          <th className="px-4 py-3 text-center font-medium">
                            {t("combo.colDiscount")}
                          </th>
                          <th className="px-4 py-3 text-center font-medium">
                            {t("combo.colPayout")}
                          </th>
                          <th className="px-4 py-3 text-center font-medium">
                            {t("combo.colMargin")}
                          </th>
                          <th className="px-4 py-3 text-center font-medium">
                            {t("combo.colActive")}
                          </th>
                          <th className="px-4 py-3 text-center font-medium">
                            {t("combo.colActions")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {comboPlans.map((c) => {
                          const listPrice =
                            (c.membershipPlan?.pricePhp ?? 0) +
                            c.packageItems.reduce(
                              (sum, item) => sum + item.packagePlan.pricePhp,
                              0,
                            );
                          const discount = listPrice - c.pricePhp;
                          const payoutTotal = c.packageItems.reduce(
                            (sum, item) =>
                              sum +
                              item.packagePlan.service.payoutPhp *
                                item.packagePlan.sessionCount,
                            0,
                          );
                          const margin = c.pricePhp - payoutTotal;
                          const itemChips = [
                            c.membershipPlan ? c.membershipPlan.name : null,
                            ...c.packageItems.map(
                              (item) => item.packagePlan.name,
                            ),
                          ].filter(Boolean) as string[];
                          return (
                            <tr
                              key={c.id}
                              className={`border-b ${LIST_ROW.combo[theme]}`}
                            >
                              <td className="px-4 py-3 text-left font-medium">
                                {c.name}
                              </td>
                              <td className="px-4 py-3 text-left">
                                <div className="flex flex-wrap gap-1">
                                  {itemChips.map((chip, i) => (
                                    <span
                                      key={i}
                                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                        theme === "white"
                                          ? "bg-violet-100 text-violet-700"
                                          : theme === "black"
                                            ? "bg-white/5 text-zinc-300"
                                            : "bg-ink/5 text-ink/80"
                                      }`}
                                    >
                                      {chip}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                <span className="line-through opacity-60">
                                  {peso(listPrice)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums font-medium">
                                {peso(c.pricePhp)}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                <span
                                  className={
                                    discount > 0
                                      ? "text-rose-600"
                                      : "text-zinc-500"
                                  }
                                >
                                  {discount > 0 ? `-${peso(discount)}` : "—"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                {peso(payoutTotal)}
                              </td>
                              <td
                                className={`px-4 py-3 text-right tabular-nums font-medium ${
                                  margin >= 0
                                    ? MARGIN_TONE[theme]
                                    : MARGIN_NEGATIVE[theme]
                                }`}
                              >
                                {peso(margin)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span
                                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                    c.active
                                      ? PILL_ACTIVE[theme]
                                      : PILL_INACTIVE[theme]
                                  }`}
                                >
                                  {c.active
                                    ? t("combo.active")
                                    : t("combo.inactive")}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-center gap-3">
                                  <EditComboButton
                                    slug={slug}
                                    plan={{
                                      id: c.id,
                                      name: c.name,
                                      membershipPlanId: c.membershipPlanId,
                                      pricePhp: c.pricePhp,
                                      active: c.active,
                                      packagePlanIds: c.packageItems.map(
                                        (item) => item.packagePlanId,
                                      ),
                                    }}
                                    membershipPlans={membershipPlans.map(
                                      (m) => ({
                                        id: m.id,
                                        name: m.name,
                                        pricePhp: m.pricePhp,
                                        durationDays: m.durationDays,
                                        active: m.active,
                                      }),
                                    )}
                                    packagePlans={packagePlans.map((p) => ({
                                      id: p.id,
                                      name: p.name,
                                      pricePhp: p.pricePhp,
                                      sessionCount: p.sessionCount,
                                      servicePayoutPhp: p.service.payoutPhp,
                                      serviceName: p.service.name,
                                      active: p.active,
                                    }))}
                                    tone={theme}
                                  />
                                  <DeleteComboButton
                                    slug={slug}
                                    planId={c.id}
                                    planName={c.name}
                                    tone={theme}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}

          {/* === 이벤트 탭 === */}
          {activeTab === "promotion" && (
            <>
              <PromotionForm
                slug={slug}
                tone={theme}
                membershipPlans={membershipPlans.map((m) => ({
                  id: m.id,
                  name: m.name,
                  pricePhp: m.pricePhp,
                }))}
                packagePlans={packagePlans.map((p) => ({
                  id: p.id,
                  name: p.name,
                  pricePhp: p.pricePhp,
                }))}
              />

              <section
                className={`rounded-2xl border ${LIST_CARD.promotion[theme]}`}
              >
                <div
                  className={`flex items-center justify-between border-b px-6 py-4 ${LIST_HEAD.promotion[theme]}`}
                >
                  <h2 className="font-heading text-base tracking-tight">
                    {t("promotion.listHeading")}
                  </h2>
                  <span className="text-xs">
                    {promotions.length === 0 ? "" : `${promotions.length}`}
                  </span>
                </div>

                {promotions.length === 0 ? (
                  <div
                    className={`px-6 py-12 text-center text-sm ${
                      theme === "black" ? "text-zinc-500" : "text-ink/50"
                    }`}
                  >
                    {t("promotion.empty")}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr
                          className={`border-b text-xs ${LIST_HEAD.promotion[theme]}`}
                        >
                          <th className="px-4 py-3 text-center font-medium">
                            {t("promotion.colName")}
                          </th>
                          <th className="px-4 py-3 text-center font-medium">
                            {t("promotion.colScope")}
                          </th>
                          <th className="px-4 py-3 text-center font-medium">
                            {t("promotion.colDiscount")}
                          </th>
                          <th className="px-4 py-3 text-center font-medium">
                            {t("promotion.colPeriod")}
                          </th>
                          <th className="px-4 py-3 text-center font-medium">
                            {t("promotion.colState")}
                          </th>
                          <th className="px-4 py-3 text-center font-medium">
                            {t("promotion.colActions")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {promotions.map((p) => {
                          const state = promotionState(p, now);
                          const discountLabel =
                            p.discountType === "PERCENT"
                              ? `${p.discountValue}%`
                              : peso(p.discountValue);
                          return (
                            <tr
                              key={p.id}
                              className={`border-b ${LIST_ROW.promotion[theme]}`}
                            >
                              <td className="px-4 py-3 text-left font-medium">
                                {p.name}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="text-xs">
                                  {t(`promotion.scope.${p.scope}`)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums font-medium text-rose-600">
                                -{discountLabel}
                              </td>
                              <td className="px-4 py-3 text-center text-xs tabular-nums">
                                {fmtDate(p.startsAt, lang)} ~{" "}
                                {fmtDate(p.endsAt, lang)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span
                                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATE_BADGE[state][theme]}`}
                                >
                                  {t(`promotion.state.${state}`)}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-center gap-3">
                                  <EditPromotionButton
                                    slug={slug}
                                    promotion={{
                                      id: p.id,
                                      name: p.name,
                                      scope: p.scope,
                                      targetId: p.targetId,
                                      discountType: p.discountType,
                                      discountValue: p.discountValue,
                                      startsAt: p.startsAt.toISOString(),
                                      endsAt: p.endsAt.toISOString(),
                                      active: p.active,
                                    }}
                                    membershipPlans={membershipPlans.map(
                                      (m) => ({
                                        id: m.id,
                                        name: m.name,
                                        pricePhp: m.pricePhp,
                                      }),
                                    )}
                                    packagePlans={packagePlans.map((pp) => ({
                                      id: pp.id,
                                      name: pp.name,
                                      pricePhp: pp.pricePhp,
                                    }))}
                                    tone={theme}
                                  />
                                  <DeletePromotionButton
                                    slug={slug}
                                    promotionId={p.id}
                                    promotionName={p.name}
                                    tone={theme}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
