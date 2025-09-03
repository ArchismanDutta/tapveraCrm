const User = require("../models/User");
const Task = require("../models/Task");
const LeaveRequest = require("../models/LeaveRequest");

// Create employee
exports.createEmployee = async (req, res) => {
  try {
    const {
      employeeId, name, email, contact, dob, gender, bloodGroup,
      qualifications, permanentAddress, currentAddress, emergencyContact,
      ps, doj, salary, ref, status, totalPl,
      department, designation, password, shift, shiftType,
      skills, jobLevel
    } = req.body;

    // Required field validation
    if (!employeeId || !name || !email || !contact || !dob || !gender || !doj) {
      return res.status(400).json({ message: "Required fields are missing." });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const trimmedEmployeeId = String(employeeId).trim();

    // Check uniqueness
    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(400).json({ message: "Email already in use." });
    }
    if (await User.findOne({ employeeId: trimmedEmployeeId })) {
      return res.status(400).json({ message: "Employee ID already in use." });
    }

    // Normalize skills
    const skillsArray = Array.isArray(skills)
      ? skills.map(s => s.trim()).filter(Boolean)
      : typeof skills === "string"
        ? skills.split(",").map(s => s.trim()).filter(Boolean)
        : [];

    // Normalize qualifications
    const qualificationsArray = Array.isArray(qualifications)
      ? qualifications.map(q => ({
          school: q.school?.trim() || "",
          degree: q.degree?.trim() || "",
          year: Number(q.year) || null,
          marks: q.marks?.trim() || "",
        }))
      : [];

    // Compose user data
    const userData = {
      employeeId: trimmedEmployeeId,
      name: name.trim(),
      email: normalizedEmail,
      contact: contact.trim(),
      dob,
      gender,
      bloodGroup: bloodGroup?.trim() || "",
      qualifications: qualificationsArray,
      skills: skillsArray,
      permanentAddress: permanentAddress?.trim() || "",
      currentAddress: currentAddress?.trim() || "",
      emergencyContact: emergencyContact?.trim() || "",
      ps: ps?.trim() || "",
      doj,
      salary: {
        basic: Number(salary) || 0,
        total: Number(salary) || 0,
        paymentMode: "bank",
      },
      ref: ref?.trim() || "",
      status: status?.toLowerCase() || "inactive",
      totalPl: Number(totalPl) || 0,
      password: password || "Welcome123",
      department: department || "",
      designation: designation?.trim() || "",
      role: "employee",
      shiftType: shiftType || "standard",
      jobLevel: jobLevel || "junior",
    };

    if (shiftType === "standard" && shift?.start && shift?.end) {
      userData.shift = {
        start: shift.start,
        end: shift.end,
        durationHours: shift.durationHours || 9,
      };
    } else if (shiftType === "flexiblePermanent") {
      delete userData.shift; // remove shift to avoid conflicting data
    }

    const user = new User(userData);
    await user.save();

    return res.status(201).json({ message: "Employee created successfully", user });
  } catch (error) {
    console.error("Create employee error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// Employee directory with filters
exports.getEmployeeDirectory = async (req, res) => {
  try {
    const { department, designation, status, jobLevel, search } = req.query;
    const filter = {};

    if (department && department !== "all") filter.department = department.trim();
    if (designation && designation !== "all") filter.designation = { $regex: designation.trim(), $options: "i" };
    if (status && status !== "all") filter.status = status.toLowerCase().trim();
    if (jobLevel && jobLevel !== "all") filter.jobLevel = jobLevel.trim();

    if (search) {
      const term = search.trim();
      filter.$or = [
        { name: { $regex: term, $options: "i" } },
        { email: { $regex: term, $options: "i" } },
        { employeeId: { $regex: term, $options: "i" } },
      ];
    }

    const employees = await User.find(filter)
      .select("_id employeeId name email contact department designation jobLevel")
      .sort({ name: 1 });

    const employeesWithStatus = employees.map(emp => ({
      ...emp.toObject(),
      status: emp.status || "inactive",
      shiftType: emp.shiftType || "standard",
      jobLevel: emp.jobLevel || "junior",
    }));

    res.json(employeesWithStatus);
  } catch (err) {
    console.error("Error fetching employee directory:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all users minimal info, limited to admin/hr/super-admin (you can customize as needed)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("_id name email role department designation employeeId dob doj shift shiftType jobLevel");
    res.json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get logged-in user info + stats
exports.getMe = async (req, res) => {
  try {
    const userId = req.user._id;
    if (!userId) return res.status(404).json({ message: "User not found" });

    const user = await User.findById(userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const tasks = await Task.find({ $or: [{ assignedTo: userId }, { assignedBy: userId }] });
    const tasksCompleted = tasks.filter(t => t.status === "completed").length;
    const ongoingProjects = tasks.filter(t => t.status === "pending" || t.status === "in-progress").length;

    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const leaves = await LeaveRequest.find({
      "employee.email": user.email,
      status: "Approved",
      "period.start": { $gte: monthStart, $lte: monthEnd }
    });

    const totalDays = monthEnd.getDate();
    const attendancePercent = Math.max(0, Math.round(((totalDays - leaves.length) / totalDays) * 100));

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
      jobLevel: user.jobLevel || "junior",
      doj: user.doj,
      bloodGroup: user.bloodGroup,
      permanentAddress: user.permanentAddress,
      currentAddress: user.currentAddress,
      emergencyContact: user.emergencyContact,
      ps: user.ps,
      salary: user.salary,
      ref: user.ref,
      status: user.status || "inactive",
      totalPl: user.totalPl,
      location: user.location,
      outlookEmail: user.outlookEmail,
      hasEmailCredentials: Boolean(user.outlookEmail && user.outlookPassword),
      tasksCompleted,
      ongoingProjects,
      attendancePercent,
      shift: user.shift || null,
      shiftType: user.shiftType || "standard",
      skills: user.skills || [],
      qualifications: user.qualifications || [],
    });
  } catch (err) {
    console.error("GetMe Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get single employee by ID
exports.getEmployeeById = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      ...user,
      status: user.status || "inactive",
      shiftType: user.shiftType || "standard",
      jobLevel: user.jobLevel || "junior",
      personalInfo: {
        dob: user.dob || "",
        gender: user.gender || "",
        nationality: user.nationality || "",
      },
      contactInfo: {
        email: user.email || "",
        phone: user.contact || "",
        address: user.currentAddress || "",
        emergencyContact: user.emergencyContact,
      },
      employmentDetails: {
        designation: user.designation || "",
        department: user.department || "",
        jobLevel: user.jobLevel || "junior",
        doj: user.doj || "",
        status: user.status || "inactive",
        shift: user.shift || null,
      },
      salary: user.salary || {},
      qualifications: user.qualifications || [],
      skills: user.skills || [],
    });
  } catch (err) {
    console.error("Error fetching employee by ID:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Update employee status
exports.updateEmployeeStatus = async (req, res) => {
  try {
    const userId = req.params.id;
    const { status } = req.body;

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const user = await User.findByIdAndUpdate(userId, { status }, { new: true });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ message: "Status updated successfully", user });
  } catch (err) {
    console.error("Update employee status error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
