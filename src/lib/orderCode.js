const crypto = require("crypto");

// "YYYYMMDD" + 6 random digits, e.g. "20260611482913".
function generateOrderCode() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  return `${datePart}${randomPart}`;
}

module.exports = { generateOrderCode };
