// controllers/authController.js
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const { encrypt } = require("../utils/crypto"); // optional for Outlook password
const Token = require("../models/Token");
const sendEmail = require("../utils/sendEmail");

// Token generation helper
const generateToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });
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
    } = req.body;

    if (!employeeId || !name || !email || !contact || !dob || !gender || !password || !doj) {
      return res.status(400).json({ message: "Please provide all required fields." });
    }

    const normalizedEmail = String(email || "").trim().toLowerCase();
    const trimmedEmployeeId = String(employeeId || "").trim();

    const existingEmailUser = await User.findOne({ email: normalizedEmail });
    if (existingEmailUser) return res.status(400).json({ message: "Email already in use." });

    const existingEmployeeIdUser = await User.findOne({ employeeId: trimmedEmployeeId });
    if (existingEmployeeIdUser) return res.status(400).json({ message: "Employee ID already in use." });

    // 🔐 Encrypt Outlook app password if provided
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
      password: String(password).trim(), // store plain text
      role: "employee",
      department,
      designation,
      outlookEmail: outlookEmail ? String(outlookEmail).trim().toLowerCase() : null,
      outlookAppPassword: encryptedOutlookPass,
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

    res.status(201).json({
      token,
      user: {
        id: user._id,
        employeeId: user.employeeId,
        name: user.name,
        email: user.email,
        contact: user.contact,
        dob: user.dob,
        gender: user.gender,
        role: user.role,
        department: user.department,
        designation: user.designation,
        outlookEmail: user.outlookEmail || null,
        hasEmailCredentials: Boolean(user.outlookEmail && user.outlookAppPassword),
        doj: user.doj,
        bloodGroup: user.bloodGroup,
        permanentAddress: user.permanentAddress,
        currentAddress: user.currentAddress,
        emergencyNo: user.emergencyNo,
        ps: user.ps,
        salary: user.salary,
        ref: user.ref,
        status: user.status,
        totalPl: user.totalPl,
        location: user.location,
      },
    });
  } catch (err) {
    console.error("Signup Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ======================
// Login for all users
// ======================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(401).json({ message: "Invalid credentials." });

    // Compare plain text password
    if (String(password).trim() !== user.password) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user._id,
        employeeId: user.employeeId,
        name: user.name,
        email: user.email,
        contact: user.contact,
        dob: user.dob,
        gender: user.gender,
        role: user.role,
        department: user.department,
        designation: user.designation,
        outlookEmail: user.outlookEmail || null,
        hasEmailCredentials: Boolean(user.outlookEmail && user.outlookAppPassword),
        doj: user.doj,
        bloodGroup: user.bloodGroup,
        permanentAddress: user.permanentAddress,
        currentAddress: user.currentAddress,
        emergencyNo: user.emergencyNo,
        ps: user.ps,
        salary: user.salary,
        ref: user.ref,
        status: user.status,
        totalPl: user.totalPl,
        location: user.location,
      },
    });
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
    const genericMsg = "If an account with this email exists, a password reset link has been sent.";

    if (!user) return res.json({ message: genericMsg });

    await Token.deleteMany({ userId: user._id });

    const resetToken = require("crypto").randomBytes(32).toString("hex");

    await new Token({ userId: user._id, token: resetToken }).save();

    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    let provider = "gmail";
    if (user.email.includes("@outlook.") || user.email.includes("@hotmail.") || user.email.includes("@live.")) {
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
// Reset Password
// ======================
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || !password.trim()) {
      return res.status(400).json({ message: "Password is required" });
    }

    const passwordResetToken = await Token.findOne({ token });
    if (!passwordResetToken) return res.status(400).json({ message: "Invalid or expired link" });

    const user = await User.findById(passwordResetToken.userId);
    if (!user) return res.status(400).json({ message: "User not found" });

    user.password = password.trim(); // store plain text
    await user.save();

    await passwordResetToken.deleteOne();

    res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("Reset Password Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
