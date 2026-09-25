const prisma = require("../lib/prisma");

async function list(req, res) {
  const options = await prisma.productOption.findMany({
    where: { productId: req.params.productId },
    orderBy: { unitsPerPkg: "asc" },
  });
  res.json({ options });
}

async function create(req, res) {
  const {
    unitsPerPkg,
    label,
    pkgPrice,
    unitPrice,
    marketPrice,
    unitPriceNoVat,
    pkgPriceNoVat,
    isDefault,
  } = req.body;
  if (!unitsPerPkg || !pkgPrice) {
    return res.status(400).json({ error: "unitsPerPkg, pkgPrice шаардлагатай." });
  }
  const resolvedUnitPrice = unitPrice || Math.round(pkgPrice / unitsPerPkg);

  const product = await prisma.product.findUnique({ where: { id: req.params.productId } });
  if (!product) return res.status(404).json({ error: "Бүтээгдэхүүн олдсонгүй." });

  const option = await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.productOption.updateMany({
        where: { productId: req.params.productId },
        data: { isDefault: false },
      });
    }
    return tx.productOption.create({
      data: {
        productId: req.params.productId,
        unitsPerPkg,
        label,
        pkgPrice,
        unitPrice: resolvedUnitPrice,
        marketPrice,
        unitPriceNoVat,
        pkgPriceNoVat,
        isDefault: !!isDefault,
      },
    });
  });

  res.status(201).json({ option });
}

async function update(req, res) {
  const {
    unitsPerPkg,
    label,
    pkgPrice,
    unitPrice,
    marketPrice,
    unitPriceNoVat,
    pkgPriceNoVat,
    isDefault,
  } = req.body;

  const existing = await prisma.productOption.findUnique({ where: { id: req.params.optionId } });
  if (!existing || existing.productId !== req.params.productId) {
    return res.status(404).json({ error: "Сонголт олдсонгүй." });
  }
  const resolvedUnitPrice =
    unitPrice || Math.round((pkgPrice ?? existing.pkgPrice) / (unitsPerPkg ?? existing.unitsPerPkg));

  const option = await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.productOption.updateMany({
        where: { productId: req.params.productId },
        data: { isDefault: false },
      });
    }
    return tx.productOption.update({
      where: { id: req.params.optionId },
      data: {
        unitsPerPkg,
        label,
        pkgPrice,
        unitPrice: resolvedUnitPrice,
        marketPrice,
        unitPriceNoVat,
        pkgPriceNoVat,
        isDefault,
      },
    });
  });

  res.json({ option });
}

async function remove(req, res) {
  const existing = await prisma.productOption.findUnique({ where: { id: req.params.optionId } });
  if (!existing || existing.productId !== req.params.productId) {
    return res.status(404).json({ error: "Сонголт олдсонгүй." });
  }
  await prisma.productOption.delete({ where: { id: req.params.optionId } });
  res.status(204).send();
}

module.exports = { list, create, update, remove };
