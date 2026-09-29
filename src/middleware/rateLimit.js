const rateLimit = require("express-rate-limit");

// General guard for all /api traffic.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Хэт олон хүсэлт илгээлээ. Түр хүлээгээд дахин оролдоно уу." },
});

// Tighter guard for auth endpoints — these are the targets for
// credential-stuffing and OTP-spam, so they need a much lower ceiling
// than general API traffic.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: "Хэт олон оролдлого хийлээ. 15 минутын дараа дахин оролдоно уу." },
});

module.exports = { apiLimiter, authLimiter };
