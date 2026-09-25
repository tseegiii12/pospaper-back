const prisma = require("../lib/prisma");

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

async function upload(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: "Зураг сонгоогүй байна." });
  }
  if (!ALLOWED_MIME_TYPES.has(req.file.mimetype)) {
    return res.status(400).json({ error: "Зөвхөн JPEG, PNG, WEBP, GIF зураг оруулна уу." });
  }

  const { productId } = req.body;
  const image = await prisma.productImage.create({
    data: {
      data: req.file.buffer,
      mimeType: req.file.mimetype,
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
