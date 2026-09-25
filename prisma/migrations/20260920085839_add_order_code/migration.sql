-- Add nullable column first so existing rows can be backfilled.
ALTER TABLE "Order" ADD COLUMN "code" TEXT;

-- Backfill existing orders with a code derived from their creation date,
-- disambiguated by row order so backfilled values can't collide with each other.
UPDATE "Order" AS o
SET "code" = to_char(o."createdAt", 'YYYYMMDD') || lpad((100000 + sub.rn)::text, 6, '0')
FROM (
  SELECT "id", row_number() OVER (ORDER BY "createdAt") AS rn FROM "Order"
) AS sub
WHERE o."id" = sub."id";

-- Now that every row has a value, enforce NOT NULL + uniqueness going forward.
ALTER TABLE "Order" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "Order_code_key" ON "Order"("code");
