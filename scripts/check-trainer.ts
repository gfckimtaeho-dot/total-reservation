import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // 1. raw SQL로 정확한 email 바이트까지 확인
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT id, email, length(email) AS email_len, encode(convert_to(email, 'UTF8'), 'hex') AS email_hex,
            "passwordHash" IS NOT NULL AS has_password, status, role, "gymId", "accessToken" IS NOT NULL AS has_token
       FROM "User"
       WHERE "gymId" = (SELECT id FROM "Business" WHERE slug = 'stringhealth')
       ORDER BY "createdAt"`,
  )) as Array<Record<string, unknown>>;
  for (const r of rows) {
    console.log(r);
  }

  // 2. 가맹점 로그인 액션이 하는 lookup을 정확히 재현
  const business = await prisma.business.findUnique({
    where: { slug: "stringhealth" },
  });
  console.log("\n--- findUnique reproduction ---");
  console.log("biz.id:", business?.id);

  const lookup = await prisma.user.findUnique({
    where: {
      email_gymId: {
        email: "etcrrrtt@gmail.com",
        gymId: business!.id,
      },
    },
  });
  console.log("findUnique result:", lookup ? "FOUND" : "NULL");
  if (lookup) {
    console.log("status:", lookup.status, "passwordHash?", Boolean(lookup.passwordHash));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
