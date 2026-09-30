const prisma = require("../lib/prisma");

// Storefront + admin dropdowns only ever see non-deleted categories.
// Sorted by how many visible products each has (most first), then by label,
// so the busiest categories show at the top of the list.
async function list(_req, res) {
  const rows = await prisma.category.findMany({
    where: { deletedAt: null },
    include: {
      _count: { select: { products: { where: { active: true, deletedAt: null } } } },
    },
  });
  const categories = rows
    .map(({ _count, ...category }) => ({ ...category, productCount: _count.products }))
    .sort((a, b) => b.productCount - a.productCount || a.label.localeCompare(b.label, "mn"));
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
