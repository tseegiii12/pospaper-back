-- Rename in place (not drop+add) so existing option rows keep their data.
ALTER TABLE "ProductOption" RENAME COLUMN "units" TO "unitsFrom";

-- AlterTable
ALTER TABLE "ProductOption" ADD COLUMN     "unitsTo" INTEGER;
