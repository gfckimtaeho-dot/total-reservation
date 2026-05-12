import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const slug = process.argv[2] ?? "stronghealth";
  const biz = await prisma.business.findUnique({ where: { slug } });
  if (!biz) { console.error(`no business: ${slug}`); process.exit(1); }
  const staff = await prisma.staff.findMany({
    where: { gymId: biz.id },
    include: { user: { select: { name: true, email: true, status: true } } },
    orderBy: { createdAt: "asc" },
  });
  console.log(`business ${slug} (${biz.id})`);
  console.log(`staff count: ${staff.length}`);
  for (const s of staff) {
    console.log(`  - ${s.user.name} (role=${s.role}, status=${s.user.status}, staffId=${s.id})`);
  }
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => process.exit(0));
