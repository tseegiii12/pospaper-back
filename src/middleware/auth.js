const { verifyToken } = require("../utils/jwt");
const prisma = require("../lib/prisma");

function getTokenFromHeader(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" ? token : null;
}

// Rejects the request unless a valid token maps to an existing user.
async function requireAuth(req, res, next) {
  const token = getTokenFromHeader(req);
  if (!token) return res.status(401).json({ error: "Нэвтрэх шаардлагатай." });
  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return res.status(401).json({ error: "Хэрэглэгч олдсонгүй." });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Token хүчингүй байна." });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ error: "Админ эрх шаардлагатай." });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
