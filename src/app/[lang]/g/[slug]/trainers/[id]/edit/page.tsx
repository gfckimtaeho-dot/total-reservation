import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { logout } from "@/lib/auth/actions";
import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { getTheme } from "@/lib/theme";
import { SidebarNav } from "../../../dashboard/SidebarNav";
import {
  TrainerForm,
  type TrainerInitialValues,
} from "../../new/TrainerForm";

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

const LOGOUT_TEXT = {
  normal: "text-ink/80 hover:bg-white/40",
  black: "text-zinc-400 hover:bg-white/5",
  white: "text-zinc-700 hover:bg-zinc-50",
} as const;

export default async function EditTrainerPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string; id: string }>;
}) {
  const { lang, slug, id } = await params;
  const auth = await requireGymStaff(slug);
  const business = auth.business!;
  const theme = await getTheme();
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
              className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm ${LOGOUT_TEXT[theme]}`}
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
              className={`text-xs font-semibold uppercase tracking-[0.22em] ${
                theme === "black" ? "text-lime-300/80" : "text-ink/60"
              }`}
            >
              TRAINERS
            </span>
            <h1
              className={`font-heading text-xl tracking-tight ${TITLE[theme]}`}
            >
              {t("editTitle")} · {u.name}
            </h1>
          </div>
          <Link
            href={`/${lang}/g/${slug}/trainers/${id}`}
            className={`text-sm transition ${
              theme === "black"
                ? "text-zinc-400 hover:text-lime-300"
                : "text-zinc-600 hover:text-ink"
            }`}
          >
            {t("editBack")}
          </Link>
        </header>

        <div className="mx-auto w-full max-w-5xl p-6">
          <TrainerForm
            slug={slug}
            lang={lang}
            tone={theme}
            mode="edit"
            staffId={id}
            initialValues={initialValues}
          />
        </div>
      </main>
    </div>
  );
}
