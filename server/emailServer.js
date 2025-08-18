import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Email templates
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

// Verify required environment variables on startup
const {
  EMAIL_USER,
  EMAIL_PASSWORD,
  TO_EMAIL,
  CC_EMAILS,
  PORT = 5001,
} = process.env;

if (!EMAIL_USER || !EMAIL_PASSWORD || !TO_EMAIL) {
  console.error(
    "❌ Missing required environment variables: EMAIL_USER, EMAIL_PASSWORD, or TO_EMAIL"
  );
  process.exit(1);
}

// POST route to send email
app.post("/send", async (req, res) => {
  try {
    const { template, task } = req.body;

    if (!template || !TEMPLATES[template]) {
      return res.status(400).json({ error: "Invalid template selected" });
    }

    if (!task || !task.trim()) {
      return res.status(400).json({ error: "Task is required" });
    }

    const today = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const subject = `Today's work update - ${today}`;
    const body = TEMPLATES[template].replace("{task}", task.trim());

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: EMAIL_USER,
      to: TO_EMAIL,
      cc: CC_EMAILS ? CC_EMAILS.split(",").map((email) => email.trim()) : [],
      subject,
      text: body,
    });

    res.json({ message: "Email sent successfully!" });
  } catch (error) {
    console.error("❌ Error sending email:", error);
    res.status(500).json({ error: error.message || "Failed to send email" });
  }
});

app.listen(PORT, () => {
  console.log(`📨 Email server running on port ${PORT}`);
});
