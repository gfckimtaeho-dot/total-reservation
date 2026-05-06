-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dob" DATE,
ADD COLUMN     "emergencyContactPhone" TEXT,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "note" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- Partial unique index: customer 식별자는 (phone, gymId).
-- phone NULL인 admin/일부 staff는 제외하고, phone이 채워진 row끼리만 매장별 고유.
CREATE UNIQUE INDEX "User_phone_gymId_key" ON "User"("phone", "gymId") WHERE "phone" IS NOT NULL;
