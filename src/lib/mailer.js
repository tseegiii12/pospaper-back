const nodemailer = require("nodemailer");

// Lazily created so the process doesn't fail to boot when SMTP env vars
// aren't set yet (e.g. in local dev before mail is configured).
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;
  if (!SMTP_HOST) {
    throw new Error("SMTP_HOST is not set. Configure SMTP_* env vars before sending email.");
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: SMTP_SECURE === "true",
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });

  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  if (!process.env.SMTP_HOST) {
    // No SMTP configured yet — log instead of sending so registration/etc.
    // still works end-to-end during local dev.
    console.log(`[mailer] SMTP not configured, would send to ${to}: ${subject}\n${text}`);
    return;
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  return getTransporter().sendMail({ from, to, subject, html, text });
}

async function sendOtpEmail({ to, code }) {
  return sendMail({
    to,
    subject: "Бүртгэлийн баталгаажуулах код",
    text: `Таны баталгаажуулах код: ${code}. Энэ код 5 минутын дараа хүчингүй болно.`,
    html: `<p>Таны баталгаажуулах код: <b style="font-size:20px">${code}</b></p><p>Энэ код 5 минутын дараа хүчингүй болно.</p>`,
  });
}

module.exports = { sendMail, sendOtpEmail };
