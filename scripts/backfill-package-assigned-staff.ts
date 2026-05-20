import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// 기존 Package 인스턴스에 assignedStaffId 채우기 (1회성, 멱등).
//
// 규칙: 그 Package 로 잡힌 가장 최근 Reservation 의 staffId 로 백필.
// Reservation 이 없으면 null 유지 (고객 화면 "담당 미지정" 폴백).
// 이미 assignedStaffId 가 있으면 건너뜀.
//
//   tsx scripts/backfill-package-assigned-staff.ts

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const targets = await prisma.package.findMany({
    where: { assignedStaffId: null },
    select: { id: true, gymId: true },
  });
  console.log(`[backfill] candidates: ${targets.length}`);

  let filled = 0;
  let skipped = 0;
  for (const p of targets) {
    const r = await prisma.reservation.findFirst({
      where: { packageId: p.id },
      orderBy: { startAt: "desc" },
      select: { staffId: true },
    });
    if (!r) {
      skipped++;
      continue;
    }
    await prisma.package.update({
      where: { id: p.id },
      data: { assignedStaffId: r.staffId },
    });
    filled++;
  }
  console.log(`[backfill] filled=${filled} skipped=${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
