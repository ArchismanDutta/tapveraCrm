const LeaveRequest = require("../models/LeaveRequest");

// Create a leave request
exports.createLeave = async (req, res) => {
  try {
    req.body.employee = {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      avatar: req.user.avatar,
      department: req.user.department,
      designation: req.user.designation,
    };

    req.body.period = {
      start: new Date(req.body.startDate),
      end: new Date(req.body.endDate),
    };

    delete req.body.startDate;
    delete req.body.endDate;

    const leave = await LeaveRequest.create(req.body);
    res.status(201).json(leave);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get leaves for logged-in user
exports.getUserLeaves = async (req, res) => {
  try {
    const requests = await LeaveRequest.find({ "employee.email": req.user.email }).sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
};

// Update leave status and admin remarks
exports.updateLeaveStatus = async (req, res) => {
  try {
    const { status, adminRemarks } = req.body;

    if (!["Pending", "Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    const updatedLeave = await LeaveRequest.findByIdAndUpdate(
      req.params.id,
      { status, adminRemarks },
      { new: true }
    );

    if (!updatedLeave) {
      return res.status(404).json({ error: "Leave request not found" });
    }

    res.json(updatedLeave);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete leave request (employee or admin)
exports.deleteLeave = async (req, res) => {
  try {
    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave) return res.status(404).json({ error: "Leave request not found" });

    if (req.user.role !== "admin" && leave.employee.email !== req.user.email) {
      return res.status(403).json({ error: "Not authorized to delete this leave request" });
    }

    await LeaveRequest.findByIdAndDelete(req.params.id);
    res.json({ message: "Leave request deleted" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get team leaves for logged-in user's department (new)
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
    res.status(500).json({ error: error.message });
  }
};
