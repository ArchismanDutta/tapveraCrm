// File: controllers/userController.js

const User = require("../models/User");
const Task = require("../models/Task");
const LeaveRequest = require("../models/LeaveRequest");
const Shift = require("../models/Shift");
const bcrypt = require("bcryptjs");
// Access-management rework (2026-07-03) - Phase 5.1.
// See docs/superpowers/plans/2026-07-03-access-management-rework.md
const { resolvePosition, resolveEffectivePermissions, PERMISSION_FLAG_KEYS } = require("../utils/accessControl");


// =========================
// Get next employee ID
// =========================
exports.getNextEmployeeId = async (req, res) => {
  try {
    // Match TAPV/### format (e.g. TAPV/001, TAPV/072)
    const users = await User.find(
      { employeeId: /^TAPV\/\d+$/i },
      "employeeId"
    ).lean();

    let maxNum = 0;
    for (const u of users) {
      const num = parseInt(u.employeeId.split("/")[1], 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }

    const nextNum = maxNum + 1;
    const nextId = `TAPV/${String(nextNum).padStart(3, "0")}`;
    res.json({ nextId });
  } catch (err) {
    console.error("getNextEmployeeId error:", err);
    res.status(500).json({ message: "Failed to generate employee ID" });
  }
};

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
      ? qualifications
          .map(q => ({
            school: q.school?.trim() || "",
            degree: q.degree?.trim() || "",
            year: Number(q.year) || null,
            marks: q.marks?.trim() || "",
          }))
          .filter(q => q.school && q.degree && q.year)
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
      password: await bcrypt.hash(String(password || "Welcome123").trim(), 12),
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

    // `email` is already selected below and is the CRM login username, so the
    // credentials modal needs nothing extra here.
    //
    // This used to append " crmUsername crmPassword" for super-admins. Those
    // two schema fields were never written by any code path, so they were
    // always the empty default and the modal reported "Not set" for every
    // employee. They've been removed rather than left to mislead the next
    // reader; passwords are issued via POST /api/users/:id/crm-password.
    const selectFields = "_id employeeId name email contact department departmentRef designation jobLevel status shiftType regions region position positionLevel";

    const employees = await User.find(filter)
      .select(selectFields)
      .populate('departmentRef', 'name') // Populate department from Access Management
      .sort({ name: 1 });

    const employeesWithStatus = employees.map(emp => {
      const empObj = emp.toObject();
      // Prefer departmentRef name over old department field
      const departmentName = empObj.departmentRef?.name || empObj.department || null;

      return {
        ...empObj,
        department: departmentName, // Use new department name if available
        status: empObj.status, // Preserve actual status from database
        shiftType: empObj.shiftType || "standard",
        jobLevel: empObj.jobLevel || "junior",
        regions: empObj.regions || [empObj.region] || ['Global'], // Ensure regions array exists
      };
    });

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
    // By default, exclude inactive, terminated, and absconded employees
    // Use ?includeInactive=true to get all users including inactive/terminated/absconded
    const includeInactive = req.query.includeInactive === 'true';

    const filter = includeInactive
      ? {}
      : { status: { $nin: ['inactive', 'terminated', 'absconded'] } };

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
// Get my resolved permissions (Access-management rework, Phase 5.1)
// GET /api/users/me/permissions
//
// Single source of truth for what the logged-in user can do, computed
// server-side via accessControl.js. The frontend should read from this
// instead of re-deriving access from role strings, department strings, or
// position-name substring matching (see docs/superpowers/specs/2026-07-03-
// access-management-design.md for why that pattern caused real incidents).
// =========================
// Role & Department Hierarchy Revamp v2 (2026-07-27): now sourced from
// accessControl.js's PERMISSION_FLAG_KEYS (single source of truth) instead
// of a separately-maintained local copy — that list also grew a 21st flag,
// canManageSubordinateAccess, as part of this revamp.
const PERMISSION_KEYS = PERMISSION_FLAG_KEYS;

exports.getMyPermissions = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("departmentRef", "name code status");
    if (!user) return res.status(404).json({ message: "User not found" });

    const isSuperAdmin = user.role === "super-admin" || user.role === "superadmin";
    const isAdmin = user.role === "admin";
    const isHR = user.role === "hr";

    const position = await resolvePosition(user);

    // bypass = true means access is via a role-level bypass rather than a
    // real configured Position: super-admin always, or admin ONLY until an
    // Admin Position is assigned (see accessControl.js's `can()` - this
    // mirrors that exact fallback so the UI and the API never disagree).
    const bypass = isSuperAdmin || (isAdmin && !position);

    // Role & Department Hierarchy Revamp v2 (2026-07-27): layer the user's
    // own permissionOverrides on top of their resolved Position's flags, so
    // a delegated grant/revoke (server/routes/positionRoutes.js's
    // PATCH /my-team/:userId/permissions) is immediately reflected in what
    // the affected user sees themselves — same effective-permissions logic
    // accessControl.js's can()/evaluate() already use for authorization.
    const effectivePermissions = resolveEffectivePermissions(position, user.permissionOverrides);

    const permissions = {};
    PERMISSION_KEYS.forEach((key) => {
      permissions[key] = bypass ? true : effectivePermissions[key] === true;
    });

    const hasPermissionOverrides = Boolean(user.permissionOverrides && user.permissionOverrides.size > 0);

    // Mirrors leadController.js's local canAccessLeadManagement() helper so
    // the sidebar/menu never has to re-derive this logic independently.
    const canAccessLeadManagement =
      isSuperAdmin ||
      isAdmin ||
      user.department === "marketingAndSales" ||
      permissions.canViewSubordinateLeads ||
      permissions.canEditSubordinateLeads ||
      permissions.canViewDepartmentLeads;

    res.json({
      role: user.role,
      isSuperAdmin,
      isAdmin,
      isHR,
      bypass,
      department: user.departmentRef
        ? { id: user.departmentRef._id, name: user.departmentRef.name, code: user.departmentRef.code }
        : (user.department ? { id: null, name: user.department, code: user.department } : null),
      position: position
        ? {
            id: position._id,
            name: position.name,
            level: position.level,
            dataScope: position.hierarchicalAccess?.dataScope || "own",
          }
        : null,
      permissions,
      hasPermissionOverrides,
      canAccessLeadManagement,
    });
  } catch (err) {
    console.error("GetMyPermissions Error:", err);
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
      "employeeId",
      "permanentAddress",
      "currentAddress",
      "emergencyContact",
      "ps",
      "role",
      "department",
      "designation",
      "position",
      "positionLevel",
      "jobLevel",
      "employmentType",
      "skills",
      "qualifications",
      "salary",
      "ref",
      "totalPl",
      "shiftType",
      "shift",
      "status",
      "location",
      "avatar",
      "timeZone",
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
    if (updateData.regions && !Array.isArray(updateData.regions)) {
      updateData.regions = [updateData.regions];
    }
    if (updateData.salary) {
      updateData.salary = {
        basic: Number(updateData.salary.basic) || 0,
        total: Number(updateData.salary.total) || 0,
        paymentMode: updateData.salary.paymentMode || "bank",
      };
    }
    if (updateData.positionLevel !== undefined) {
      updateData.positionLevel = Number(updateData.positionLevel) || 0;
    }
    if (updateData.totalPl !== undefined) {
      updateData.totalPl = Number(updateData.totalPl) || 0;
    }

    // Ensure shift object is properly formatted
    if (updateData.shift) {
      const { name, start, end, durationHours, isFlexible } = updateData.shift;
      updateData.shift = {
        name: name || "",
        start: start || null,
        end: end || null,
        durationHours: Number(durationHours) || 9,
        isFlexible: Boolean(isFlexible),
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

    // If status is changed to inactive, terminated, or absconded, perform cleanup
    if (["inactive", "terminated", "absconded"].includes(status)) {
      const Project = require("../models/Project");
      const Task = require("../models/Task");
      const Message = require("../models/Message");

      // 1. Find all projects where this user is createdBy
      const projectsCreatedByUser = await Project.find({ createdBy: userId });

      for (const project of projectsCreatedByUser) {
        // Find any active admin or the first active user in the system as fallback
        const activeAdmin = await User.findOne({
          status: "active",
          role: { $in: ["admin", "super-admin"] }
        });

        const fallbackUser = activeAdmin || await User.findOne({
          status: "active",
          _id: { $ne: userId }
        });

        if (fallbackUser) {
          // Reassign project ownership
          project.createdBy = fallbackUser._id;

          // Update notes createdBy references
          if (project.notes && project.notes.length > 0) {
            project.notes = project.notes.map(note => {
              if (note.createdBy && note.createdBy.toString() === userId.toString()) {
                note.createdBy = fallbackUser._id;
              }
              return note;
            });
          }

          await project.save();
          console.log(`Reassigned project ${project._id} from user ${userId} to ${fallbackUser._id}`);
        }
      }

      // 2. Remove user from all projects' clients array if they were a client
      await Project.updateMany(
        { clients: userId },
        { $pull: { clients: userId } }
      );

      // 2b. Remove user from all projects' assignedTo array (team members)
      await Project.updateMany(
        { assignedTo: userId },
        { $pull: { assignedTo: userId } }
      );

      // 3. Update all tasks where this user is assignedBy
      const tasksAssignedByUser = await Task.find({ assignedBy: userId });
      if (tasksAssignedByUser.length > 0) {
        const activeAdmin = await User.findOne({
          status: "active",
          role: { $in: ["admin", "super-admin"] }
        });

        const fallbackUser = activeAdmin || await User.findOne({
          status: "active",
          _id: { $ne: userId }
        });

        if (fallbackUser) {
          await Task.updateMany(
            { assignedBy: userId },
            { assignedBy: fallbackUser._id }
          );
          console.log(`Reassigned ${tasksAssignedByUser.length} tasks from user ${userId} to ${fallbackUser._id}`);
        }
      }

      // 4. Remove user from tasks' assignedTo array
      await Task.updateMany(
        { assignedTo: userId },
        { $pull: { assignedTo: userId } }
      );

      // 5. Remove user from messaging groups
      await Message.updateMany(
        { participants: userId },
        { $pull: { participants: userId } }
      );

      console.log(`Completed cleanup for user ${userId} with status ${status}`);
    }

    res.json({ message: "Status updated successfully", user });
  } catch (err) {
    console.error("Update employee status error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// =========================
// CRM login credentials
// =========================

// Excludes the characters people misread when copying a password off a screen
// or reading it down the phone: 0/O, 1/l/I, 5/S, 2/Z.
const PASSWORD_ALPHABET =
  "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ346789!@#$%&*?";
const GENERATED_PASSWORD_LENGTH = 14;

/**
 * A random password, drawn with rejection sampling from crypto bytes.
 *
 * The naive `bytes[i] % alphabet.length` is biased: 256 doesn't divide evenly
 * by the alphabet size, so the first few characters come up more often than
 * the rest. Discarding the values in that uneven tail keeps every character
 * equally likely.
 */
const generatePassword = () => {
  const crypto = require("crypto");
  const n = PASSWORD_ALPHABET.length;
  const limit = Math.floor(256 / n) * n;

  let out = "";
  while (out.length < GENERATED_PASSWORD_LENGTH) {
    for (const byte of crypto.randomBytes(GENERATED_PASSWORD_LENGTH)) {
      if (byte >= limit) continue;
      out += PASSWORD_ALPHABET[byte % n];
      if (out.length === GENERATED_PASSWORD_LENGTH) break;
    }
  }
  return out;
};

/**
 * Set an employee's CRM login password. Super-admin only.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS SETS RATHER THAN READS
 * ─────────────────────────────────────────────────────────────────────────────
 * Login passwords are bcrypt-hashed at cost 12 (see authController). Bcrypt is
 * one-way, so no endpoint can ever show you an employee's current password —
 * it does not exist anywhere in recoverable form, by design.
 *
 * The old CRM Credentials modal implied otherwise: it read two schema fields,
 * `crmUsername` / `crmPassword`, that nothing in the codebase ever wrote, so it
 * showed "Not set" for every employee forever.
 *
 * So the only honest version of "give me this employee's credentials" is to
 * issue new ones. The plaintext is returned in this response and nowhere else —
 * not logged, not persisted — which is why the UI has to make the caller copy
 * it before closing the dialog.
 *
 * @route POST /api/users/:id/crm-password
 */
exports.setEmployeeCrmPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const supplied = typeof req.body?.password === "string" ? req.body.password.trim() : "";

    if (supplied && supplied.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters" });
    }

    const user = await User.findById(id).select("_id name email role");
    if (!user) return res.status(404).json({ message: "Employee not found" });

    // A super-admin resetting another super-admin's password is an account
    // takeover with extra steps. Changing your own goes through the normal
    // profile flow, where you have to prove you know the current one.
    if (String(user._id) === String(req.user._id)) {
      return res.status(400).json({
        message: "Use your own profile settings to change your password",
      });
    }
    if (user.role === "super-admin") {
      return res
        .status(403)
        .json({ message: "Cannot set the password of another super-admin" });
    }

    const password = supplied || generatePassword();

    // Same cost factor as signup and the reset-link flow, so every hash in the
    // collection stays consistent.
    user.password = await bcrypt.hash(password, 12);
    await user.save();

    console.log(
      `[Security] ${req.user.email} set the CRM password for ${user.email} (${user._id})`
    );

    res.json({
      message: "Password updated",
      username: user.email,
      // Shown once. There is no second chance to read this.
      password,
      generated: !supplied,
    });
  } catch (err) {
    console.error("Set CRM password error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
