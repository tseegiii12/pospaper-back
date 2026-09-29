const sharp = require("sharp");
const prisma = require("../lib/prisma");

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// Product photos never need to be larger than this to look sharp in the
// storefront grid or product page, so anything bigger gets scaled down.
const MAX_DIMENSION = 1600;
const WEBP_QUALITY = 80;

async function upload(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: "Зураг сонгоогүй байна." });
  }
  if (!ALLOWED_MIME_TYPES.has(req.file.mimetype)) {
    return res.status(400).json({ error: "Зөвхөн JPEG, PNG, WEBP, GIF зураг оруулна уу." });
  }

  // Re-encode to webp: shrinks large photos to a sane max size and compresses
  // them, so every stored image is small regardless of what was uploaded.
  const optimized = await sharp(req.file.buffer, { animated: true })
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  const { productId } = req.body;
  const image = await prisma.productImage.create({
    data: {
      data: optimized,
      mimeType: "image/webp",
      ...(productId ? { productId } : {}),
    },
  });
  res.status(201).json({ id: image.id, url: `/api/products/images/${image.id}` });
}

async function serve(req, res) {
  const image = await prisma.productImage.findUnique({ where: { id: req.params.imageId } });
  if (!image) {
    return res.status(404).json({ error: "Зураг олдсонгүй." });
  }
  res.set("Content-Type", image.mimeType);
  res.set("Cache-Control", "public, max-age=31536000, immutable");
  res.send(Buffer.from(image.data));
}

async function remove(req, res) {
  const image = await prisma.productImage.findUnique({ where: { id: req.params.imageId } });
  if (!image) {
    return res.status(404).json({ error: "Зураг олдсонгүй." });
  }
  await prisma.productImage.delete({ where: { id: req.params.imageId } });
  res.status(204).send();
}

module.exports = { upload, serve, remove };
