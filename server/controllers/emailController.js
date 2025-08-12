const nodemailer = require("nodemailer");
const crypto = require("crypto");
const User = require("../models/User"); // adjust path

// Your encryption settings (must match your storage logic)
const ALGORITHM = "aes-256-cbc";
const KEY = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
const IV = Buffer.from(process.env.ENCRYPTION_IV, "hex");

function decrypt(text) {
  const encryptedText = Buffer.from(text, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, IV);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

exports.sendOutlookEmail = async (req, res) => {
  try {
    const userId = req.user.id; // assuming auth middleware sets req.user
    const user = await User.findById(userId);

    if (!user || !user.outlookEmail || !user.outlookAppPassword) {
      return res.status(400).json({ error: "Outlook credentials not set" });
    }

    // Decrypt app password
    const decryptedPassword = decrypt(user.outlookAppPassword);

    // Create transporter for Outlook
    const transporter = nodemailer.createTransport({
      host: "smtp.office365.com",
      port: 587,
      secure: false,
      auth: {
        user: user.outlookEmail,
        pass: decryptedPassword
      }
    });

    // Send email
    await transporter.sendMail({
      from: user.outlookEmail,
      to: req.body.to,
      subject: req.body.subject,
      text: req.body.message
    });

    res.json({ success: true, message: "Email sent successfully" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to send email" });
  }
};
