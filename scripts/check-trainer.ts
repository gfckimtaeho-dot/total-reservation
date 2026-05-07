import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const trainers = await prisma.user.findMany({
    where: { role: "TRAINER" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      gymId: true,
      passwordHash: true,
      accessToken: true,
      createdAt: true,
    },
  });
  for (const u of trainers) {
    console.log({
      ...u,
      passwordHash: u.passwordHash ? `[${u.passwordHash.length} chars]` : null,
      accessToken: u.accessToken ? `[${u.accessToken.length} chars]` : null,
    });
  }
}
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
