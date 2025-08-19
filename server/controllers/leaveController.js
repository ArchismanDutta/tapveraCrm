const LeaveRequest = require("../models/LeaveRequest");

// Create a leave request
exports.createLeave = async (req, res) => {
  try {
    // Require auth to have populated req.user earlier via protect middleware
    if (!req.user) {
      return res.status(401).json({ message: "Not authorized, no user context" });
    }

    // Build employee snapshot
    const employee = {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      avatar: req.user.avatar,
      department: req.user.department,
      designation: req.user.designation,
    };

    // Accept either {startDate,endDate} OR {period:{start,end}}
    let start, end;

    if (req.body?.period?.start || req.body?.period?.end) {
      start = req.body.period.start;
      end = req.body.period.end;
    } else {
      start = req.body.startDate;
      end = req.body.endDate;
    }

    // Normalize dates
    const type = req.body.type;
    if (!start) {
      return res.status(400).json({ message: "startDate is required" });
    }

    // For half day, if no end provided, set end = start
    if (type === "halfDay" && !end) {
      end = start;
    }

    const period = {
      start: new Date(start),
      end: new Date(end),
    };

    if (isNaN(period.start.getTime()) || isNaN(period.end.getTime())) {
      return res.status(400).json({ message: "Invalid start or end date" });
    }

    const payload = {
      employee,
      period,
      type,
      reason: req.body.reason,
      document: req.body.document || undefined,
    };

    const leave = await LeaveRequest.create(payload);
    res.status(201).json(leave);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Get leaves for logged-in user
exports.getUserLeaves = async (req, res) => {
  try {
    const requests = await LeaveRequest.find({ "employee.email": req.user.email })
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all leaves (admin)
exports.getAllLeaves = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const requests = await LeaveRequest.find(filter).sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update leave status and admin remarks
exports.updateLeaveStatus = async (req, res) => {
  try {
    const { status, adminRemarks } = req.body;

    if (!["Pending", "Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const updatedLeave = await LeaveRequest.findByIdAndUpdate(
      req.params.id,
      { status, adminRemarks },
      { new: true }
    );

    if (!updatedLeave) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    res.json(updatedLeave);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete leave request (employee or admin)
exports.deleteLeave = async (req, res) => {
  try {
    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: "Leave request not found" });

    if (req.user.role !== "admin" && leave.employee.email !== req.user.email) {
      return res.status(403).json({ message: "Not authorized to delete this leave request" });
    }

    await LeaveRequest.findByIdAndDelete(req.params.id);
    res.json({ message: "Leave request deleted" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Get team leaves for logged-in user's department
exports.getTeamLeaves = async (req, res) => {
  try {
    const department = req.user.department;
    const email = req.user.email;

    const leaves = await LeaveRequest.find({
      "employee.department": department,
      "employee.email": { $ne: email },
      status: "Approved",
    }).sort({ "period.start": 1 });

    res.json(leaves);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
