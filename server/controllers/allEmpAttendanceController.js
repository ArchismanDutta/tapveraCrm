const User = require("../models/User");
// const DailyWork = require("../models/DailyWork"); // REMOVED - Using new AttendanceRecord system
const AttendanceRecord = require("../models/AttendanceRecord");
const LeaveRequest = require("../models/LeaveRequest");
const Holiday = require("../models/Holiday");

/**
 * GET /api/admin/employees
 * Fetch list of employees with optional filters
 */
exports.getEmployeeList = async (req, res) => {
  try {
    const { department, status } = req.query;
    const filter = {};

    if (department && department !== "all") filter.department = department.trim();
    if (status && status !== "all") filter.status = status.trim().toLowerCase();

    const employees = await User.find(
      filter,
      "employeeId name department role status avatar"
    ).lean();

    return res.json({ success: true, data: employees });
  } catch (err) {
    console.error("Error fetching employee list:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching employees",
    });
  }
};

/**
 * GET /api/admin/employee-summary
 * Fetch attendance summary for a specific employee over a date range
 */
exports.getEmployeeSummary = async (req, res) => {
  try {
    const { employeeId, startDate, endDate } = req.query;

    if (!employeeId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Missing required query parameters: employeeId, startDate, endDate",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Fetch AttendanceRecord records
    const dailyData = await AttendanceRecord.find({
      userId: employeeId,
      date: { $gte: start, $lte: end },
    })
      .sort({ date: 1 })
      .lean();

    // Fetch approved leave requests
    const leaves = await LeaveRequest.find({
      "employee._id": employeeId,
      status: "Approved",
      "period.start": { $lte: end },
      "period.end": { $gte: start },
    })
      .sort({ "period.start": 1 })
      .lean();

    // Fetch holidays
    const holidays = await Holiday.find({
      date: { $gte: start, $lte: end },
      shifts: { $in: ["ALL", "standard"] },
    }).lean();

    // Compute totals
    const totalWorkSeconds = dailyData.reduce(
      (sum, record) => sum + (record.workDurationSeconds || 0),
      0
    );
    const totalBreakSeconds = dailyData.reduce(
      (sum, record) => sum + (record.breakDurationSeconds || 0),
      0
    );

    const totalDays = dailyData.length;
    const lateDays = dailyData.filter((r) => r.isLate).length;
    const absentDays = dailyData.filter((r) => r.isAbsent).length;

    const summary = {
      totalWorkHours: (totalWorkSeconds / 3600).toFixed(2),
      totalBreakHours: (totalBreakSeconds / 3600).toFixed(2),
      totalDays,
      lateDays,
      absentDays,
      leavesTaken: leaves.length,
      holidays: holidays.length,
    };

    return res.json({ success: true, dailyData, leaves, holidays, summary });
  } catch (err) {
    console.error("Error fetching employee summary:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching employee summary",
    });
  }
};
