import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { verifyPassword } from "../src/lib/auth/password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const slug = process.argv[2];
  const loginId = process.argv[3]?.toLowerCase().trim();
  const password = process.argv[4];

  if (!slug || !loginId || !password) {
    console.error("usage: tsx scripts/verify-user-password.ts <slug> <loginId> <password>");
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
  if (!user.passwordHash) {
    console.error(`no passwordHash for ${loginId}`);
    process.exit(1);
  }

  const ok = await verifyPassword(password, user.passwordHash);
  console.log(`role=${user.role} status=${user.status}`);
  console.log(`hash prefix: ${user.passwordHash.slice(0, 7)}...`);
  console.log(`verify result: ${ok ? "MATCH" : "MISMATCH"}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
