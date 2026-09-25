-- AlterTable
ALTER TABLE "Faq" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "FaqCategory" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- Backfill: preserve current createdAt order as the initial manual order,
-- so existing rows don't visually reshuffle once ordering becomes editable.
UPDATE "FaqCategory" t
SET "order" = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) - 1 AS rn
  FROM "FaqCategory"
) sub
WHERE t.id = sub.id;

UPDATE "Faq" t
SET "order" = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "categoryId" ORDER BY "createdAt" ASC) - 1 AS rn
  FROM "Faq"
) sub
WHERE t.id = sub.id;
