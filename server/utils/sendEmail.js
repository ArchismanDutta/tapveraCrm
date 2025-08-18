const nodemailer = require("nodemailer");

async function sendEmail({ provider = "gmail", from, to, subject, text, html, auth }) {
  try {
    let transporter;

    if (provider === "gmail") {
      transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || "smtp.gmail.com",
        port: Number(process.env.EMAIL_PORT) || 587,
        secure: false, // TLS will be used automatically if supported
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        tls: { rejectUnauthorized: false },
      });
      from = from || `"Tapvera CRM" <${process.env.EMAIL_USER}>`;
    } else if (provider === "outlook") {
      if (!auth || !auth.user || !auth.pass) {
        throw new Error("Outlook auth user and pass must be provided");
      }
      transporter = nodemailer.createTransport({
        host: "smtp.office365.com",
        port: 587,
        secure: false,
        auth: {
          user: auth.user,
          pass: auth.pass,
        },
      });
      from = from || auth.user;
    } else {
      throw new Error(`Unsupported email provider: ${provider}`);
    }

    await transporter.sendMail({ from, to, subject, text, html });

    console.log(`✅ Email sent via ${provider} to ${to}`);
  } catch (err) {
    console.error(`❌ Error sending ${provider} email to ${to}`, err);
    throw err;
  }
}

module.exports = sendEmail;
