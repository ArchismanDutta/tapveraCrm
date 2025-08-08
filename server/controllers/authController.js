// Employee Signup
const User = require("../models/User");
const jwt = require("jsonwebtoken");

// Token generation helper
const generateToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });
};

exports.signup = async (req, res) => {
  try {
    // Destructure including the new fields
    const {
      name,
      email,
      contact,
      dob,
      gender,
      password,
      department,
      designation,
    } = req.body;

    // Since we use express-validator, simple validation here is no longer necessary.
    // But if you want to keep a quick check, uncomment below:

    /*
    if (!name || !email || !contact || !dob || !gender || !password) {
      return res.status(400).json({ message: "Please fill all required fields." });
    }
    */

    // Check if user with this email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email already in use." });

    // Create a new user with all fields
    const user = new User({
      name,
      email,
      contact,
      dob,
      gender,
      password, // hashed automatically by pre-save hook unless disabled
      role: "employee", // only employee via signup
      department, // optional field with enum validation done earlier
      designation, // optional string free text
    });

    // Save the user to database
    await user.save();

    // Generate JWT token for the user
    const token = generateToken(user);

    // Respond with token and user info (without password)
    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        designation: user.designation,
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
