-- CreateEnum
CREATE TYPE "PriceMode" AS ENUM ('VAT', 'NO_VAT');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "regNumber" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "priceMode" "PriceMode" NOT NULL DEFAULT 'VAT';
