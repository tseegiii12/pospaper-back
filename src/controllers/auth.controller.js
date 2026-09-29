const bcrypt = require("bcryptjs");
const { OAuth2Client } = require("google-auth-library");
const prisma = require("../lib/prisma");
const { signToken } = require("../utils/jwt");
const { generateOtpCode } = require("../utils/otp");
const { sendOtpEmail } = require("../lib/mailer");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const OTP_EXPIRY_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 5;
const CUSTOMER_TYPES = ["PERSON", "ORGANIZATION"];
// Regнум is usually 7 digits but state registration numbers for some entity
// types use letters or a different length, so this only sanity-checks length
// and character set rather than enforcing exactly 7 digits.
const REG_NUMBER_PATTERN = /^[A-Za-zА-Яа-яЁёӨөҮү0-9]{5,20}$/;

function toPublicUser(user) {
  const { passwordHash, ...publicUser } = user;
  return publicUser;
}

function normalizeCustomerType(rawType) {
  const type = (rawType || "PERSON").toUpperCase();
  return CUSTOMER_TYPES.includes(type) ? type : null;
}

// Validates the fields specific to the chosen customer type and returns the
// normalized org fields (or nulls for PERSON). Returns { error } on failure.
function validateTypeFields(type, { orgName, regNumber }) {
  if (type === "PERSON") {
    return { orgName: null, regNumber: null };
  }

  const trimmedOrgName = (orgName || "").trim();
  const trimmedRegNumber = (regNumber || "").trim();

  if (!trimmedOrgName) {
    return { error: "Байгууллагын нэр шаардлагатай." };
  }
  if (!REG_NUMBER_PATTERN.test(trimmedRegNumber)) {
    return { error: "Байгууллагын регистрийн дугаар буруу байна." };
  }

  return { orgName: trimmedOrgName, regNumber: trimmedRegNumber };
}

async function requestRegisterOtp(req, res) {
  const { phone, email, password, name, orgName, regNumber } = req.body;
  const type = normalizeCustomerType(req.body.type);

  if (!type) {
    return res.status(400).json({ error: "Харилцагчийн төрөл буруу байна." });
  }
  if (!phone || !email || !password) {
    return res.status(400).json({ error: "Утасны дугаар, имэйл болон нууц үг шаардлагатай." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Нууц үг 6-с дээш тэмдэгттэй байх ёстой." });
  }

  const typeFields = validateTypeFields(type, { orgName, regNumber });
  if (typeFields.error) {
    return res.status(400).json({ error: typeFields.error });
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { phone },
        { email },
        ...(typeFields.regNumber ? [{ regNumber: typeFields.regNumber }] : []),
      ],
    },
  });
  if (existing) {
    return res.status(409).json({
      error:
        existing.regNumber && existing.regNumber === typeFields.regNumber
          ? "Энэ регистрийн дугаараар бүртгэлтэй байгууллага байна."
          : "Энэ утасны дугаар эсвэл имэйлээр бүртгэлтэй хэрэглэгч байна.",
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await prisma.registrationOtp.upsert({
    where: { email },
    create: {
      email,
      phone,
      name,
      passwordHash,
      code,
      expiresAt,
      type,
      orgName: typeFields.orgName,
      regNumber: typeFields.regNumber,
    },
    update: {
      phone,
      name,
      passwordHash,
      code,
      expiresAt,
      attempts: 0,
      type,
      orgName: typeFields.orgName,
      regNumber: typeFields.regNumber,
    },
  });

  await sendOtpEmail({ to: email, code });

  res.json({ message: "Баталгаажуулах код имэйлээр илгээгдлээ." });
}

async function verifyRegisterOtp(req, res) {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: "Имэйл болон баталгаажуулах код шаардлагатай." });
  }

  const pending = await prisma.registrationOtp.findUnique({ where: { email } });
  if (!pending) {
    return res.status(400).json({ error: "Энэ имэйлээр хүсэлт олдсонгүй. Дахин бүртгүүлнэ үү." });
  }

  if (pending.expiresAt < new Date()) {
    await prisma.registrationOtp.delete({ where: { email } });
    return res.status(400).json({ error: "Баталгаажуулах кодын хугацаа дууссан. Дахин бүртгүүлнэ үү." });
  }

  if (pending.attempts >= MAX_OTP_ATTEMPTS) {
    await prisma.registrationOtp.delete({ where: { email } });
    return res.status(429).json({ error: "Оролдлогын тоо хэтэрсэн. Дахин бүртгүүлнэ үү." });
  }

  if (pending.code !== code) {
    await prisma.registrationOtp.update({
      where: { email },
      data: { attempts: { increment: 1 } },
    });
    return res.status(400).json({ error: "Баталгаажуулах код буруу байна." });
  }

  let user;
  try {
    user = await prisma.user.create({
      data: {
        phone: pending.phone,
        email: pending.email,
        name: pending.name,
        passwordHash: pending.passwordHash,
        type: pending.type,
        orgName: pending.orgName,
        regNumber: pending.regNumber,
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

  await prisma.registrationOtp.delete({ where: { email } });

  const token = signToken(user);
  res.status(201).json({ token, user: toPublicUser(user) });
}

async function login(req, res) {
  const { phone, password } = req.body;
  const type = normalizeCustomerType(req.body.type);

  if (!type) {
    return res.status(400).json({ error: "Харилцагчийн төрөл буруу байна." });
  }
  if (!phone || !password) {
    return res.status(400).json({ error: "Утасны дугаар болон нууц үг шаардлагатай." });
  }

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: "Утасны дугаар эсвэл нууц үг буруу байна." });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Утасны дугаар эсвэл нууц үг буруу байна." });
  }

  if (user.type !== type) {
    return res.status(401).json({
      error:
        user.type === "ORGANIZATION"
          ? "Энэ дугаар байгууллагын бүртгэлтэй. \"Байгууллага\" сонголтоор нэвтэрнэ үү."
          : "Энэ дугаар хувь хүний бүртгэлтэй. \"Хувь хүн\" сонголтоор нэвтэрнэ үү.",
    });
  }

  const token = signToken(user);
  res.json({ token, user: toPublicUser(user) });
}

async function me(req, res) {
  res.json({ user: toPublicUser(req.user) });
}

// Re-verifies the Google ID token and returns its payload, or null if invalid.
// Used by both googleAuth and completeGoogleSignup so the token is checked
// fresh each time rather than trusted across requests.
async function verifyGoogleCredential(credential) {
  if (!credential || !process.env.GOOGLE_CLIENT_ID) return null;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.email_verified) return null;
    return payload;
  } catch {
    return null;
  }
}

// Verifies a Google ID token from the frontend's Sign in with Google button
// and logs the user in, linking an existing phone/password account by
// matching email. If no account exists yet, this does NOT create one —
// the frontend must collect account type/phone (and org fields) first via
// completeGoogleSignup, since those fields aren't part of a Google profile.
async function googleAuth(req, res) {
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ error: "Google токен дутуу байна." });
  }
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(500).json({ error: "Google нэвтрэлт тохируулагдаагүй байна." });
  }

  const payload = await verifyGoogleCredential(credential);
  if (!payload) {
    return res.status(401).json({ error: "Google токен хүчингүй байна." });
  }

  let user = await prisma.user.findUnique({ where: { googleId: payload.sub } });
  if (!user) {
    const existing = await prisma.user.findUnique({ where: { email: payload.email } });
    if (existing) {
      user = await prisma.user.update({ where: { id: existing.id }, data: { googleId: payload.sub } });
    }
  }

  if (!user) {
    return res.json({
      needsProfile: true,
      profile: { email: payload.email, name: payload.name || null },
    });
  }

  const token = signToken(user);
  res.json({ token, user: toPublicUser(user) });
}

// Second step for a brand-new Google sign-up: re-verifies the same ID token
// and creates the account with the account type/phone (and org fields, if
// applicable) the frontend collected after googleAuth reported needsProfile.
async function completeGoogleSignup(req, res) {
  const { credential, phone, orgName, regNumber } = req.body;
  const type = normalizeCustomerType(req.body.type);

  if (!type) {
    return res.status(400).json({ error: "Харилцагчийн төрөл буруу байна." });
  }
  if (!phone) {
    return res.status(400).json({ error: "Утасны дугаар шаардлагатай." });
  }

  const typeFields = validateTypeFields(type, { orgName, regNumber });
  if (typeFields.error) {
    return res.status(400).json({ error: typeFields.error });
  }

  const payload = await verifyGoogleCredential(credential);
  if (!payload) {
    return res.status(401).json({ error: "Google токен хүчингүй байна." });
  }

  // The account may have been created (by this same sign-up, retried, or a
  // concurrent request) since the frontend last called googleAuth — if so,
  // just log that account in instead of trying to create a duplicate.
  let user = await prisma.user.findUnique({ where: { googleId: payload.sub } });
  if (!user) {
    const existing = await prisma.user.findUnique({ where: { email: payload.email } });
    if (existing) {
      user = await prisma.user.update({ where: { id: existing.id }, data: { googleId: payload.sub } });
    }
  }

  if (!user) {
    try {
      user = await prisma.user.create({
        data: {
          type,
          phone,
          email: payload.email,
          name: payload.name || null,
          googleId: payload.sub,
          orgName: typeFields.orgName,
          regNumber: typeFields.regNumber,
        },
      });
    } catch (err) {
      if (err.code === "P2002") {
        const target = err.meta?.target || [];
        const message = target.includes("regNumber")
          ? "Энэ регистрийн дугаараар бүртгэлтэй байгууллага байна."
          : "Энэ утасны дугаараар бүртгэлтэй хэрэглэгч байна.";
        return res.status(409).json({ error: message });
      }
      throw err;
    }
  }

  const token = signToken(user);
  res.status(201).json({ token, user: toPublicUser(user) });
}

module.exports = {
  requestRegisterOtp,
  verifyRegisterOtp,
  login,
  me,
  googleAuth,
  completeGoogleSignup,
};
