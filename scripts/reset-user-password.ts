import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/auth/password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const slug = process.argv[2];
  const loginId = process.argv[3]?.toLowerCase().trim();
  const newPassword = process.argv[4];

  if (!slug || !loginId || !newPassword) {
    console.error("usage: tsx scripts/reset-user-password.ts <slug> <loginId> <newPassword>");
    process.exit(1);
  }

  const business = await prisma.business.findUnique({ where: { slug } });
  if (!business) {
    console.error(`business not found: ${slug}`);
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { loginId_gymId: { loginId, gymId: business.id } },
  });
  if (!user) {
    console.error(`user not found: ${loginId} @ ${slug}`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, status: "ACTIVE" },
  });

  console.log(`password reset OK: ${loginId} (role=${user.role}, status=ACTIVE)`);
  console.log(`new password: ${newPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
