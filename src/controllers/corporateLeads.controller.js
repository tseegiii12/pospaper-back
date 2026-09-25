const prisma = require("../lib/prisma");
const { parsePagination } = require("../utils/pagination");

// Public: submitted from the /corporate-supply page's quote request form.
async function create(req, res) {
  const { companyName, contactName, phone, email } = req.body;
  if (!companyName?.trim() || !contactName?.trim() || !phone?.trim()) {
    return res.status(400).json({ error: "Байгууллагын нэр, харилцах хүний нэр, утас шаардлагатай." });
  }

  const lead = await prisma.corporateLead.create({
    data: {
      companyName: companyName.trim(),
      contactName: contactName.trim(),
      phone: phone.trim(),
      email: email?.trim() || null,
    },
  });
  res.status(201).json({ lead });
}

// Admin-only: submitted quote requests, newest first.
async function list(req, res) {
  const { page, pageSize, skip, take } = parsePagination(req.query);

  const [leads, total] = await Promise.all([
    prisma.corporateLead.findMany({ orderBy: { createdAt: "desc" }, skip, take }),
    prisma.corporateLead.count(),
  ]);
  res.json({ leads, total, page, pageSize });
}

module.exports = { create, list };
