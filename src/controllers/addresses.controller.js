const prisma = require("../lib/prisma");

// Every field the checkout form's AddressFields component collects, besides
// the server-assigned id/userId/timestamps. Kept as one list so create/update
// pick the same fields out of req.body without repeating it twice.
const ADDRESS_FIELDS = [
  "addressType",
  "aimag",
  "district",
  "khoroo",
  "building",
  "unit",
  "houseNumber",
  "street",
  "officeBuilding",
  "floor",
  "officeUnit",
  "officeName",
  "addressNote",
  "fullAddress",
];

function pickAddressFields(body) {
  const data = {};
  for (const field of ADDRESS_FIELDS) {
    if (body[field] !== undefined) data[field] = body[field] || null;
  }
  return data;
}

function validateRequired(body) {
  if (!body.label || !String(body.label).trim()) {
    return "Хаягийн нэр (жишээ нь: Гэр, Ажил) шаардлагатай.";
  }
  if (!body.aimag || !body.district || !body.khoroo) {
    return "Хот/Аймаг, Дүүрэг/Сум, Хороо/Багаа сонгоно уу.";
  }
  if (!body.fullAddress || !String(body.fullAddress).trim()) {
    return "Хаягийн мэдээлэл дутуу байна.";
  }
  return null;
}

// A buyer's own address book — always scoped to req.user, never another
// account's addresses.
async function list(req, res) {
  const addresses = await prisma.address.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
  });
  res.json({ addresses });
}

async function create(req, res) {
  const error = validateRequired(req.body);
  if (error) return res.status(400).json({ error });

  const address = await prisma.address.create({
    data: {
      userId: req.user.id,
      label: String(req.body.label).trim(),
      ...pickAddressFields(req.body),
    },
  });
  res.status(201).json({ address });
}

async function update(req, res) {
  const existing = await prisma.address.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.userId !== req.user.id) {
    return res.status(404).json({ error: "Хаяг олдсонгүй." });
  }
  const error = validateRequired({ ...existing, ...req.body });
  if (error) return res.status(400).json({ error });

  const address = await prisma.address.update({
    where: { id: req.params.id },
    data: {
      ...(req.body.label !== undefined ? { label: String(req.body.label).trim() } : {}),
      ...pickAddressFields(req.body),
    },
  });
  res.json({ address });
}

async function remove(req, res) {
  const existing = await prisma.address.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.userId !== req.user.id) {
    return res.status(404).json({ error: "Хаяг олдсонгүй." });
  }
  await prisma.address.delete({ where: { id: req.params.id } });
  res.status(204).send();
}

module.exports = { list, create, update, remove };
