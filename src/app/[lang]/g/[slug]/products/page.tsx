import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { OwnerShell } from "../OwnerShell";
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

const TAB_ACTIVE = "bg-indigo-600 text-white";
const TAB_INACTIVE = "text-zinc-600 hover:bg-zinc-100";

// hybrid-c: 흰 카드 + 또렷한 zinc 테두리. 탭별 파스텔 정체성(폐기)을 평탄화.
const LIST_CARD = {
  membership: "bg-white border-zinc-200",
  service: "bg-white border-zinc-200",
  package: "bg-white border-zinc-200",
  combo: "bg-white border-zinc-200",
  promotion: "bg-white border-zinc-200",
} as const;

const LIST_HEAD = {
  membership: "text-zinc-900 border-zinc-200",
  service: "text-zinc-900 border-zinc-200",
  package: "text-zinc-900 border-zinc-200",
  combo: "text-zinc-900 border-zinc-200",
  promotion: "text-zinc-900 border-zinc-200",
} as const;

const LIST_ROW = {
  membership: "border-zinc-100",
  service: "border-zinc-100",
  package: "border-zinc-100",
  combo: "border-zinc-100",
  promotion: "border-zinc-100",
} as const;

const PILL_ACTIVE = "bg-emerald-100 text-emerald-700";
const PILL_INACTIVE = "bg-zinc-100 text-zinc-500";

const MARGIN_TONE = "text-emerald-600";
const MARGIN_NEGATIVE = "text-rose-600";

// 진행 중 vs 예정 vs 종료 — 이벤트 상태 색.
const STATE_BADGE = {
  upcoming: "bg-amber-100 text-amber-800",
  active: "bg-emerald-100 text-emerald-700",
  ended: "bg-zinc-100 text-zinc-500",
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

const SCHEDULE_WEEKDAY_ORDER = [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
] as const;

function fmtMinute(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(
    m % 60,
  ).padStart(2, "0")}`;
}

// 목록에서 "언제 하는 수업인지" 한눈에 — 요일+시각(정기) 또는 날짜+시각(단발).
function scheduleSummary(
  sc: {
    kind: string;
    weekdays: string[];
    specificDate: Date | null;
    startMinute: number;
  },
  wdShort: (w: string) => string,
  lang: string,
): string {
  const time = fmtMinute(sc.startMinute);
  if (sc.kind === "RECURRING") {
    const days = SCHEDULE_WEEKDAY_ORDER.filter((w) =>
      sc.weekdays.includes(w),
    )
      .map((w) => wdShort(w))
      .join("·");
    return `${days} ${time}`;
  }
  const dateStr = sc.specificDate
    ? new Intl.DateTimeFormat(lang === "en" ? "en-US" : "ko-KR", {
        month: "numeric",
        day: "numeric",
        timeZone: "UTC",
      }).format(sc.specificDate)
    : "";
  return `${dateStr} ${time}`.trim();
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
  const t = await getTranslations("products");
  const tsr = await getTranslations("services");

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
    <OwnerShell
      lang={lang}
      slug={slug}
      businessName={business.name}
      subtitle={t("pageTitle")}
    >
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
                    isActive ? TAB_ACTIVE : TAB_INACTIVE
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
              <MembershipPlanForm slug={slug} tone="indigo" />

              <section
                className={`rounded-2xl border ${LIST_CARD.membership}`}
              >
                <div
                  className={`flex items-center justify-between border-b px-6 py-4 ${LIST_HEAD.membership}`}
                >
                  <h2 className="text-base font-semibold tracking-tight">
                    {t("membership.listHeading")}
                  </h2>
                  <span className="text-xs">
                    {membershipPlans.length === 0
                      ? ""
                      : `${membershipPlans.length}`}
                  </span>
                </div>

                {membershipPlans.length === 0 ? (
                  <div className="px-6 py-12 text-center text-sm text-ink/50">
                    {t("membership.empty")}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr
                          className={`border-b text-xs ${LIST_HEAD.membership}`}
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
                            className={`border-b ${LIST_ROW.membership}`}
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
                                  p.active ? PILL_ACTIVE : PILL_INACTIVE
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
                                  tone="indigo"
                                />
                                <DeleteMembershipButton
                                  slug={slug}
                                  planId={p.id}
                                  planName={p.name}
                                  tone="indigo"
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
              <ServiceForm slug={slug} tone="indigo" />

              <section className={`rounded-2xl border ${LIST_CARD.service}`}>
                <div
                  className={`flex items-center justify-between border-b px-6 py-4 ${LIST_HEAD.service}`}
                >
                  <h2 className="text-base font-semibold tracking-tight">
                    {tsr("list.heading")}
                  </h2>
                  <span className="text-xs">
                    {services.length === 0 ? "" : `${services.length}`}
                  </span>
                </div>

                {services.length === 0 ? (
                  <div className="px-6 py-12 text-center text-sm text-ink/50">
                    {tsr("list.empty")}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr
                          className={`border-b text-xs ${LIST_HEAD.service}`}
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
                              className={`border-b ${LIST_ROW.service}`}
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
                                {!isPersonal && s.schedules.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {s.schedules.map((sc) => (
                                      <span
                                        key={sc.id}
                                        className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium tabular-nums text-amber-800"
                                      >
                                        {scheduleSummary(
                                          sc,
                                          (w) =>
                                            tsr(`schedule.weekdayShort.${w}`),
                                          lang,
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                )}
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
                                  margin >= 0 ? MARGIN_TONE : MARGIN_NEGATIVE
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
                                      tone="indigo"
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
                                    tone="indigo"
                                  />
                                  <DeleteServiceButton
                                    slug={slug}
                                    serviceId={s.id}
                                    serviceName={s.name}
                                    tone="indigo"
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

          {/* === 수업권 탭 === */}
          {activeTab === "package" && (
            <>
              <PackagePlanForm
                slug={slug}
                tone="indigo"
                services={services.map((s) => ({
                  id: s.id,
                  name: s.name,
                  pricePhp: s.pricePhp,
                  payoutPhp: s.payoutPhp,
                  capacity: s.capacity,
                }))}
              />

              <section className={`rounded-2xl border ${LIST_CARD.package}`}>
                <div
                  className={`flex items-center justify-between border-b px-6 py-4 ${LIST_HEAD.package}`}
                >
                  <h2 className="text-base font-semibold tracking-tight">
                    {t("package.listHeading")}
                  </h2>
                  <span className="text-xs">
                    {packagePlans.length === 0
                      ? ""
                      : `${packagePlans.length}`}
                  </span>
                </div>

                {packagePlans.length === 0 ? (
                  <div className="px-6 py-12 text-center text-sm text-ink/50">
                    {t("package.empty")}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr
                          className={`border-b text-xs ${LIST_HEAD.package}`}
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
                            {t("package.colListPrice")}
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
                          const listPrice =
                            p.service.pricePhp * p.sessionCount;
                          return (
                            <tr
                              key={p.id}
                              className={`border-b ${LIST_ROW.package}`}
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
                              <td className="px-4 py-3 text-right tabular-nums text-ink/60">
                                {peso(listPrice)}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums font-medium">
                                {peso(p.pricePhp)}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                {peso(payoutTotal)}
                              </td>
                              <td
                                className={`px-4 py-3 text-right tabular-nums font-medium ${
                                  margin >= 0 ? MARGIN_TONE : MARGIN_NEGATIVE
                                }`}
                              >
                                {peso(margin)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span
                                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                    p.active ? PILL_ACTIVE : PILL_INACTIVE
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
                                    tone="indigo"
                                  />
                                  <DeletePackageButton
                                    slug={slug}
                                    planId={p.id}
                                    planName={p.name}
                                    tone="indigo"
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
                tone="indigo"
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

              <section className={`rounded-2xl border ${LIST_CARD.combo}`}>
                <div
                  className={`flex items-center justify-between border-b px-6 py-4 ${LIST_HEAD.combo}`}
                >
                  <h2 className="text-base font-semibold tracking-tight">
                    {t("combo.listHeading")}
                  </h2>
                  <span className="text-xs">
                    {comboPlans.length === 0 ? "" : `${comboPlans.length}`}
                  </span>
                </div>

                {comboPlans.length === 0 ? (
                  <div className="px-6 py-12 text-center text-sm text-ink/50">
                    {t("combo.empty")}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr
                          className={`border-b text-xs ${LIST_HEAD.combo}`}
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
                              className={`border-b ${LIST_ROW.combo}`}
                            >
                              <td className="px-4 py-3 text-left font-medium">
                                {c.name}
                              </td>
                              <td className="px-4 py-3 text-left">
                                <div className="flex flex-wrap gap-1">
                                  {itemChips.map((chip, i) => (
                                    <span
                                      key={i}
                                      className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-indigo-100 text-indigo-700"
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
                                  margin >= 0 ? MARGIN_TONE : MARGIN_NEGATIVE
                                }`}
                              >
                                {peso(margin)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span
                                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                    c.active ? PILL_ACTIVE : PILL_INACTIVE
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
                                    tone="indigo"
                                  />
                                  <DeleteComboButton
                                    slug={slug}
                                    planId={c.id}
                                    planName={c.name}
                                    tone="indigo"
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
                tone="indigo"
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
                className={`rounded-2xl border ${LIST_CARD.promotion}`}
              >
                <div
                  className={`flex items-center justify-between border-b px-6 py-4 ${LIST_HEAD.promotion}`}
                >
                  <h2 className="text-base font-semibold tracking-tight">
                    {t("promotion.listHeading")}
                  </h2>
                  <span className="text-xs">
                    {promotions.length === 0 ? "" : `${promotions.length}`}
                  </span>
                </div>

                {promotions.length === 0 ? (
                  <div className="px-6 py-12 text-center text-sm text-ink/50">
                    {t("promotion.empty")}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr
                          className={`border-b text-xs ${LIST_HEAD.promotion}`}
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
                              className={`border-b ${LIST_ROW.promotion}`}
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
                                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATE_BADGE[state]}`}
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
                                    tone="indigo"
                                  />
                                  <DeletePromotionButton
                                    slug={slug}
                                    promotionId={p.id}
                                    promotionName={p.name}
                                    tone="indigo"
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
    </OwnerShell>
  );
}
