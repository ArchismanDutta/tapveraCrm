
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const generateToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });
};

// Employee Signup
exports.signup = async (req, res) => {
  try {
    const { name, email, contact, dob, gender, password } = req.body;

    // Simple validation
    if (!name || !email || !contact || !dob || !gender || !password) {
      return res
        .status(400)
        .json({ message: "Please fill all required fields." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email already in use." });

    const user = new User({
      name,
      email,
      contact,
      dob,
      gender,
      password, // hashed automatically by pre-save hook
      role: "employee", // only employee via signup
    });

    await user.save();

    const token = generateToken(user);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Login for all users
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password required." });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid credentials." });

    // Direct password check for plain text storage
    // const isMatch = await bcrypt.compare(password, user.password);
    // if (!isMatch) return res.status(401).json({ message: "Invalid credentials." });
    if (password !== user.password)
      return res.status(401).json({ message: "Invalid credentials." });

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
