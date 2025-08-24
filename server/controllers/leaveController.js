// src/controllers/leaveController.js
const LeaveRequest = require("../models/LeaveRequest");

// Create a leave request
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

    if (!start) return res.status(400).json({ message: "startDate is required" });
    if (type === "halfDay" && !end) end = start;

    const period = { start: new Date(start), end: new Date(end || start) };
    if (isNaN(period.start.getTime()) || isNaN(period.end.getTime()))
      return res.status(400).json({ message: "Invalid start or end date" });

    let document;
    if (req.file) {
      document = {
        name: req.file.originalname,
        size: req.file.size,
        url: `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`,
      };
    }

    const payload = { employee, period, type, reason: req.body.reason, document, status: "Pending" };
    const leave = await LeaveRequest.create(payload);

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

    const updatedLeave = await LeaveRequest.findByIdAndUpdate(
      req.params.id,
      { status, adminRemarks },
      { new: true } // return the updated document
    );

    if (!updatedLeave) return res.status(404).json({ message: "Leave request not found" });

    // Respond with updated leave so frontend can update state
    res.json(updatedLeave);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message });
  }
};

// Delete leave request
exports.deleteLeave = async (req, res) => {
  try {
    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: "Leave request not found" });

    if (req.user.role !== "admin" && leave.employee.email !== req.user.email)
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
