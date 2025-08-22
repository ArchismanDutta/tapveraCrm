const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { encrypt } = require("../utils/crypto"); // for Outlook app password only

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
      outlookEmail, // optional
      outlookAppPassword, // optional (will be encrypted)
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

    // 🔒 Hash login password
    const hashedPassword = await bcrypt.hash(String(password).trim(), 10);

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
      password: hashedPassword,
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
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // 🔒 Compare hashed password
    const isMatch = await bcrypt.compare(String(password).trim(), user.password);
    if (!isMatch) {
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
