import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { logout } from "@/lib/auth/actions";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { SidebarNav } from "../dashboard/SidebarNav";
import { ServiceForm } from "./ServiceForm";
import { DeleteServiceButton } from "./DeleteServiceButton";
import { EditServiceButton } from "./EditServiceButton";
import { ScheduleManager } from "./ScheduleManager";

export default async function GymServicesPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const auth = await requireGymStaff(slug);
  const business = auth.business!;
  const t = await getTranslations("services");
  const tn = await getTranslations("nav");

  const [services, staffRows] = await Promise.all([
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
    <div className="flex min-h-screen bg-white">
      <aside className="hidden w-60 shrink-0 flex-col lg:flex border-r border-violet-100 bg-violet-50">
        <div className="border-b px-6 py-6 border-violet-100">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
            {tn("studio")}
          </span>
          <div className="mt-1 font-heading text-lg tracking-tight text-ink">
            {business.name}
          </div>
          <div className="mt-0.5 text-xs text-zinc-500">/g/{slug}</div>
        </div>
        <SidebarNav />
        <div className="border-t px-3 py-4 border-violet-100">
          <form action={logout.bind(null, `/${lang}/g/${slug}/login`)}>
            <button className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50">
              {tn("logout")}
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <header className="flex items-center justify-between border-b px-8 py-5 border-zinc-100">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
              {t("eyebrow")}
            </span>
            <h1 className="font-heading text-xl tracking-tight text-ink">
              {t("pageTitle")}
            </h1>
          </div>
          <Link
            href={`/${lang}/g/${slug}/dashboard`}
            className="text-sm transition text-zinc-600 hover:text-ink"
          >
            {t("back")}
          </Link>
        </header>

        <div className="mx-auto w-full max-w-5xl space-y-6 p-6">
          <ServiceForm slug={slug} tone="white" />

          <section className="rounded-2xl border bg-sky-50 border-sky-200/60">
            <div className="flex items-center justify-between border-b px-6 py-4 text-sky-800 border-sky-200/60">
              <h2 className="font-heading text-base tracking-tight">
                {t("list.heading")}
              </h2>
              <span className="text-xs">
                {services.length === 0 ? "" : `${services.length}`}
              </span>
            </div>

            {services.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-ink/50">
                {t("list.empty")}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-sky-800 border-sky-200/60">
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
                        ? "bg-zinc-100 text-zinc-700"
                        : "bg-amber-50 text-amber-700";
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
                          className="border-b border-sky-200/40"
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
                              <span className="text-ink/40">—</span>
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
                          <td className="px-4 py-3 text-right tabular-nums font-medium text-emerald-600">
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
                                  tone="white"
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
                                tone="white"
                              />
                              <DeleteServiceButton
                                slug={slug}
                                serviceId={s.id}
                                serviceName={s.name}
                                tone="white"
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
