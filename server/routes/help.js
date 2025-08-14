const express = require("express");
const multer = require("multer");
const nodemailer = require("nodemailer");
const axios = require("axios");

const router = express.Router();

// ===== Multer for file uploads =====
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 } // 10MB max, 5 files
});

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const ADMIN_WHATSAPPS = (process.env.ADMIN_WHATSAPP_NUMBERS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// ===== Email transporter =====
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT || 587),
  secure: false,
  auth: { 
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS 
  },
});

// ===== WhatsApp helper =====
async function sendWhatsApp(toNumber, text) {
  if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_ID) return;
  const url = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`;
  await axios.post(
    url,
    {
      messaging_product: "whatsapp",
      to: toNumber,
      type: "text",
      text: { body: text },
    },
    { 
      headers: { 
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json" 
      } 
    }
  );
}

// ===== POST /api/help/issues =====
router.post("/issues", upload.array("attachments"), async (req, res) => {
  try {
    const { title, priority, description } = req.body;
    const files = req.files || [];

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Title is required" });
    }

    const html = `
      <h2>New Help Issue Submitted</h2>
      <p><b>Title:</b> ${title}</p>
      <p><b>Priority:</b> ${priority || "—"}</p>
      <p><b>Description:</b><br/>${(description || "").replace(/\n/g, "<br/>")}</p>
    `;

    const attachments = files.map((f) => ({
      filename: f.originalname,
      content: f.buffer,
      contentType: f.mimetype
    }));

    // Send email to all admins
    if (ADMIN_EMAILS.length > 0) {
      await transporter.sendMail({
        from: `"Help Center" <${process.env.EMAIL_USER}>`,
        to: ADMIN_EMAILS,
        subject: `Help Issue: ${title} (${priority || "No priority"})`,
        html,
        attachments,
      });
    }

    // Send WhatsApp messages
    const waText = `New Help Issue\nTitle: ${title}\nPriority: ${priority || "—"}`;
    await Promise.all(
      ADMIN_WHATSAPPS.map((num) => sendWhatsApp(num, waText).catch(() => null))
    );

    res.json({ ok: true, message: "Issue submitted and sent to admins." });
  } catch (err) {
    console.error("Help issue error:", err.message);
    res.status(500).json({ message: "Failed to submit issue" });
  }
});

module.exports = router;
