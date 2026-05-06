/*
  Warnings:

  - You are about to alter the column `totalCount` on the `Package` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(5,1)`.
  - You are about to alter the column `remainingCount` on the `Package` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(5,1)`.

*/
-- AlterTable
ALTER TABLE "Package" ALTER COLUMN "totalCount" SET DATA TYPE DECIMAL(5,1),
ALTER COLUMN "remainingCount" SET DATA TYPE DECIMAL(5,1);

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "deductCount" DECIMAL(3,1) NOT NULL DEFAULT 1.0;

-- Partial unique index: customer 식별자는 (phone, gymId).
-- phone NULL인 admin/일부 staff는 제외. Prisma @@unique로 표현 불가능한 partial WHERE.
-- 이미 DB에 적용된 경우 IF NOT EXISTS로 noop.
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_gymId_key" ON "User"("phone", "gymId") WHERE "phone" IS NOT NULL;
