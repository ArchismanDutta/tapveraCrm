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

    // Validate required fields
    if (!employeeId || !name || !email || !contact || !dob || !gender || !doj) {
      return res.status(400).json({ message: "Required fields are missing." });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const trimmedEmployeeId = String(employeeId).trim();

    // Check duplicates
    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(400).json({ message: "Email already in use." });
    }
    if (await User.findOne({ employeeId: trimmedEmployeeId })) {
      return res.status(400).json({ message: "Employee ID already in use." });
    }

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
      status: status ? String(status).toLowerCase().trim() : "inactive",
      totalPl: Number.isFinite(parsedTotalPl) ? parsedTotalPl : 0,
      password: userPassword, // ⚠️ consider hashing
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
// Employee Directory (with filters & search)
// ======================
exports.getEmployeeDirectory = async (req, res) => {
  try {
    let { department, designation, status, search } = req.query;
    const filter = {};

    if (department && department !== "all") filter.department = String(department).trim();
    if (designation && designation !== "all") {
      filter.designation = { $regex: String(designation).trim(), $options: "i" };
    }
    if (status && status !== "all") filter.status = String(status).toLowerCase().trim();
    if (search) {
      const searchTerm = String(search).trim();
      filter.$or = [
        { name: { $regex: searchTerm, $options: "i" } },
        { email: { $regex: searchTerm, $options: "i" } },
        { employeeId: { $regex: searchTerm, $options: "i" } },
      ];
    }

    const employees = await User.find(filter)
      .select("_id employeeId name email contact department designation role status doj")
      .sort({ name: 1 });

    const employeesWithStatus = employees.map((emp) => ({
      ...emp.toObject(),
      status: emp.status || "inactive",
    }));

    res.json(employeesWithStatus);
  } catch (err) {
    console.error("Error fetching employee directory:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ======================
// Get All Users (admin & super-admin minimal list)
// ======================
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select(
      "_id name email role department designation employeeId"
    );
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
    if (!req.user?._id) return res.status(404).json({ message: "User not found" });

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
      status: user.status || "inactive",
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

// ======================
// Get Single Employee by ID
// ======================
exports.getEmployeeById = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const employee = {
      ...user,
      status: user.status || "inactive",
      personalInfo: {
        dob: user.dob || "",
        gender: user.gender || "",
        nationality: user.nationality || "",
      },
      contactInfo: {
        email: user.email || "",
        phone: user.contact || "",
        address: user.currentAddress || "",
      },
      employmentDetails: {
        designation: user.designation || "",
        department: user.department || "",
        dateOfJoining: user.doj || "",
        status: user.status || "inactive",
      },
      salary: {
        basic: user.salary || 0,
        total: user.salary || 0,
        paymentMode: user.paymentMode || "bank",
      },
      qualifications: {
        education: user.qualifications || [],
        skills: user.skills || [],
      },
    };

    res.json(employee);
  } catch (err) {
    console.error("Error fetching employee by ID:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ======================
// Update Employee Status
// ======================
exports.updateEmployeeStatus = async (req, res) => {
  try {
    const userId = req.params.id;
    const { status } = req.body;

    if (!["active", "inactive"].includes(status))
      return res.status(400).json({ message: "Invalid status value" });

    const user = await User.findByIdAndUpdate(userId, { status }, { new: true });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ message: "Status updated successfully", user });
  } catch (err) {
    console.error("Update employee status error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
