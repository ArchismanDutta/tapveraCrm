// controllers/authController.js
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

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
      outlookAppPassword // NEW FIELD
    } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.trim() });
    if (existingUser) {
      return res.status(400).json({ message: "Email already in use." });
    }

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password.trim(), 10);

    // Create user
    const user = new User({
      name,
      email: email.trim(),
      contact,
      dob,
      gender,
      password: hashedPassword,
      role: "employee",
      department,
      designation,
      outlookAppPassword // store Outlook app password
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
        outlookAppPassword: user.outlookAppPassword,
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

    // Basic validation
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required." });
    }

    const user = await User.findOne({ email: email.trim() });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // Compare hashed password
    const isMatch = await bcrypt.compare(password.trim(), user.password);
    if (!isMatch) {
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
        outlookAppPassword: user.outlookAppPassword, // send to frontend if needed
      },
    });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
