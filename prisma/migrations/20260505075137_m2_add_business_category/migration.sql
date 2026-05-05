-- CreateEnum
CREATE TYPE "BusinessCategory" AS ENUM ('GYM', 'MASSAGE');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "category" "BusinessCategory" NOT NULL DEFAULT 'GYM';
