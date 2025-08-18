// controllers/authController.js
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const { encrypt } = require("../utils/crypto"); // For encrypting Outlook app password

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
      outlookEmail, // optional
      outlookAppPassword, // optional (will be encrypted)
    } = req.body;

    // Validate mandatory fields if needed

    // Normalize email and trim
    const normalizedEmail = String(email || "").trim().toLowerCase();

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: "Email already in use." });
    }

    // No hashing of login password (as per your comment)
    const plainPassword = String(password || "").trim();

    // Encrypt Outlook app password if provided
    let encryptedOutlookPass = null;
    if (outlookAppPassword && String(outlookAppPassword).trim()) {
      encryptedOutlookPass = encrypt(String(outlookAppPassword).trim());
    }

    const user = new User({
      name,
      email: normalizedEmail,
      contact,
      dob,
      gender,
      password: plainPassword,
      role: "employee",
      department,
      designation,
      outlookEmail: String(outlookEmail || "").trim().toLowerCase() || null,
      outlookAppPassword: encryptedOutlookPass,
    });

    await user.save();

    // Generate JWT token
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

    // Validate presence of email & password
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Find user by email
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // Direct string comparison - no hashing
    if (String(password).trim() !== user.password) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // Generate JWT token
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
