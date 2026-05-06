import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";
import { getTheme } from "@/lib/theme";
import { MembersNormal } from "./MembersNormal";
import { MembersBlack } from "./MembersBlack";
import { MembersWhite } from "./MembersWhite";
import type { MemberView } from "./MemberRow";

export default async function GymMembersPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const auth = await requireGymStaff(slug);
  const business = auth.business!;
  const theme = await getTheme();

  const rows = await prisma.user.findMany({
    where: { gymId: business.id, role: "CUSTOMER" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      gender: true,
      phone: true,
      email: true,
      dob: true,
      note: true,
      emergencyContactPhone: true,
      status: true,
      createdAt: true,
    },
  });

  const members: MemberView[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    gender: r.gender as "MALE" | "FEMALE" | null,
    phone: r.phone,
    email: r.email,
    dob: r.dob ? r.dob.toISOString().slice(0, 10) : null,
    note: r.note,
    emergencyContactPhone: r.emergencyContactPhone,
    status: r.status as MemberView["status"],
    createdAt: r.createdAt.toISOString(),
  }));

  const props = {
    lang,
    slug,
    businessName: business.name,
    members,
  };

  if (theme === "black") return <MembersBlack {...props} />;
  if (theme === "white") return <MembersWhite {...props} />;
  return <MembersNormal {...props} />;
}
