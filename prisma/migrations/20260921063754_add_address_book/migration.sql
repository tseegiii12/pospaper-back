-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "addressId" TEXT,
ADD COLUMN     "addressNote" TEXT,
ADD COLUMN     "addressType" TEXT,
ADD COLUMN     "aimag" TEXT,
ADD COLUMN     "building" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "floor" TEXT,
ADD COLUMN     "houseNumber" TEXT,
ADD COLUMN     "khoroo" TEXT,
ADD COLUMN     "officeBuilding" TEXT,
ADD COLUMN     "officeName" TEXT,
ADD COLUMN     "officeUnit" TEXT,
ADD COLUMN     "street" TEXT,
ADD COLUMN     "unit" TEXT;

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "addressType" TEXT NOT NULL,
    "aimag" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "khoroo" TEXT NOT NULL,
    "building" TEXT,
    "unit" TEXT,
    "houseNumber" TEXT,
    "street" TEXT,
    "officeBuilding" TEXT,
    "floor" TEXT,
    "officeUnit" TEXT,
    "officeName" TEXT,
    "addressNote" TEXT,
    "fullAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Address_userId_idx" ON "Address"("userId");

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;
