import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// STORE 채널은 staffUserId NULL이라 schema의 @@unique(gymId, kind, customerId, staffUserId)로는
// (Postgres NULL distinct) 고객당 다수 STORE thread 가능해짐. partial unique index로 강제.
//
// 멱등: IF NOT EXISTS 사용. 반복 실행 안전.

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

(async () => {
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS chat_thread_store_unique
      ON "ChatThread" ("gymId", "customerId")
      WHERE kind = 'STORE'
  `);
  console.log("ok: chat_thread_store_unique");

  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
