// controllers/userController.js
const User = require("../models/User");

// ======================
// Create Employee (admin/hr/super-admin)
// ======================
exports.createEmployee = async (req, res) => {
  try {
    const {
      employeeId,
      name,
      email,
      contact,
      dob,
      gender,
      bloodGroup,
      qualification,
      permanentAddress,
      currentAddress,
      emergencyNo,
      ps,
      doj,
      salary,
      ref,
      status,
      totalPl,
      department,
      designation,
      password,
    } = req.body;

    if (!employeeId || !name || !email || !contact || !dob || !gender || !doj) {
      return res.status(400).json({ message: "Required fields are missing." });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const trimmedEmployeeId = String(employeeId).trim();

    const existingEmail = await User.findOne({ email: normalizedEmail });
    if (existingEmail) return res.status(400).json({ message: "Email already in use." });

    const existingEmpId = await User.findOne({ employeeId: trimmedEmployeeId });
    if (existingEmpId) return res.status(400).json({ message: "Employee ID already in use." });

    const userPassword = String(password || "Welcome123").trim();
    const parsedSalary = typeof salary === "number" ? salary : Number(salary || 0);
    const parsedTotalPl = typeof totalPl === "number" ? totalPl : Number(totalPl || 0);

    const user = new User({
      employeeId: trimmedEmployeeId,
      name: String(name).trim(),
      email: normalizedEmail,
      contact: String(contact).trim(),
      dob,
      gender,
      bloodGroup: bloodGroup ? String(bloodGroup).trim() : "",
      qualification: qualification ? String(qualification).trim() : "",
      permanentAddress: permanentAddress ? String(permanentAddress).trim() : "",
      currentAddress: currentAddress ? String(currentAddress).trim() : "",
      emergencyNo: emergencyNo ? String(emergencyNo).trim() : "",
      ps: ps ? String(ps).trim() : "",
      doj,
      salary: Number.isFinite(parsedSalary) ? parsedSalary : 0,
      ref: ref ? String(ref).trim() : "",
      status: status || "active",
      totalPl: Number.isFinite(parsedTotalPl) ? parsedTotalPl : 0,
      password: userPassword, // plain text (per requirement)
      department: department || "",
      designation: designation ? String(designation).trim() : "",
      role: "employee",
    });

    await user.save();

    res.status(201).json({ message: "Employee created successfully", user });
  } catch (error) {
    console.error("Create employee error", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ======================
// Get All Users (list for Admin task assigning)
// ======================
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("_id name email role department designation employeeId");
    res.json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ======================
// Get Current Logged-in User
// ======================
exports.getMe = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = await User.findById(req.user._id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
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
      outlookEmail: user.outlookEmail || null,
      hasEmailCredentials: Boolean(user.outlookEmail && user.outlookAppPassword),
    });
  } catch (err) {
    console.error("GetMe Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
