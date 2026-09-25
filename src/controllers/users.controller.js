const bcrypt = require("bcryptjs");
const prisma = require("../lib/prisma");
const { parsePagination } = require("../utils/pagination");

function toPublicUser(user) {
  const { passwordHash, ...publicUser } = user;
  return publicUser;
}

const VALID_TYPES = ["PERSON", "ORGANIZATION"];
// Same shape auth.controller.js uses for self-registration: usually 7 digits
// but state registration numbers for some entity types use letters or a
// different length, so this only sanity-checks length and character set.
const REG_NUMBER_PATTERN = /^[A-Za-zА-Яа-яЁёӨөҮү0-9]{5,20}$/;

// Admin-only: every account, of either type. Filterable by type and a
// free-text search across name/orgName/phone/email; paginated since the
// account list grows unbounded.
async function listUsers(req, res) {
  const { type, q } = req.query;
  const { page, pageSize, skip, take } = parsePagination(req.query);

  if (type && !VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `Төрөл буруу байна. Зөвшөөрөгдсөн: ${VALID_TYPES.join(", ")}` });
  }
  const trimmedQ = q ? String(q).trim() : "";
  const where = {
    ...(type ? { type } : {}),
    ...(trimmedQ
      ? {
          OR: [
            { name: { contains: trimmedQ, mode: "insensitive" } },
            { orgName: { contains: trimmedQ, mode: "insensitive" } },
            { phone: { contains: trimmedQ, mode: "insensitive" } },
            { email: { contains: trimmedQ, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.user.count({ where }),
  ]);
  res.json({ users: users.map(toPublicUser), total, page, pageSize });
}

// Admin-only: organizations are the only accounts canInvoice applies to, so
// that's the list the admin UI needs to manage the flag. Searchable/paginated
// the same way as listUsers.
async function listOrganizations(req, res) {
  const { q } = req.query;
  const { page, pageSize, skip, take } = parsePagination(req.query);

  const trimmedQ = q ? String(q).trim() : "";
  const where = {
    type: "ORGANIZATION",
    ...(trimmedQ
      ? {
          OR: [
            { orgName: { contains: trimmedQ, mode: "insensitive" } },
            { regNumber: { contains: trimmedQ, mode: "insensitive" } },
            { phone: { contains: trimmedQ, mode: "insensitive" } },
            { email: { contains: trimmedQ, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.user.count({ where }),
  ]);
  res.json({ users: users.map(toPublicUser), total, page, pageSize });
}

// Admin-only: creates an ORGANIZATION account directly, skipping the
// email-OTP verification normal self-registration requires — used when the
// admin is onboarding an org in person or by phone and can vouch for it.
async function createOrganization(req, res) {
  const { phone, email, password, name, orgName, regNumber, canInvoice } = req.body;

  if (!phone || !email || !password) {
    return res.status(400).json({ error: "Утасны дугаар, имэйл болон нууц үг шаардлагатай." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Нууц үг 6-с дээш тэмдэгттэй байх ёстой." });
  }

  const trimmedOrgName = (orgName || "").trim();
  const trimmedRegNumber = (regNumber || "").trim();
  if (!trimmedOrgName) {
    return res.status(400).json({ error: "Байгууллагын нэр шаардлагатай." });
  }
  if (!REG_NUMBER_PATTERN.test(trimmedRegNumber)) {
    return res.status(400).json({ error: "Байгууллагын регистрийн дугаар буруу байна." });
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ phone }, { email }, { regNumber: trimmedRegNumber }] },
  });
  if (existing) {
    return res.status(409).json({
      error:
        existing.regNumber === trimmedRegNumber
          ? "Энэ регистрийн дугаараар бүртгэлтэй байгууллага байна."
          : "Энэ утасны дугаар эсвэл имэйлээр бүртгэлтэй хэрэглэгч байна.",
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  let user;
  try {
    user = await prisma.user.create({
      data: {
        type: "ORGANIZATION",
        phone,
        email,
        name: name ? String(name).trim() : null,
        passwordHash,
        orgName: trimmedOrgName,
        regNumber: trimmedRegNumber,
        canInvoice: Boolean(canInvoice),
      },
    });
  } catch (err) {
    if (err.code === "P2002") {
      const target = err.meta?.target || [];
      const message = target.includes("regNumber")
        ? "Энэ регистрийн дугаараар бүртгэлтэй байгууллага байна."
        : "Энэ утасны дугаар эсвэл имэйлээр бүртгэлтэй хэрэглэгч байна.";
      return res.status(409).json({ error: message });
    }
    throw err;
  }

  res.status(201).json({ user: toPublicUser(user) });
}

async function setCanInvoice(req, res) {
  const { canInvoice } = req.body;
  if (typeof canInvoice !== "boolean") {
    return res.status(400).json({ error: "canInvoice утга нь true/false байх ёстой." });
  }

  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: "Хэрэглэгч олдсонгүй." });

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: { canInvoice },
  });
  res.json({ user: toPublicUser(updated) });
}

// Admin-only: sets a user's password directly, bypassing the normal
// change-password flow (no current-password check) — the admin is acting on
// someone else's account, e.g. because they're locked out.
async function setPassword(req, res) {
  const { password, confirmPassword } = req.body;
  if (typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "Нууц үг дор хаяж 6 тэмдэгт байх ёстой." });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Нууц үг таарахгүй байна." });
  }

  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: "Хэрэглэгч олдсонгүй." });

  const passwordHash = await bcrypt.hash(password, 10);
  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: { passwordHash },
  });
  res.json({ user: toPublicUser(updated) });
}

module.exports = { listUsers, listOrganizations, createOrganization, setCanInvoice, setPassword };
