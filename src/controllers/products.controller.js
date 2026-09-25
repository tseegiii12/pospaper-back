const prisma = require("../lib/prisma");
const { parsePagination } = require("../utils/pagination");

// `categories` arrives as an array of category ids (e.g. ["thermal"]); Prisma
// needs it as a connect list since it's now a relation, not a plain array column.
function toCategoriesRelation(categories) {
  if (!categories) return undefined;
  return { set: categories.map((id) => ({ id })) };
}

const ADMIN_INCLUDE = { categories: true, options: { orderBy: { unitsPerPkg: "asc" } } };

// Public storefront: only visible, non-deleted products. Paginated, with a
// per-category product count (over the search/highlight filter but ignoring
// the category itself) so the storefront's category tabs can show live counts
// without a full extra fetch of the catalog.
async function list(req, res) {
  const { category, q, highlight } = req.query;
  const { page, pageSize, skip, take } = parsePagination(req.query);

  const trimmedQ = q ? String(q).trim() : "";
  const baseWhere = {
    active: true,
    deletedAt: null,
    ...(trimmedQ
      ? {
          OR: [
            { name: { contains: trimmedQ, mode: "insensitive" } },
            { description: { contains: trimmedQ, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(highlight === "true" ? { highlight: true } : {}),
  };
  const where = {
    ...baseWhere,
    ...(category && category !== "all" ? { categories: { some: { id: category } } } : {}),
  };

  const [products, total, allCount, categories] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { categories: true, options: { orderBy: { unitsPerPkg: "asc" } } },
      orderBy: { createdAt: "asc" },
      skip,
      take,
    }),
    prisma.product.count({ where }),
    prisma.product.count({ where: baseWhere }),
    prisma.category.findMany({ where: { deletedAt: null } }),
  ]);

  const categoryCounts = { all: allCount };
  await Promise.all(
    categories.map(async (c) => {
      categoryCounts[c.id] = await prisma.product.count({
        where: { ...baseWhere, categories: { some: { id: c.id } } },
      });
    })
  );

  res.json({ products, total, page, pageSize, categoryCounts });
}

async function getById(req, res) {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: { categories: true, options: { orderBy: { unitsPerPkg: "asc" } } },
  });
  if (!product || !product.active || product.deletedAt) {
    return res.status(404).json({ error: "Бүтээгдэхүүн олдсонгүй." });
  }
  res.json({ product });
}

// Admin: every non-deleted product, visible or hidden, so it can be managed.
async function listAdmin(req, res) {
  const { category, q } = req.query;
  const { page, pageSize, skip, take } = parsePagination(req.query);

  const trimmedQ = q ? String(q).trim() : "";
  const where = {
    deletedAt: null,
    ...(category && category !== "all" ? { categories: { some: { id: category } } } : {}),
    ...(trimmedQ
      ? {
          OR: [
            { name: { contains: trimmedQ, mode: "insensitive" } },
            { description: { contains: trimmedQ, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: ADMIN_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.product.count({ where }),
  ]);
  res.json({ products, total, page, pageSize });
}

async function getByIdAdmin(req, res) {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: ADMIN_INCLUDE,
  });
  if (!product || product.deletedAt) {
    return res.status(404).json({ error: "Бүтээгдэхүүн олдсонгүй." });
  }
  res.json({ product });
}

const MAX_IMAGES = 3;

async function create(req, res) {
  // id is always server-generated (uuid) — ignore anything the client sends for it.
  const { categories, id: _ignoredId, ...data } = req.body;
  if (data.images && data.images.length > MAX_IMAGES) {
    return res.status(400).json({ error: `Бүтээгдэхүүн дээд тал нь ${MAX_IMAGES} зурагтай байна.` });
  }
  const product = await prisma.product.create({
    data: {
      ...data,
      ...(categories ? { categories: { connect: categories.map((id) => ({ id })) } } : {}),
    },
    include: { categories: true },
  });
  res.status(201).json({ product });
}

async function update(req, res) {
  const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.deletedAt) {
    return res.status(404).json({ error: "Бүтээгдэхүүн олдсонгүй." });
  }
  const { categories, ...data } = req.body;
  if (data.images && data.images.length > MAX_IMAGES) {
    return res.status(400).json({ error: `Бүтээгдэхүүн дээд тал нь ${MAX_IMAGES} зурагтай байна.` });
  }
  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: {
      ...data,
      categories: toCategoriesRelation(categories),
    },
    include: { categories: true },
  });
  res.json({ product });
}

// Hide/show without deleting — keeps the product editable and in admin lists.
async function setVisibility(req, res) {
  const { active } = req.body;
  if (typeof active !== "boolean") {
    return res.status(400).json({ error: "active утга boolean байх ёстой." });
  }
  const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.deletedAt) {
    return res.status(404).json({ error: "Бүтээгдэхүүн олдсонгүй." });
  }
  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: { active },
    include: { categories: true },
  });
  res.json({ product });
}

// Soft delete: mark as deleted rather than removing the row, so order history stays intact.
async function remove(req, res) {
  const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.deletedAt) {
    return res.status(404).json({ error: "Бүтээгдэхүүн олдсонгүй." });
  }
  await prisma.product.update({
    where: { id: req.params.id },
    data: { deletedAt: new Date() },
  });
  res.status(204).send();
}

module.exports = { list, getById, listAdmin, getByIdAdmin, create, update, setVisibility, remove };
