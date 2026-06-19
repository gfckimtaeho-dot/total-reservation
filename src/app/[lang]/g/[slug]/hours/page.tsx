import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { OwnerShell } from "../OwnerShell";
import { HoursForm } from "./HoursForm";
import { ClosureManager } from "./ClosureManager";
import { ymd } from "@/lib/hours/status";

function fmtTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default async function GymHoursPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const auth = await requireGymStaff(slug);
  const business = auth.business!;
  const t = await getTranslations("hours");

  const [rows, closureRows] = await Promise.all([
    prisma.businessHours.findMany({ where: { gymId: business.id } }),
    prisma.businessClosure.findMany({
      where: { gymId: business.id },
      orderBy: { date: "asc" },
    }),
  ]);

  const initialDays = rows.map((r) => ({
    weekday: r.weekday,
    open: true,
    openTime: fmtTime(r.openMinute),
    closeTime: fmtTime(r.closeMinute),
    breakStartTime: r.breakStartMin != null ? fmtTime(r.breakStartMin) : "",
    breakEndTime: r.breakEndMin != null ? fmtTime(r.breakEndMin) : "",
  }));

  const initialClosures = closureRows.map((c) => ({
    id: c.id,
    date: ymd(c.date),
    kind: c.kind,
    openMinute: c.openMinute,
    closeMinute: c.closeMinute,
    reason: c.reason,
  }));

  return (
    <OwnerShell
      lang={lang}
      slug={slug}
      businessName={business.name}
      subtitle={t("pageTitle")}
    >
      <div className="mx-auto w-full max-w-6xl space-y-5 p-6">
        <HoursForm
          lang={lang}
          slug={slug}
          tone="indigo"
          initialDays={initialDays}
        />
        <ClosureManager
          lang={lang}
          slug={slug}
          tone="indigo"
          initialClosures={initialClosures}
        />
      </div>
    </OwnerShell>
  );
}
