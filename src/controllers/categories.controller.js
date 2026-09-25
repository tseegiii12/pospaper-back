const prisma = require("../lib/prisma");

// Storefront + admin dropdowns only ever see non-deleted categories.
async function list(_req, res) {
  const categories = await prisma.category.findMany({
    where: { deletedAt: null },
    orderBy: { label: "asc" },
  });
  res.json({ categories });
}

async function create(req, res) {
  const { label } = req.body;
  if (!label) {
    return res.status(400).json({ error: "Ангиллын нэр шаардлагатай." });
  }
  // id is always server-generated (uuid) — the admin only ever supplies the label.
  const category = await prisma.category.create({ data: { label } });
  res.status(201).json({ category });
}

async function update(req, res) {
  const { label } = req.body;
  if (!label) return res.status(400).json({ error: "Ангиллын нэр шаардлагатай." });
  const existing = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.deletedAt) {
    return res.status(404).json({ error: "Ангилал олдсонгүй." });
  }
  const category = await prisma.category.update({
    where: { id: req.params.id },
    data: { label },
  });
  res.json({ category });
}

async function remove(req, res) {
  const existing = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.deletedAt) {
    return res.status(404).json({ error: "Ангилал олдсонгүй." });
  }
  await prisma.category.update({
    where: { id: req.params.id },
    data: { deletedAt: new Date() },
  });
  res.status(204).send();
}

module.exports = { list, create, update, remove };
