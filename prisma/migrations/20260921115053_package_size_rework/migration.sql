-- Packages are now bought as a fixed unit count (unitsPerPkg) rather than a
-- unitsFrom-unitsTo range, and arbitrary-quantity ordering (allowCustomQty)
-- is removed. Backfill unitsPerPkg from the old unitsFrom before dropping it.

-- AlterTable
ALTER TABLE "ProductOption" ADD COLUMN "unitsPerPkg" INTEGER;

UPDATE "ProductOption" SET "unitsPerPkg" = "unitsFrom";

ALTER TABLE "ProductOption" ALTER COLUMN "unitsPerPkg" SET NOT NULL;

ALTER TABLE "ProductOption" DROP COLUMN "unitsFrom";
ALTER TABLE "ProductOption" DROP COLUMN "unitsTo";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "allowCustomQty";
