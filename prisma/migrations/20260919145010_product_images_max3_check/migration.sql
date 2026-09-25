-- Enforce at most 3 images per product at the database level, not just in the API.
ALTER TABLE "Product"
  ADD CONSTRAINT "Product_images_max3" CHECK (array_length("images", 1) IS NULL OR array_length("images", 1) <= 3);
