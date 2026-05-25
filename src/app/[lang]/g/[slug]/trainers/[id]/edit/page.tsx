import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { logout } from "@/lib/auth/actions";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { SidebarNav } from "../../../dashboard/SidebarNav";
import {
  TrainerForm,
  type TrainerInitialValues,
} from "../../new/TrainerForm";

export default async function EditTrainerPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string; id: string }>;
}) {
  const { lang, slug, id } = await params;
  const auth = await requireGymStaff(slug);
  const business = auth.business!;
  const t = await getTranslations("trainerAdd");
  const tn = await getTranslations("nav");

  const staff = await prisma.staff.findFirst({
    where: { id, gymId: business.id },
    include: {
      user: true,
      images: { orderBy: { position: "asc" } },
    },
  });
  if (!staff) notFound();

  const u = staff.user;

  const initialValues: TrainerInitialValues = {
    name: u.name,
    gender: (u.gender ?? "MALE") as "MALE" | "FEMALE",
    phone: u.phone ?? "",
    email: u.email ?? "",
    dob: u.dob,
    emergencyContactPhone: u.emergencyContactPhone ?? "",
    role: (staff.role === "MANAGER" ? "MANAGER" : "TRAINER") as
      | "TRAINER"
      | "MANAGER",
    specialties: staff.specialties as (
      | "HEALTH"
      | "YOGA"
      | "PILATES"
      | "DANCE"
    )[],
    customSpecialty: staff.customSpecialty ?? "",
    bio: staff.bio ?? "",
    career: staff.career ?? "",
    weeklyOffDays: staff.weeklyOffDays as (
      | "SUN"
      | "MON"
      | "TUE"
      | "WED"
      | "THU"
      | "FRI"
      | "SAT"
    )[],
    workStartMin: staff.workStartMin,
    workEndMin: staff.workEndMin,
    breakStartMin: staff.breakStartMin,
    breakEndMin: staff.breakEndMin,
    monthlyBaseSalaryPhp: staff.monthlyBaseSalaryPhp,
    note: u.note ?? "",
    imageUrls: staff.images.map((img) => img.url),
    locale: u.locale,
  };

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
        <header className="flex items-center justify-between border-b px-8 py-5 border-violet-100">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
              TRAINERS
            </span>
            <h1 className="font-heading text-xl tracking-tight text-ink">
              {t("editTitle")} · {u.name}
            </h1>
          </div>
          <Link
            href={`/${lang}/g/${slug}/trainers/${id}`}
            className="text-sm transition text-zinc-600 hover:text-ink"
          >
            {t("editBack")}
          </Link>
        </header>

        <div className="mx-auto w-full max-w-5xl p-6">
          <TrainerForm
            slug={slug}
            lang={lang}
            tone="white"
            mode="edit"
            staffId={id}
            initialValues={initialValues}
          />
        </div>
      </main>
    </div>
  );
}
