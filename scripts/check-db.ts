import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("=== Businesses ===");
  const businesses = await prisma.business.findMany({
    include: {
      city: true,
      barangay: true,
      users: {
        select: { email: true, name: true, role: true, status: true },
      },
      staff: { select: { role: true } },
      subscription: true,
    },
    orderBy: { createdAt: "desc" },
  });
  if (businesses.length === 0) {
    console.log("(none)");
  }
  for (const b of businesses) {
    console.log(
      `- ${b.name}\n    slug:${b.slug}  category:${b.category}  status:${b.status}\n    위치: ${b.city.name} / ${b.barangay.name}\n    phone: ${b.phone}\n    users: ${b.users.map((u) => `${u.role}:${u.email}(${u.status})`).join(", ")}\n    staff: ${b.staff.map((s) => s.role).join(", ")}\n    subscription: ${b.subscription?.plan} ${b.subscription?.startDate?.toISOString().slice(0, 10)} ~ ${b.subscription?.endDate?.toISOString().slice(0, 10)}\n    createdAt: ${b.createdAt.toISOString()}`,
    );
  }

  console.log("\n=== Invites (recent 5) ===");
  const invites = await prisma.inviteToken.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  if (invites.length === 0) {
    console.log("(none)");
  }
  for (const iv of invites) {
    console.log(
      `- ${iv.expectedBusinessName ?? "(no name)"}  email:${iv.expectedOwnerEmail ?? "-"}  used:${iv.usedAt?.toISOString().slice(0, 16) ?? "no"}  biz:${iv.createdBusinessId ?? "-"}`,
    );
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
