// controllers/authController.js
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const { encrypt } = require("../utils/crypto"); // still needed for Outlook app password

// Token generation helper
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
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
      name,
      email,
      contact,
      dob,
      gender,
      password,
      department,
      designation,
      outlookEmail,         // optional
      outlookAppPassword,   // optional (will be encrypted)
    } = req.body;

    const existingUser = await User.findOne({ email: String(email || "").trim().toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: "Email already in use." });
    }

    // 🚨 NO HASHING for login password
    const plainPassword = String(password || "").trim();

    let encryptedOutlookPass = null;
    if (outlookAppPassword && String(outlookAppPassword).trim()) {
      encryptedOutlookPass = encrypt(String(outlookAppPassword).trim());
    }

    const user = new User({
      name,
      email: String(email || "").trim().toLowerCase(),
      contact,
      dob,
      gender,
      password: plainPassword, // stored as plain text
      role: "employee",
      department,
      designation,
      outlookEmail: String(outlookEmail || "").trim().toLowerCase() || null,
      outlookAppPassword: encryptedOutlookPass, // encrypted or null
    });

    await user.save();

    const token = generateToken(user);

    res.status(201).json({
      token,
      user: {
        id: user._id,
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

    const user = await User.findOne({ email: String(email).trim().toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // 🚨 Direct string comparison (no bcrypt)
    if (String(password).trim() !== user.password) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user._id,
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
      },
    });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
