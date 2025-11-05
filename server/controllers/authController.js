// File: controllers/authController.js
const User = require("../models/User");
const Client = require("../models/Client");
const jwt = require("jsonwebtoken");
const { encrypt } = require("../utils/crypto"); // for optional Outlook password encryption
const Token = require("../models/Token");
const sendEmail = require("../utils/sendEmail");
const crypto = require("crypto");

// ======================
// JWT Token generation
// ======================
const generateToken = (user, userType = "User") => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role || "client",
      userType: userType,
      regions: user.regions || [user.region] || ['Global'], // Include regions array for filtering
      region: user.region || 'Global' // Keep old field for backwards compatibility
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
};

// ======================
// Employee Signup
// ======================
exports.signup = async (req, res) => {
  try {
    const {
      employeeId,
      name,
      email,
      contact,
      dob,
      gender,
      password,
      department,
      designation,
      outlookEmail,
      outlookAppPassword,
      doj,
      bloodGroup,
      permanentAddress,
      currentAddress,
      emergencyNo,
      ps,
      salary,
      ref,
      status,
      totalPl,
      location,
      employmentType,
      skills,
      qualifications,
    } = req.body;

    // Required fields validation
    if (
      !employeeId ||
      !name ||
      !email ||
      !contact ||
      !dob ||
      !gender ||
      !password ||
      !doj
    ) {
      return res
        .status(400)
        .json({ message: "Please provide all required fields." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const trimmedEmployeeId = String(employeeId).trim();

    // Check duplicates
    const existingEmailUser = await User.findOne({ email: normalizedEmail });
    if (existingEmailUser) {
      return res.status(400).json({ message: "Email already in use." });
    }

    const existingEmployeeIdUser = await User.findOne({
      employeeId: trimmedEmployeeId,
    });
    if (existingEmployeeIdUser) {
      return res.status(400).json({ message: "Employee ID already in use." });
    }

    // Encrypt Outlook password if provided
    let encryptedOutlookPass = null;
    if (outlookAppPassword && String(outlookAppPassword).trim()) {
      encryptedOutlookPass = encrypt(String(outlookAppPassword).trim());
    }

    const user = new User({
      employeeId: trimmedEmployeeId,
      name: String(name).trim(),
      email: normalizedEmail,
      contact: String(contact).trim(),
      dob,
      gender,
      password: String(password).trim(), // PLAIN-TEXT password
      role: "employee",
      department: department || "",
      designation: designation ? String(designation).trim() : "",
      employmentType: employmentType || "full-time",
      skills: Array.isArray(skills) ? skills.map((s) => s.trim()) : [],
      qualifications: Array.isArray(qualifications) ? qualifications : [],
      outlookEmail: outlookEmail
        ? String(outlookEmail).trim().toLowerCase()
        : "",
      outlookAppPassword: encryptedOutlookPass || "",
      doj,
      bloodGroup: bloodGroup ? String(bloodGroup).trim() : "",
      permanentAddress: permanentAddress ? String(permanentAddress).trim() : "",
      currentAddress: currentAddress ? String(currentAddress).trim() : "",
      emergencyNo: emergencyNo ? String(emergencyNo).trim() : "",
      ps: ps ? String(ps).trim() : "",
      salary: salary ? Number(salary) : 0,
      ref: ref ? String(ref).trim() : "",
      status: status || "active",
      totalPl: totalPl !== undefined ? Number(totalPl) : 0,
      location: location ? String(location).trim() : "India",
    });

    await user.save();

    const token = generateToken(user);

    res.status(201).json({ token, user });
  } catch (err) {
    console.error("Signup Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ======================
// Login (plain-text password check)
// Supports both User (employees/admin) and Client login
// ======================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password required." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // First, try to find as User (employee/admin)
    let user = await User.findOne({ email: normalizedEmail });
    let userType = "User";

    // If not found in User, try Client
    if (!user) {
      user = await Client.findOne({ email: normalizedEmail });
      userType = "Client";

      if (!user) {
        return res.status(401).json({ message: "Invalid credentials." });
      }
    }

    // Plain-text password check
    if (String(password).trim() !== user.password) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // For clients, set role as 'client'
    if (userType === "Client") {
      user = user.toObject();
      user.role = "client";
    }

    const token = generateToken(user, userType);

    res.json({ token, user, userType });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ======================
// Forgot Password
// ======================
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    const genericMsg =
      "If an account with this email exists, a password reset link has been sent.";
    if (!user) return res.json({ message: genericMsg });

    // Remove existing tokens
    await Token.deleteMany({ userId: user._id });

    const resetToken = crypto.randomBytes(32).toString("hex");
    await new Token({ userId: user._id, token: resetToken }).save();

    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    let provider = "gmail";
    if (
      user.email.includes("@outlook.") ||
      user.email.includes("@hotmail.") ||
      user.email.includes("@live.")
    ) {
      provider = "outlook";
    }

    await sendEmail({
      provider,
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

// ======================
// Reset Password (plain-text update)
// ======================
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || !password.trim()) {
      return res.status(400).json({ message: "Password is required" });
    }

    const passwordResetToken = await Token.findOne({ token });
    if (!passwordResetToken) {
      return res.status(400).json({ message: "Invalid or expired link" });
    }

    const user = await User.findById(passwordResetToken.userId);
    if (!user) return res.status(400).json({ message: "User not found" });

    // Update plain-text password
    user.password = String(password).trim();
    await user.save();

    await passwordResetToken.deleteOne();

    res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("Reset Password Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
