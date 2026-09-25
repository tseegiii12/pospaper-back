-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentType" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "canInvoice" BOOLEAN NOT NULL DEFAULT false;
