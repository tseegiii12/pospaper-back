const prisma = require("../lib/prisma");
const { parsePagination } = require("../utils/pagination");

// Public: submitted from the /contact page's "Санал хүсэлт илгээх" form.
async function create(req, res) {
  const { name, phone, message } = req.body;
  if (!phone?.trim()) {
    return res.status(400).json({ error: "Утасны дугаар шаардлагатай." });
  }

  const contactMessage = await prisma.contactMessage.create({
    data: {
      name: name?.trim() || null,
      phone: phone.trim(),
      message: message?.trim() || null,
    },
  });
  res.status(201).json({ contactMessage });
}

// Admin-only: submitted feedback/complaints, newest first.
async function list(req, res) {
  const { page, pageSize, skip, take } = parsePagination(req.query);

  const [messages, total] = await Promise.all([
    prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" }, skip, take }),
    prisma.contactMessage.count(),
  ]);
  res.json({ messages, total, page, pageSize });
}

module.exports = { create, list };
