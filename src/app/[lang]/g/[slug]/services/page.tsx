import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { logout } from "@/lib/auth/actions";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { getTheme } from "@/lib/theme";
import { SidebarNav } from "../dashboard/SidebarNav";
import { ServiceForm } from "./ServiceForm";
import { DeleteServiceButton } from "./DeleteServiceButton";
import { EditServiceButton } from "./EditServiceButton";
import { ScheduleManager } from "./ScheduleManager";

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
  white: "border-zinc-100",
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

const TABLE_CARD = {
  normal: "bg-white/80 border-amber-200/60",
  black: "bg-zinc-900 border-white/5",
  white: "bg-white border-violet-100",
} as const;

const TABLE_HEAD = {
  normal: "text-ink/60 border-ink/10",
  black: "text-zinc-400 border-white/5",
  white: "text-violet-700 border-violet-100",
} as const;

const TABLE_ROW = {
  normal: "border-ink/5",
  black: "border-white/5",
  white: "border-zinc-100",
} as const;

const MARGIN_TONE = {
  normal: "text-emerald-700",
  black: "text-emerald-300",
  white: "text-emerald-600",
} as const;

const TYPE_BADGE_PERSONAL = {
  normal: "bg-ink/5 text-ink/80",
  black: "bg-white/5 text-zinc-300",
  white: "bg-zinc-100 text-zinc-700",
} as const;

const TYPE_BADGE_GROUP = {
  normal: "bg-amber-100 text-amber-800",
  black: "bg-lime-300/15 text-lime-300",
  white: "bg-amber-50 text-amber-700",
} as const;

export default async function GymServicesPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const auth = await requireGymStaff(slug);
  const business = auth.business!;
  const theme = await getTheme();
  const t = await getTranslations("services");
  const tn = await getTranslations("nav");

  const [services, staffRows] = await Promise.all([
    prisma.service.findMany({
      where: { gymId: business.id },
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
      // 단체 수업 강사 후보는 TRAINER만 — OWNER/MANAGER는 운영자라 제외.
      where: { gymId: business.id, role: "TRAINER" },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const staffOptions = staffRows.map((s) => ({
    id: s.id,
    name: s.user.name,
  }));

  const peso = (n: number) => `₱${n.toLocaleString()}`;

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

        <div className="mx-auto w-full max-w-5xl space-y-6 p-6">
          <ServiceForm slug={slug} tone={theme} />

          <section className={`rounded-2xl border ${TABLE_CARD[theme]}`}>
            <div
              className={`flex items-center justify-between border-b px-6 py-4 ${TABLE_HEAD[theme]}`}
            >
              <h2 className="font-heading text-base tracking-tight">
                {t("list.heading")}
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
                {t("list.empty")}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`border-b text-xs ${TABLE_HEAD[theme]}`}>
                      <th className="px-4 py-3 text-center font-medium">
                        {t("list.typeCol")}
                      </th>
                      <th className="px-4 py-3 text-center font-medium">
                        {t("list.nameCol")}
                      </th>
                      <th className="px-4 py-3 text-center font-medium">
                        {t("list.staffCol")}
                      </th>
                      <th className="px-4 py-3 text-center font-medium">
                        {t("list.durationCol")}
                      </th>
                      <th className="px-4 py-3 text-center font-medium">
                        {t("list.priceCol")}
                      </th>
                      <th className="px-4 py-3 text-center font-medium">
                        {t("list.payoutCol")}
                      </th>
                      <th className="px-4 py-3 text-center font-medium">
                        {t("list.marginCol")}
                      </th>
                      <th className="px-4 py-3 text-center font-medium">
                        {t("list.actionsCol")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.map((s) => {
                      const isPersonal = s.capacity === 1;
                      const margin = s.pricePhp - s.payoutPhp;
                      const badgeTone = isPersonal
                        ? TYPE_BADGE_PERSONAL[theme]
                        : TYPE_BADGE_GROUP[theme];
                      const badgeLabel = isPersonal
                        ? t("list.personal")
                        : t("list.groupCount", { count: s.capacity });
                      const trainerName =
                        !isPersonal && s.schedules.length > 0
                          ? (s.schedules[0]!.staff?.user.name ?? "")
                          : "";
                      return (
                        <tr
                          key={s.id}
                          className={`border-b ${TABLE_ROW[theme]}`}
                        >
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeTone}`}
                            >
                              {badgeLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-left font-medium">
                            {s.name}
                          </td>
                          <td className="px-4 py-3 text-left">
                            {trainerName || (
                              <span
                                className={
                                  theme === "black"
                                    ? "text-zinc-600"
                                    : "text-ink/40"
                                }
                              >
                                —
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {t("list.duration", { n: s.durationMin })}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {peso(s.pricePhp)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {peso(s.payoutPhp)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right tabular-nums font-medium ${MARGIN_TONE[theme]}`}
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
                                          user: { name: sc.staff.user.name },
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
        </div>
      </main>
    </div>
  );
}
