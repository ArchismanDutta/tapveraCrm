// server/emailServer.js
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
    const body = TEMPLATES[template].replace("{task}", task);

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.TO_EMAIL,
      cc: process.env.CC_EMAILS ? process.env.CC_EMAILS.split(",") : [],
      subject,
      text: body,
    });

    res.json({ message: "Email sent successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(5001, () => {
  console.log("📨 Email server running on port 5001");
});
