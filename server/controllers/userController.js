// File: controllers/userController.js

const User = require("../models/User");
const Task = require("../models/Task");
const LeaveRequest = require("../models/LeaveRequest");
const Shift = require("../models/Shift");


// =========================
// Create employee
// =========================
exports.createEmployee = async (req, res) => {
  try {
    console.log("📝 Creating new employee with data:", JSON.stringify(req.body, null, 2));

    const {
      employeeId, name, email, contact, dob, gender, bloodGroup,
      qualifications, permanentAddress, currentAddress, emergencyContact,
      ps, doj, salary, ref, status, totalPl,
      department, designation, password, shift, shiftType,
      skills, jobLevel,
      standardShiftType,
      location, employmentType, outlookEmail, outlookAppPassword,
    } = req.body;

    // Required fields
    if (!employeeId || !name || !email || !contact || !dob || !gender || !doj) {
      return res.status(400).json({ message: "Required fields are missing." });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const trimmedEmployeeId = String(employeeId).trim();

    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(400).json({ message: "Email already in use." });
    }
    if (await User.findOne({ employeeId: trimmedEmployeeId })) {
      return res.status(400).json({ message: "Employee ID already in use." });
    }

    // Normalize arrays
    const skillsArray = Array.isArray(skills)
      ? skills.map(s => s.trim()).filter(Boolean)
      : typeof skills === "string"
        ? skills.split(",").map(s => s.trim()).filter(Boolean)
        : [];

    const qualificationsArray = Array.isArray(qualifications)
      ? qualifications.map(q => ({
          school: q.school?.trim() || "",
          degree: q.degree?.trim() || "",
          year: Number(q.year) || null,
          marks: q.marks?.trim() || "",
        }))
      : [];

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
      jobLevel: jobLevel || "junior",
      location: location?.trim() || "",
      employmentType: employmentType?.toLowerCase() || "full-time",
      outlookEmail: outlookEmail?.trim() || "",
      outlookAppPassword: outlookAppPassword?.trim() || "",
    };

    // Dynamic shift handling based on shiftType
    if (shiftType === "flexiblePermanent") {
      // Flexible permanent employees don't need a specific shift
      userData.shiftType = "flexiblePermanent";
      userData.assignedShift = null;
      userData.standardShiftType = null;
      userData.shift = {
        name: "Flexible 9h/day",
        start: "00:00",
        end: "23:59",
        durationHours: 9,
        isFlexible: true,
        shiftId: null
      };
    } else if (shiftType === "standard") {
      // For standard shifts, query from database
      userData.shiftType = "standard";

      // If shiftId is provided, use it directly
      if (shift?.shiftId) {
        console.log(`🔍 Looking up shift by ID: ${shift.shiftId}`);

        // Validate ObjectId format
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(shift.shiftId)) {
          return res.status(400).json({
            message: "Invalid shift ID format",
            shiftId: shift.shiftId
          });
        }

        const foundShift = await Shift.findById(shift.shiftId);
        console.log(`Shift lookup result:`, foundShift ? `Found: ${foundShift.name}` : 'Not found');

        if (!foundShift) {
          return res.status(400).json({
            message: "Selected shift not found in database",
            shiftId: shift.shiftId,
            hint: "Please select a valid shift from the dropdown or create the shift first"
          });
        }

        userData.assignedShift = foundShift._id;
        userData.shift = {
          name: foundShift.name,
          start: foundShift.start,
          end: foundShift.end,
          durationHours: foundShift.durationHours,
          isFlexible: false,
          shiftId: foundShift._id
        };
      }
      // If standardShiftType is provided (for backward compatibility), try to find by name
      else if (standardShiftType) {
        const shiftName = standardShiftType.toLowerCase() === 'morning' ? 'Morning Shift' :
                          standardShiftType.toLowerCase() === 'evening' ? 'Evening Shift' :
                          standardShiftType.toLowerCase() === 'night' ? 'Night Shift' :
                          standardShiftType.toLowerCase() === 'early' ? 'Early Shift' :
                          standardShiftType;

        const foundShift = await Shift.findOne({ name: shiftName, isActive: true });

        if (!foundShift) {
          return res.status(400).json({
            message: `Shift "${shiftName}" not found. Please initialize default shifts or create custom shifts first.`,
            hint: "Use the shift management page to initialize default shifts"
          });
        }

        userData.assignedShift = foundShift._id;
        userData.standardShiftType = standardShiftType.toLowerCase();
        userData.shift = {
          name: foundShift.name,
          start: foundShift.start,
          end: foundShift.end,
          durationHours: foundShift.durationHours,
          isFlexible: false,
          shiftId: foundShift._id
        };
      }
      // If custom shift object is provided with times
      else if (shift?.start && shift?.end) {
        // Try to find matching shift in database
        const foundShift = await Shift.findOne({
          start: shift.start,
          end: shift.end,
          isActive: true
        });

        if (foundShift) {
          userData.assignedShift = foundShift._id;
          userData.shift = {
            name: foundShift.name,
            start: foundShift.start,
            end: foundShift.end,
            durationHours: foundShift.durationHours,
            isFlexible: false,
            shiftId: foundShift._id
          };
        } else {
          // If no matching shift found, create inline shift (for backward compatibility)
          userData.shift = {
            name: shift.name || `Custom Shift ${shift.start}-${shift.end}`,
            start: shift.start,
            end: shift.end,
            durationHours: shift.durationHours || 9,
            isFlexible: false,
            shiftId: null
          };
        }
      } else {
        // No shift information provided - require it
        return res.status(400).json({
          message: "For standard shift type, please provide either shiftId, standardShiftType, or shift details (start/end times)",
          hint: "Use the shift management page to view available shifts"
        });
      }
    }

    console.log("💾 Final userData before saving:", JSON.stringify(userData, null, 2));

    const user = new User(userData);
    console.log("✅ User model created, now saving to database...");
    await user.save();
    console.log("🎉 Employee saved successfully with ID:", user._id);

    return res.status(201).json({ message: "Employee created successfully", user });
  } catch (error) {
    console.error("❌ Create employee error:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return res.status(500).json({
      message: "Server error",
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};


// =========================
// Employee directory
// =========================
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
      .select("_id employeeId name email contact department designation jobLevel status shiftType regions region")
      .sort({ name: 1 });

    const employeesWithStatus = employees.map(emp => ({
      ...emp.toObject(),
      status: emp.status, // Preserve actual status from database
      shiftType: emp.shiftType || "standard",
      jobLevel: emp.jobLevel || "junior",
      regions: emp.regions || [emp.region] || ['Global'], // Ensure regions array exists
    }));

    res.json(employeesWithStatus);
  } catch (err) {
    console.error("Error fetching employee directory:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// =========================
// Get all users
// =========================
exports.getAllUsers = async (req, res) => {
  try {
    // By default, exclude terminated and absconded employees
    // Use ?includeInactive=true to get all users including terminated/absconded
    const includeInactive = req.query.includeInactive === 'true';

    const filter = includeInactive
      ? {}
      : { status: { $nin: ['terminated', 'absconded'] } };

    const users = await User.find(filter)
      .select("_id name email role department designation employeeId dob doj shift shiftType jobLevel status salary");
    res.json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// =========================
// Get logged-in user info
// =========================
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


// =========================
// Get employee by ID
// =========================
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


// =========================
// Update employee details
// =========================
exports.updateEmployee = async (req, res) => {
  try {
    const userId = req.params.id;

    const allowedFields = [
      "name",
      "email",         // <- Included email field
      "contact",
      "dob",
      "gender",
      "bloodGroup",
      "permanentAddress",
      "currentAddress",
      "emergencyContact",
      "ps",
      "department",
      "designation",
      "jobLevel",
      "employmentType",
      "skills",
      "qualifications",
      "salary",
      "shiftType",
      "shift",
      "status",
      "location",
      "regions",       // <- Added for multi-region access control
      "region"         // <- Keep for backwards compatibility
    ];

    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    // Normalize arrays
    if (updateData.skills && typeof updateData.skills === "string") {
      updateData.skills = updateData.skills.split(",").map(s => s.trim());
    }
    if (updateData.qualifications && Array.isArray(updateData.qualifications)) {
      updateData.qualifications = updateData.qualifications.map(q => ({
        school: q.school?.trim() || "",
        degree: q.degree?.trim() || "",
        year: Number(q.year) || null,
        marks: q.marks?.trim() || "",
      }));
    }

    // Ensure shift object is properly formatted
    if (updateData.shift) {
      const { start, end, durationHours } = updateData.shift;
      updateData.shift = {
        start: start || null,
        end: end || null,
        durationHours: Number(durationHours) || 9,
      };
    }

    // Log regions update if present
    if (updateData.regions) {
      console.log(`[Update Employee] Updating user ${userId} regions to:`, updateData.regions);
    }

    const user = await User.findByIdAndUpdate(userId, updateData, { new: true });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Log successful regions update
    if (updateData.regions) {
      console.log(`[Update Employee] Successfully updated user ${userId} regions:`, user.regions);
    }

    res.json({ message: "Employee updated successfully", user });
  } catch (err) {
    console.error("Update Employee Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// =========================
// Update employee status
// =========================
exports.updateEmployeeStatus = async (req, res) => {
  try {
    const userId = req.params.id;
    const { status } = req.body;

    // Updated to accept new status values
    if (!["active", "inactive", "terminated", "absconded"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value. Must be one of: active, inactive, terminated, absconded" });
    }

    const user = await User.findByIdAndUpdate(userId, { status }, { new: true });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ message: "Status updated successfully", user });
  } catch (err) {
    console.error("Update employee status error:", err);
    res.status(500).json({ message: "Server error" });
  }
};