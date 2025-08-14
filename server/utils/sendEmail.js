// utils/sendEmail.js
const nodemailer = require('nodemailer');

const sendEmail = async (to, subject, html) => {
  try {
    // Create transporter for Gmail
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: false, // For port 587, false (TLS encryption used automatically)
      auth: {
        user: process.env.EMAIL_USER, // Gmail address from .env
        pass: process.env.EMAIL_PASS, // Gmail App Password from .env
      },
      tls: {
        rejectUnauthorized: false, // Allow self-signed certificates
      },
    });

    // Send email
    await transporter.sendMail({
      from: `"Tapvera CRM" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log(`✅ Email sent to ${to}`);
  } catch (err) {
    console.error(`❌ Error sending email to ${to}`, err);
    throw err;
  }
};

module.exports = sendEmail;
