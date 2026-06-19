import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { OwnerShell } from "../../../OwnerShell";
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
    <OwnerShell
      lang={lang}
      slug={slug}
      businessName={business.name}
      subtitle={`${t("editTitle")} · ${u.name}`}
      action={
        <Link
          href={`/${lang}/g/${slug}/trainers/${id}`}
          className="inline-flex items-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50"
        >
          {t("editBack")}
        </Link>
      }
    >
      <div className="mx-auto w-full max-w-5xl p-6">
        <TrainerForm
          slug={slug}
          lang={lang}
          tone="indigo"
          mode="edit"
          staffId={id}
          initialValues={initialValues}
        />
      </div>
    </OwnerShell>
  );
}
