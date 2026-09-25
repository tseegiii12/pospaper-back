const prisma = require("../lib/prisma");

// params: categoryId (optional filter, e.g. for the public /help page),
// showOnHome (optional filter, e.g. for the home page's FAQ teaser).
async function list(req, res) {
  const { categoryId, showOnHome } = req.query;
  const faqs = await prisma.faq.findMany({
    where: {
      deletedAt: null,
      ...(categoryId ? { categoryId } : {}),
      ...(showOnHome !== undefined ? { showOnHome: showOnHome === "true" } : {}),
    },
    include: { category: true },
    orderBy: [{ categoryId: "asc" }, { order: "asc" }],
  });
  res.json({ faqs });
}

async function create(req, res) {
  const { categoryId, question, answer, showOnHome } = req.body;
  if (!categoryId || !question || !answer) {
    return res.status(400).json({ error: "Ангилал, асуулт, хариулт шаардлагатай." });
  }
  const category = await prisma.faqCategory.findUnique({ where: { id: categoryId } });
  if (!category || category.deletedAt) {
    return res.status(400).json({ error: "Ангилал олдсонгүй." });
  }
  // New FAQs go to the end of their category's manual order.
  const last = await prisma.faq.findFirst({
    where: { categoryId, deletedAt: null },
    orderBy: { order: "desc" },
  });
  const faq = await prisma.faq.create({
    data: { categoryId, question, answer, showOnHome: !!showOnHome, order: (last?.order ?? -1) + 1 },
    include: { category: true },
  });
  res.status(201).json({ faq });
}

async function update(req, res) {
  const existing = await prisma.faq.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.deletedAt) {
    return res.status(404).json({ error: "Асуулт олдсонгүй." });
  }

  const { categoryId, question, answer, showOnHome } = req.body;
  if (!categoryId || !question || !answer) {
    return res.status(400).json({ error: "Ангилал, асуулт, хариулт шаардлагатай." });
  }
  const category = await prisma.faqCategory.findUnique({ where: { id: categoryId } });
  if (!category || category.deletedAt) {
    return res.status(400).json({ error: "Ангилал олдсонгүй." });
  }

  // Moving to a different category drops it to the end of that category's
  // order — its old position has no meaning in the new list.
  let order = existing.order;
  if (categoryId !== existing.categoryId) {
    const last = await prisma.faq.findFirst({
      where: { categoryId, deletedAt: null },
      orderBy: { order: "desc" },
    });
    order = (last?.order ?? -1) + 1;
  }

  const faq = await prisma.faq.update({
    where: { id: req.params.id },
    data: { categoryId, question, answer, showOnHome: !!showOnHome, order },
    include: { category: true },
  });
  res.json({ faq });
}

// Swaps this FAQ's order with its immediate neighbor above/below within the
// same category — a no-op (200, unchanged) when already at that edge.
async function move(req, res) {
  const { direction } = req.body;
  if (direction !== "up" && direction !== "down") {
    return res.status(400).json({ error: "Чиглэл 'up' эсвэл 'down' байх ёстой." });
  }
  const current = await prisma.faq.findUnique({ where: { id: req.params.id } });
  if (!current || current.deletedAt) {
    return res.status(404).json({ error: "Асуулт олдсонгүй." });
  }

  const neighbor = await prisma.faq.findFirst({
    where: {
      categoryId: current.categoryId,
      deletedAt: null,
      order: direction === "up" ? { lt: current.order } : { gt: current.order },
    },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
  });
  if (neighbor) {
    await prisma.$transaction([
      prisma.faq.update({ where: { id: current.id }, data: { order: neighbor.order } }),
      prisma.faq.update({ where: { id: neighbor.id }, data: { order: current.order } }),
    ]);
  }

  const faqs = await prisma.faq.findMany({
    where: { deletedAt: null },
    include: { category: true },
    orderBy: [{ categoryId: "asc" }, { order: "asc" }],
  });
  res.json({ faqs });
}

async function remove(req, res) {
  const existing = await prisma.faq.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.deletedAt) {
    return res.status(404).json({ error: "Асуулт олдсонгүй." });
  }
  await prisma.faq.update({
    where: { id: req.params.id },
    data: { deletedAt: new Date() },
  });
  res.status(204).send();
}

module.exports = { list, create, update, move, remove };
