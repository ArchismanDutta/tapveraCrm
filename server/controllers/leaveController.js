const LeaveRequest = require("../models/LeaveRequest");
const holidayService = require("../services/holidayService");
// Access-management rework (2026-07-03) - Phase 4.4.
// See docs/superpowers/plans/2026-07-03-access-management-rework.md
const { can } = require("../utils/accessControl");
const notificationService = require("../services/notificationService");

// Who receives "a leave request is waiting" notifications. Mirrors
// requireLeaveApprove in routes/leaveRoutes.js — if that list changes, change
// this one too, or approvers will silently stop being told.
const LEAVE_APPROVER_ROLES = ["admin", "super-admin", "hr"];

// The schema's enum values are camelCase identifiers, not something to show a
// person. Anything not listed falls back to the raw value rather than being
// dropped, so a new leave type added to the schema still reads sensibly here.
const LEAVE_TYPE_LABELS = {
  maternity: "Maternity leave",
  paid: "Paid leave",
  unpaid: "Unpaid leave",
  sick: "Sick leave",
  workFromHome: "Work from home",
  halfDay: "Half day",
};

// Dates are pinned to IST rather than the server's locale: this string is read
// by employees in India, and a server in UTC would render a leave starting on
// the 1st as the 31st.
const fmtLeaveDate = (value) =>
  new Date(value).toLocaleDateString("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/** "Sick leave · 12 Aug 2026" or "Paid leave · 12 Aug 2026 → 14 Aug 2026" */
const describeLeave = (leave) => {
  const label = LEAVE_TYPE_LABELS[leave.type] || leave.type;
  const start = fmtLeaveDate(leave.period?.start);
  const end = fmtLeaveDate(leave.period?.end);
  return `${label} · ${start === end ? start : `${start} → ${end}`}`;
};

// Create a leave request with sandwich policy
exports.createLeave = async (req, res) => {
  try {
    const employee = {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      avatar: req.user.avatar || "",
      department: req.user.department || "Unknown",
      designation: req.user.designation || "",
    };

    let start = req.body.startDate;
    let end = req.body.endDate;
    const type = req.body.type;

    if (!start)
      return res.status(400).json({ message: "startDate is required" });
    if (type === "halfDay" && !end) end = start;

    let period = { start: new Date(start), end: new Date(end || start) };
    if (isNaN(period.start.getTime()) || isNaN(period.end.getTime()))
      return res.status(400).json({ message: "Invalid start or end date" });

    // 🔥 Sandwich Policy Expansion
    // ⚠️ ONLY apply to paid/unpaid/sick/maternity leaves
    // ✅ EXCLUDE workFromHome and halfDay (they should be exact dates)
    let adjustedStart = new Date(period.start);
    let adjustedEnd = new Date(period.end);

    const shouldApplySandwichPolicy = !['workFromHome', 'halfDay'].includes(type);

    if (shouldApplySandwichPolicy) {
      // expand backwards
      let checkPrev = new Date(adjustedStart);
      checkPrev.setDate(checkPrev.getDate() - 1);
      while (await holidayService.isHolidayOrWeekend(checkPrev)) {
        adjustedStart = new Date(checkPrev);
        checkPrev.setDate(checkPrev.getDate() - 1);
      }

      // expand forwards
      let checkNext = new Date(adjustedEnd);
      checkNext.setDate(checkNext.getDate() + 1);
      while (await holidayService.isHolidayOrWeekend(checkNext)) {
        adjustedEnd = new Date(checkNext);
        checkNext.setDate(checkNext.getDate() + 1);
      }
    }

    // prepare document if uploaded
    let document;
    if (req.file) {
      document = {
        name: req.file.originalname,
        size: req.file.size,
        // `storedPath`, not `filename`: files are sharded, so the document
        // lives at leave/2026/08/a3/<id>.pdf and the bare filename would build
        // a path that doesn't exist. See config/storage.js createDiskStorage.
        //
        // Relative, not `${req.protocol}://${req.get("host")}/uploads/...`.
        // Baking the hostname in makes every historical document point at
        // whichever server received the upload — which breaks the moment you
        // move hosts, as this deployment just did. The path is the durable
        // fact; middlewares/signFileUrls turns it into a signed URL on the way
        // out.
        url: `/uploads/${req.file.storedPath}`,
      };
    }

    const payload = {
      employee,
      period: { start: adjustedStart, end: adjustedEnd },
      type,
      reason: req.body.reason,
      document,
      status: "Pending",
    };

    const leave = await LeaveRequest.create(payload);

    try {
      const { broadcastLeaveUpdated } = require("../utils/websocket");
      broadcastLeaveUpdated(req.user._id, { action: "created", leaveId: leave._id });
    } catch (wsError) {
      console.warn("WebSocket broadcast failed (leave created):", wsError.message);
    }

    // Tell the approvers there's something waiting for them.
    //
    // The broadcast above only refreshes a list that's already on screen — it
    // reaches nobody who isn't currently looking at the leave page, which is
    // almost everybody almost all the time. A request could sit untouched for
    // days simply because no approver happened to open that page.
    //
    // Roles mirror requireLeaveApprove in routes/leaveRoutes.js; keep them in
    // step. The requester is excluded because admins and HR can file their own
    // leave, and being told about your own request is noise.
    notificationService
      .notifyRoles(
        LEAVE_APPROVER_ROLES,
        {
          type: "leave",
          channel: "leave",
          title: `Leave request from ${leave.employee?.name || "an employee"}`,
          body: `${describeLeave(leave)}\nReason: ${leave.reason}`,
          priority: "normal",
          relatedData: { leaveId: leave._id, url: "/admin/leaves" },
        },
        { excludeUserId: req.user._id }
      )
      .catch((err) => console.error("Leave-requested notification failed:", err));

    res.status(201).json(leave);
  } catch (error) {
    console.error("Create Leave Error:", error);
    res.status(400).json({ message: error.message });
  }
};


// Get logged-in user's leaves
exports.getUserLeaves = async (req, res) => {
  try {
    const requests = await LeaveRequest.find({ "employee.email": req.user.email }).sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// Get all leaves (admin)
exports.getAllLeaves = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const leaves = await LeaveRequest.find(filter).sort({ createdAt: -1 });
    res.json(leaves);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// Update leave status (admin)
exports.updateLeaveStatus = async (req, res) => {
  try {
    const { status, adminRemarks } = req.body;

    if (!["Pending", "Approved", "Rejected"].includes(status))
      return res.status(400).json({ message: "Invalid status value" });

    // Build dynamic update object
    const update = { status, adminRemarks };

    // If approved, set approvedBy
    if (status === "Approved") {
      update.approvedBy = {
        _id: req.user._id,
        name: req.user.name,
        email: req.user.email,
      };
    } else {
      // Remove approvedBy if status is not Approved
      update.$unset = { approvedBy: "" };
    }

    const updatedLeave = await LeaveRequest.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    );

    if (!updatedLeave)
      return res.status(404).json({ message: "Leave request not found" });

    // WFH Integration: Mark the dates as WFH-approved, but don't mark attendance
    // Employee still needs to punch in to be counted as present
    if (status === "Approved" && updatedLeave.type === "workFromHome") {
      // Store WFH approval info - this will be checked when employee punches in
      // The attendance system will reference approved WFH requests when validating punch-ins
      console.log(`WFH request approved for user ${updatedLeave.employee._id} from ${updatedLeave.period.start} to ${updatedLeave.period.end}`);
      console.log(`Employee must still punch in to be marked present - WFH status will be applied on punch-in`);
    }

    try {
      const { broadcastLeaveUpdated } = require("../utils/websocket");
      broadcastLeaveUpdated(updatedLeave.employee?._id, {
        action: "status_changed",
        leaveId: updatedLeave._id,
        status: updatedLeave.status,
      });
    } catch (wsError) {
      console.warn("WebSocket broadcast failed (leave status changed):", wsError.message);
    }

    // Tell the employee the outcome. This is the half that matters most —
    // previously the only way to discover your leave had been approved was to
    // open the page and check, which people do far less often than they check
    // the bell.
    //
    // Only for a decision, not for a revert to Pending: "your leave is pending
    // again" is a confusing thing to receive and doesn't need acting on.
    if (status === "Approved" || status === "Rejected") {
      const employeeId = updatedLeave.employee?._id;
      if (employeeId) {
        notificationService
          .notifyUser({
            userId: employeeId.toString(),
            type: "leave",
            channel: "leave",
            title: `Leave ${status.toLowerCase()}`,
            body: [
              describeLeave(updatedLeave),
              updatedLeave.approvedBy?.name ? `By: ${updatedLeave.approvedBy.name}` : null,
              updatedLeave.adminRemarks ? `Note: ${updatedLeave.adminRemarks}` : null,
            ]
              .filter(Boolean)
              .join("\n"),
            // A rejection usually needs the employee to do something about it
            // (rearrange plans, re-apply); an approval is just good news.
            priority: status === "Rejected" ? "high" : "normal",
            relatedData: { leaveId: updatedLeave._id, url: "/leaves" },
          })
          .catch((err) => console.error("Leave-decision notification failed:", err));
      } else {
        console.warn(`Leave ${updatedLeave._id} has no employee._id; skipped notification.`);
      }
    }

    res.json(updatedLeave);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message });
  }
};


// Update leave request (employee can only edit pending requests)
exports.updateLeave = async (req, res) => {
  try {
    const leave = await LeaveRequest.findById(req.params.id);

    if (!leave) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    // Check if user owns this leave request
    if (leave.employee.email !== req.user.email) {
      return res.status(403).json({ message: "Not authorized to edit this leave request" });
    }

    // Check if leave is still pending (can only edit pending requests)
    if (leave.status !== "Pending") {
      return res.status(400).json({
        message: `Cannot edit leave request with status: ${leave.status}. Only pending requests can be edited.`
      });
    }

    // Extract update fields
    let start = req.body.startDate;
    let end = req.body.endDate;
    const type = req.body.type;
    const reason = req.body.reason;

    if (!start) {
      return res.status(400).json({ message: "startDate is required" });
    }

    // Handle half-day logic
    if (type === "halfDay" && !end) end = start;

    let period = { start: new Date(start), end: new Date(end || start) };
    if (isNaN(period.start.getTime()) || isNaN(period.end.getTime())) {
      return res.status(400).json({ message: "Invalid start or end date" });
    }

    // Apply sandwich policy expansion
    // ⚠️ ONLY apply to paid/unpaid/sick/maternity leaves
    // ✅ EXCLUDE workFromHome and halfDay (they should be exact dates)
    let adjustedStart = new Date(period.start);
    let adjustedEnd = new Date(period.end);

    const shouldApplySandwichPolicy = !['workFromHome', 'halfDay'].includes(type);

    if (shouldApplySandwichPolicy) {
      // expand backwards
      let checkPrev = new Date(adjustedStart);
      checkPrev.setDate(checkPrev.getDate() - 1);
      while (await holidayService.isHolidayOrWeekend(checkPrev)) {
        adjustedStart = new Date(checkPrev);
        checkPrev.setDate(checkPrev.getDate() - 1);
      }

      // expand forwards
      let checkNext = new Date(adjustedEnd);
      checkNext.setDate(checkNext.getDate() + 1);
      while (await holidayService.isHolidayOrWeekend(checkNext)) {
        adjustedEnd = new Date(checkNext);
        checkNext.setDate(checkNext.getDate() + 1);
      }
    }

    // Prepare update object
    const updateData = {
      period: { start: adjustedStart, end: adjustedEnd },
      type,
      reason,
    };

    // Handle document upload if provided
    if (req.file) {
      updateData.document = {
        name: req.file.originalname,
        size: req.file.size,
        // storedPath + relative — see the note in createLeave above.
        url: `/uploads/${req.file.storedPath}`,
      };
    }

    const updatedLeave = await LeaveRequest.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    res.json(updatedLeave);
  } catch (error) {
    console.error("Update Leave Error:", error);
    res.status(400).json({ message: error.message });
  }
};

// Delete leave request
exports.deleteLeave = async (req, res) => {
  try {
    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: "Leave request not found" });

    // Pre-existing check only recognized role === "admin" (super-admin/hr
    // could not delete others' requests even though they can approve/reject
    // them). Additively widened to match the rest of this module's
    // admin/super-admin/hr + canApproveLeaves boundary (Phase 4.4).
    const isOwner = leave.employee.email === req.user.email;
    const isPrivileged =
      ["admin", "super-admin", "hr"].includes(req.user.role) ||
      (await can(req.user, "leaves:approve"));
    if (!isOwner && !isPrivileged)
      return res.status(403).json({ message: "Not authorized to delete this leave request" });

    await LeaveRequest.findByIdAndDelete(req.params.id);
    res.json({ message: "Leave request deleted" });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message });
  }
};

// Get approved leaves for a department excluding the requester
exports.getTeamLeaves = async (req, res) => {
  try {
    const department = req.query.department || req.user.department;
    const excludeEmail = req.query.excludeEmail; // frontend should pass the email to exclude

    if (!department) return res.status(400).json({ message: "Department is required" });

    const leaves = await LeaveRequest.find({
      "employee.department": department,
      "employee.email": { $ne: excludeEmail }, // exclude the selected employee
      status: "Approved",
    }).sort({ "period.start": 1 });

    res.json(leaves);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// Get leaves for a specific employee (admin/super-admin only)
exports.getEmployeeLeaves = async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    if (!employeeId) {
      return res.status(400).json({ message: "Employee ID is required" });
    }

    const leaves = await LeaveRequest.find({ 
      "employee._id": employeeId 
    }).sort({ createdAt: -1 });

    res.json(leaves);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};