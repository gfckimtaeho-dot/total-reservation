import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/auth/password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = (process.argv[2] ?? "gfckimtaeho@gmail.com").toLowerCase().trim();
  const password = process.argv[3] ?? "gigood12";
  const name = process.argv[4] ?? "관리자";

  const hash = await hashPassword(password);

  const existing = await prisma.user.findFirst({
    where: { email, gymId: null },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash: hash,
        status: "ACTIVE",
        role: "ADMIN",
        name,
      },
    });
    console.log(`admin updated: ${email} (id=${existing.id})`);
  } else {
    const created = await prisma.user.create({
      data: {
        email,
        passwordHash: hash,
        name,
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
    console.log(`admin created: ${email} (id=${created.id})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
