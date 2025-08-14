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

    const user = await User.findOne({ email: email.trim() });

    // Security: Always send same message whether user exists or not
    const genericMsg =
      "If an account with this email exists, a password reset link has been sent.";

    if (!user) {
      return res.json({ message: genericMsg });
    }

    // Remove existing reset tokens
    await Token.deleteMany({ userId: user._id });

    // Generate reset token (raw for email, hashed for DB)
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = await bcrypt.hash(resetToken, 10);

    await new Token({ userId: user._id, token: hashedToken }).save();

    if (!process.env.FRONTEND_URL) {
      console.error("❌ FRONTEND_URL not set in .env");
      return res
        .status(500)
        .json({ message: "Server configuration error: FRONTEND_URL missing" });
    }

    // Build reset link (only token in path here)
    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    // Send reset link
    await sendEmail(
      user.email,
      "Password Reset Request",
      `
        <p>Hello ${user.name || "User"},</p>
        <p>You requested a password reset. Click the link below:</p>
        <p><a href="${resetLink}" target="_blank">${resetLink}</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request this, please ignore this email.</p>
      `
    );

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

    // Find any token entry and match hash
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

    // Get user from token
    const user = await User.findById(passwordResetToken.userId);
    if (!user) return res.status(400).json({ message: "User not found" });

    // Hash and save new password
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
