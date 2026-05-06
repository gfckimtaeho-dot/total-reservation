-- CreateEnum
CREATE TYPE "Specialty" AS ENUM ('HEALTH', 'YOGA', 'PILATES', 'DANCE');

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "customSpecialty" TEXT,
ADD COLUMN     "specialties" "Specialty"[] DEFAULT ARRAY[]::"Specialty"[],
ADD COLUMN     "weeklyOffDays" "Weekday"[] DEFAULT ARRAY[]::"Weekday"[];

-- CreateTable
CREATE TABLE "StaffImage" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffLeave" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffLeave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffImage_staffId_position_idx" ON "StaffImage"("staffId", "position");

-- CreateIndex
CREATE INDEX "StaffLeave_staffId_idx" ON "StaffLeave"("staffId");

-- CreateIndex
CREATE INDEX "StaffLeave_gymId_endDate_idx" ON "StaffLeave"("gymId", "endDate");

-- AddForeignKey
ALTER TABLE "StaffImage" ADD CONSTRAINT "StaffImage_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeave" ADD CONSTRAINT "StaffLeave_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeave" ADD CONSTRAINT "StaffLeave_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Re-establish partial unique on User(phone, gymId) — stripped from prior migration to fix hash mismatch.
-- Idempotent: DB already has it from earlier db execute.
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_gymId_key" ON "User"("phone", "gymId") WHERE "phone" IS NOT NULL;
