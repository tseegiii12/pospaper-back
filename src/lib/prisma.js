const { PrismaClient } = require("@prisma/client");

// Reuse a single client across hot reloads in dev instead of exhausting
// Postgres connections with a new pool on every nodemon restart.
const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
