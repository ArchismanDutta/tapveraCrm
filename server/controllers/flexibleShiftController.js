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

    // Prevent flexible permanent shift employees from submitting requests
    if (user.shiftType === "flexiblePermanent") {
      return res.status(400).json({
        message: "Permanent flexible shift employees do not need to submit shift requests",
      });
    }

    const { requestedDate, requestedStartTime, durationHours, reason } = req.body;

    if (!requestedDate || !requestedStartTime) {
      return res.status(400).json({ 
        message: "Requested date and start time are required" 
      });
    }

    // Validate the date is not in the past
    const reqDate = new Date(requestedDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (reqDate < today) {
      return res.status(400).json({
        message: "Cannot request flexible shift for past dates"
      });
    }

    // Check if request already exists for this date
    const existingRequest = await FlexibleShiftRequest.findOne({
      employee: userId,
      requestedDate: reqDate
    });

    if (existingRequest) {
      return res.status(400).json({
        message: "A flexible shift request already exists for this date"
      });
    }

    // Validate time format
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(requestedStartTime)) {
      return res.status(400).json({
        message: "Invalid time format. Use HH:MM format"
      });
    }

    // Validate duration
    const duration = durationHours || 9;
    if (duration < 1 || duration > 24) {
      return res.status(400).json({
        message: "Duration must be between 1 and 24 hours"
      });
    }

    const request = new FlexibleShiftRequest({
      employee: userId,
      requestedDate: reqDate,
      requestedStartTime,
      durationHours: duration,
      reason: reason?.trim() || "",
      status: "pending"
    });

    await request.save();
    
    // Populate employee details for response
    await request.populate('employee', 'name email employeeId department');
    
    res.status(201).json({ 
      message: "Flexible shift request submitted successfully", 
      request 
    });
  } catch (err) {
    console.error("Create flexible shift request error:", err);
    if (err.code === 11000) {
      return res.status(400).json({
        message: "A request for this date already exists"
      });
    }
    res.status(500).json({ message: "Server error" });
  }
};

// ======================
// Get All Flexible Shift Requests (HR/Admin)
// GET /api/flexible-shifts
// ======================
exports.getFlexibleShiftRequests = async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;
    
    let filter = {};
    
    // Filter by status if provided
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      filter.status = status;
    }
    
    // Filter by date range if provided
    if (startDate || endDate) {
      filter.requestedDate = {};
      if (startDate) filter.requestedDate.$gte = new Date(startDate);
      if (endDate) filter.requestedDate.$lte = new Date(endDate);
    }

    const requests = await FlexibleShiftRequest.find(filter)
      .populate("employee", "name email employeeId department designation shiftType")
      .populate("reviewedBy", "name email")
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

    const requests = await FlexibleShiftRequest.find({ employee: userId })
      .populate("reviewedBy", "name email")
      .sort({ createdAt: -1 });
      
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
    const { status, remarks } = req.body;

    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const request = await FlexibleShiftRequest.findById(requestId)
      .populate('employee', 'shiftType');
    
    if (!request) {
      return res.status(404).json({ message: "Flexible shift request not found" });
    }

    const user = await User.findById(request.employee._id);
    if (!user) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Prevent approving requests for flexible permanent employees
    if (user.shiftType === "flexiblePermanent") {
      return res.status(400).json({
        message: "Cannot approve flexible shift requests for permanent flexible employees"
      });
    }

    // Check if the request date has passed
    const requestDate = new Date(request.requestedDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (requestDate < today && status === "approved") {
      return res.status(400).json({
        message: "Cannot approve requests for past dates"
      });
    }

    // Update request status
    request.status = status;
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    if (remarks) request.remarks = remarks;
    
    await request.save();

    // Only create shift override for approved requests
    if (status === "approved") {
      const duration = request.durationHours || 9;
      const [startH, startM] = request.requestedStartTime.split(":").map(Number);

      // Calculate end time
      let endH = startH + Math.floor(duration);
      let endM = startM + Math.round((duration % 1) * 60);
      
      // Handle minute overflow
      if (endM >= 60) {
        endH += Math.floor(endM / 60);
        endM = endM % 60;
      }
      
      // Handle hour overflow (next day)
      if (endH >= 24) {
        endH = endH % 24;
      }

      const endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
      
      // Create date key for shift override
      const dateKey = request.requestedDate.toISOString().slice(0, 10);

      // Update user's shift overrides
      await User.findByIdAndUpdate(
        user._id,
        {
          $set: {
            [`shiftOverrides.${dateKey}`]: {
              start: request.requestedStartTime,
              end: endTime,
              durationHours: duration,
              type: "flexible",
              approvedBy: req.user._id,
              approvedAt: new Date()
            }
          }
        }
      );
    }

    // Populate the response
    await request.populate([
      { path: 'employee', select: 'name email employeeId department' },
      { path: 'reviewedBy', select: 'name email' }
    ]);

    res.json({ 
      message: `Request ${status} successfully`, 
      request 
    });
  } catch (err) {
    console.error("Error updating flexible shift status:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ======================
// Delete Flexible Shift Request
// DELETE /api/flexible-shifts/:requestId
// ======================
exports.deleteFlexibleShiftRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user._id;
    
    const request = await FlexibleShiftRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }
    
    // Only allow deletion by the employee who created it or HR/Admin
    const isOwner = request.employee.toString() === userId.toString();
    const isAuthorized = ["hr", "admin", "super-admin"].includes(req.user.role);
    
    if (!isOwner && !isAuthorized) {
      return res.status(403).json({ message: "Not authorized to delete this request" });
    }
    
    // Don't allow deletion of approved requests on the same day or past dates
    if (request.status === "approved") {
      const requestDate = new Date(request.requestedDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (requestDate <= today) {
        return res.status(400).json({
          message: "Cannot delete approved requests for today or past dates"
        });
      }
    }
    
    await FlexibleShiftRequest.findByIdAndDelete(requestId);
    res.json({ message: "Request deleted successfully" });
  } catch (err) {
    console.error("Delete flexible shift request error:", err);
    res.status(500).json({ message: "Server error" });
  }
};