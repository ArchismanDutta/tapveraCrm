// controllers/flexibleShiftController.js

const FlexibleShiftRequest = require("../models/FlexibleShiftRequest");
const User = require("../models/User");

// ======================
// Create Flexible Shift Request (Employee)
// POST /api/flexible-shifts/request
// ======================
exports.createFlexibleShiftRequest = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Only standard employees can submit semi-flexible requests
    if (user.shiftType === "flexiblePermanent") {
      return res.status(400).json({
        message: "Permanent flexible shift employees do not submit requests",
      });
    }

    const { requestedDate, requestedStartTime, durationHours, reason } = req.body;

    if (!requestedDate || !requestedStartTime) {
      return res
        .status(400)
        .json({ message: "Requested date and start time are required" });
    }

    const request = new FlexibleShiftRequest({
      employee: userId,
      requestedDate,
      requestedStartTime,
      durationHours: durationHours || 9, // default 9 hours
      reason: reason?.trim() || "",
      status: "pending",
      shiftType: "flexibleRequest", // semi-flexible
    });

    await request.save();
    res.status(201).json({ message: "Flexible shift request submitted", request });
  } catch (err) {
    console.error("Create flexible shift request error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ======================
// Get All Flexible Shift Requests (HR/Admin)
// GET /api/flexible-shifts
// ======================
exports.getFlexibleShiftRequests = async (req, res) => {
  try {
    const requests = await FlexibleShiftRequest.find()
      .populate("employee", "_id name email employeeId shift shiftType")
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    console.error("Get flexible shift requests error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ======================
// Get Employee's Own Flexible Shift Requests
// GET /api/flexible-shifts/my-requests
// ======================
exports.getEmployeeFlexibleRequests = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const requests = await FlexibleShiftRequest.find({ employee: userId }).sort({
      createdAt: -1,
    });
    res.json(requests);
  } catch (err) {
    console.error("Get employee flexible requests error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ======================
// Update Flexible Shift Request Status (HR/Admin)
// PUT /api/flexible-shifts/:requestId/status
// ======================
exports.updateFlexibleShiftStatus = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body;

    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const request = await FlexibleShiftRequest.findById(requestId);
    if (!request)
      return res.status(404).json({ message: "Flexible shift request not found" });

    const user = await User.findById(request.employee);
    if (!user) return res.status(404).json({ message: "Employee not found" });

    // Cannot approve a request for permanent flexible employees
    if (user.shiftType === "flexiblePermanent" && status === "approved") {
      return res.status(400).json({
        message: "Permanent flexible shift employees cannot have requests approved",
      });
    }

    request.status = status;
    request.reviewedBy = req.user?._id;
    request.reviewedAt = new Date();
    await request.save();

    // If approved, update user's shift for that day (semi-flexible override)
    if (status === "approved") {
      const duration = request.durationHours || 9;
      const [startH, startM] = request.requestedStartTime.split(":").map(Number);
      let endH = startH + Math.floor(duration);
      let endM = startM + Math.round((duration % 1) * 60);
      if (endM >= 60) {
        endH += 1;
        endM -= 60;
      }
      if (endH >= 24) endH -= 24; // wrap around midnight

      const endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

      // Store shift override
      user.shiftOverrides = user.shiftOverrides || {};
      user.shiftOverrides[request.requestedDate.toISOString().slice(0, 10)] = {
        start: request.requestedStartTime,
        end: endTime,
        durationHours: duration,
      };

      await user.save();
    }

    res.json({ message: "Flexible shift status updated", request });
  } catch (err) {
    console.error("Error updating flexible shift status:", err);
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: "Validation error", errors: err.errors });
    }
    res.status(500).json({ message: "Server error" });
  }
};
