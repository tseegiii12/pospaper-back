-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('PERSON', 'ORGANIZATION');

-- AlterTable
ALTER TABLE "RegistrationOtp" ADD COLUMN     "orgName" TEXT,
ADD COLUMN     "regNumber" TEXT,
ADD COLUMN     "type" "CustomerType" NOT NULL DEFAULT 'PERSON';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "orgName" TEXT,
ADD COLUMN     "regNumber" TEXT,
ADD COLUMN     "type" "CustomerType" NOT NULL DEFAULT 'PERSON';

-- CreateIndex
CREATE UNIQUE INDEX "User_regNumber_key" ON "User"("regNumber");

