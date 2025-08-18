const crypto = require("crypto");
const bcrypt = require("bcrypt");
const Token = require("../models/Token");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");

// Forgot Password Controller
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    // Generic response for security
    const genericMsg =
      "If an account with this email exists, a password reset link has been sent.";

    if (!user) {
      return res.json({ message: genericMsg });
    }

    // Remove any existing reset tokens for this user
    await Token.deleteMany({ userId: user._id });

    // Generate token (raw + hashed)
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = await bcrypt.hash(resetToken, 10);

    await new Token({ userId: user._id, token: hashedToken }).save();

    if (!process.env.FRONTEND_URL) {
      console.error("❌ FRONTEND_URL not set in .env");
      return res
        .status(500)
        .json({ message: "Server configuration error: FRONTEND_URL missing" });
    }

    // Build reset link
    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    // Detect provider based on email domain
    let provider = "gmail"; // default
    if (user.email.includes("@outlook.") || user.email.includes("@hotmail.") || user.email.includes("@live.")) {
      provider = "outlook";
    }

    // Send email with correct SMTP provider
    await sendEmail({
      provider, // now dynamic!
      to: user.email,
      subject: "Password Reset Request",
      html: `
        <p>Hello ${user.name || "User"},</p>
        <p>You requested a password reset. Click the link below:</p>
        <p><a href="${resetLink}" target="_blank" rel="noopener noreferrer">${resetLink}</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request this, please ignore this email.</p>
      `,
    });

    return res.json({ message: genericMsg });
  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Reset Password Controller
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || !password.trim()) {
      return res.status(400).json({ message: "Password is required" });
    }

    // Check tokens
    const tokens = await Token.find();
    let passwordResetToken = null;

    for (const t of tokens) {
      const match = await bcrypt.compare(token, t.token);
      if (match) {
        passwordResetToken = t;
        break;
      }
    }

    if (!passwordResetToken) {
      return res.status(400).json({ message: "Invalid or expired link" });
    }

    // Get user
    const user = await User.findById(passwordResetToken.userId);
    if (!user) return res.status(400).json({ message: "User not found" });

    // Save new password
    user.password = await bcrypt.hash(password.trim(), 10);
    await user.save();

    // Remove used token
    await passwordResetToken.deleteOne();

    res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("Reset Password Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
