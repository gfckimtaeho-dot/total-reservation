import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/auth/password";

// DEV 사전작업 — 기존 등록 고객 전원에게 로그인 가능한 샘플 계정 부여.
// 이메일이 모자라 실메일 못 보내는 상황의 임시 대체. 실서버 운영 땐
// 진짜 등록 메일(매직링크→앱설치→QR출입)로 가는 게 정식 흐름.
//
// 부여: email = c{n}@test.local (createdAt 순, @test.local 은 기존
// @sample.local 과 안 겹쳐 충돌 없음), passwordHash = gigood12, ACTIVE.
// 멱등 — 재실행 시 같은 값으로 다시 set.
//
//   tsx scripts/dev-customer-sample-accounts.ts [slug=stronghealth] [pw=gigood12]

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const slug = process.argv[2] || "stronghealth";
  const pw = process.argv[3] || "gigood12";

  const business = await prisma.business.findUnique({ where: { slug } });
  if (!business) {
    console.error(`business not found: ${slug}`);
    process.exit(1);
  }

  const customers = await prisma.user.findMany({
    where: { gymId: business.id, role: "CUSTOMER" },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, phone: true },
  });
  if (customers.length === 0) {
    console.log(`no CUSTOMER users in ${slug}`);
    process.exit(0);
  }

  const passwordHash = await hashPassword(pw);

  console.log(`\n=== ${slug} 고객 샘플 계정 (pw=${pw}) ===`);
  let n = 0;
  for (const c of customers) {
    n += 1;
    const email = `c${n}@test.local`;
    await prisma.user.update({
      where: { id: c.id },
      data: { email, passwordHash, status: "ACTIVE" },
    });
    console.log(
      `  ${String(n).padStart(2)}. ${c.name.padEnd(8)} | ${email} | pw=${pw}` +
        (c.phone ? ` | ${c.phone}` : ""),
    );
  }
  console.log(`\n총 ${customers.length}명 처리 완료 (status=ACTIVE).\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
