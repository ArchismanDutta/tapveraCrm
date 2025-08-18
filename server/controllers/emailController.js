// controllers/emailController.js
const nodemailer = require("nodemailer");
const User = require("../models/User");
const { decrypt } = require("../utils/crypto");

const TEMPLATES = {
  start: `Good morning Team,

Here’s my focus for today:

{task}

Thanks`,
  end: `Good evening Team,

Here’s an update on what I completed today:

{task}

Thanks`,
};

exports.sendOutlookEmail = async (req, res) => {
  try {
    console.log("📨 Email send request body:", req.body);
    console.log("📨 Auth user:", req.user);

    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await User.findById(userId);
    if (!user || !user.outlookEmail || !user.outlookAppPassword) {
      return res.status(400).json({ error: "Outlook credentials not set on profile" });
    }

    const { template, task } = req.body;
    if (!template || !TEMPLATES[template]) {
      return res.status(400).json({ error: "Invalid template selected" });
    }
    if (!task || !String(task).trim()) {
      return res.status(400).json({ error: "Task is required" });
    }

    const today = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const subject = `Today's work update - ${today}`;
    const body = TEMPLATES[template].replace("{task}", String(task).trim());

    // Recipients from env
    const adminList = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (adminList.length === 0) {
      return res.status(400).json({ error: "No admin recipients configured" });
    }

    const decryptedPassword = decrypt(user.outlookAppPassword);

    // Determine SMTP host based on user's email domain
    const emailDomain = user.outlookEmail.split("@")[1].toLowerCase();
    let smtpConfig;

    if (emailDomain === "gmail.com") {
      // Use Gmail SMTP
      smtpConfig = {
        host: "smtp.gmail.com",
        port: 587,
        secure: false, // TLS will be used automatically
        auth: {
          user: user.outlookEmail,
          pass: decryptedPassword,
        },
        tls: { rejectUnauthorized: false },
      };
    } else {
      // Default to Outlook SMTP
      smtpConfig = {
        host: "smtp.office365.com",
        port: 587,
        secure: false,
        auth: {
          user: user.outlookEmail,
          pass: decryptedPassword,
        },
      };
    }

    const transporter = nodemailer.createTransport(smtpConfig);

    console.log("📨 Sending email with:", {
      from: user.outlookEmail,
      to: adminList,
      subject,
    });

    await transporter.sendMail({
      from: user.outlookEmail,
      to: adminList,
      subject,
      text: body,
    });

    return res.json({ success: true, message: "Email sent successfully" });
  } catch (error) {
    console.error("❌ Outlook Email Error:", error);
    return res.status(500).json({ error: error.message || "Failed to send email" });
  }
};
