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
