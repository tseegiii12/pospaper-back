const prisma = require("../lib/prisma");

async function list(_req, res) {
  const categories = await prisma.faqCategory.findMany({
    where: { deletedAt: null },
    orderBy: { order: "asc" },
  });
  res.json({ categories });
}

async function create(req, res) {
  const { label } = req.body;
  if (!label) {
    return res.status(400).json({ error: "Ангиллын нэр шаардлагатай." });
  }
  // New categories go to the end of the manual order.
  const last = await prisma.faqCategory.findFirst({
    where: { deletedAt: null },
    orderBy: { order: "desc" },
  });
  const category = await prisma.faqCategory.create({
    data: { label, order: (last?.order ?? -1) + 1 },
  });
  res.status(201).json({ category });
}

async function update(req, res) {
  const { label } = req.body;
  if (!label) return res.status(400).json({ error: "Ангиллын нэр шаардлагатай." });
  const existing = await prisma.faqCategory.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.deletedAt) {
    return res.status(404).json({ error: "Ангилал олдсонгүй." });
  }
  const category = await prisma.faqCategory.update({
    where: { id: req.params.id },
    data: { label },
  });
  res.json({ category });
}

// Swaps this category's order with its immediate neighbor above/below —
// a no-op (200, unchanged) when already at that edge of the list.
async function move(req, res) {
  const { direction } = req.body;
  if (direction !== "up" && direction !== "down") {
    return res.status(400).json({ error: "Чиглэл 'up' эсвэл 'down' байх ёстой." });
  }
  const current = await prisma.faqCategory.findUnique({ where: { id: req.params.id } });
  if (!current || current.deletedAt) {
    return res.status(404).json({ error: "Ангилал олдсонгүй." });
  }

  const neighbor = await prisma.faqCategory.findFirst({
    where: {
      deletedAt: null,
      order: direction === "up" ? { lt: current.order } : { gt: current.order },
    },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
  });
  if (neighbor) {
    await prisma.$transaction([
      prisma.faqCategory.update({ where: { id: current.id }, data: { order: neighbor.order } }),
      prisma.faqCategory.update({ where: { id: neighbor.id }, data: { order: current.order } }),
    ]);
  }

  const categories = await prisma.faqCategory.findMany({
    where: { deletedAt: null },
    orderBy: { order: "asc" },
  });
  res.json({ categories });
}

async function remove(req, res) {
  const existing = await prisma.faqCategory.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.deletedAt) {
    return res.status(404).json({ error: "Ангилал олдсонгүй." });
  }
  await prisma.faqCategory.update({
    where: { id: req.params.id },
    data: { deletedAt: new Date() },
  });
  res.status(204).send();
}

module.exports = { list, create, update, move, remove };
