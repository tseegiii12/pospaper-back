const prisma = require("../lib/prisma");

const SETTINGS_ID = "1";

const FIELDS = [
  "phone",
  "email",
  "address",
  "facebookUrl",
  "messengerUrl",
  "workDays",
  "openTime",
  "closeTime",
  "bankName",
  "bankAccountNumber",
  "bankIban",
  "bankAccountHolder",
];

// Public: the singleton row, created empty on first read if it doesn't exist yet.
async function get(req, res) {
  const settings = await prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  });
  res.json({ settings });
}

async function update(req, res) {
  const data = {};
  for (const field of FIELDS) {
    if (req.body[field] !== undefined) data[field] = req.body[field]?.trim() || null;
  }

  const settings = await prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    update: data,
    create: { id: SETTINGS_ID, ...data },
  });
  res.json({ settings });
}

module.exports = { get, update };
