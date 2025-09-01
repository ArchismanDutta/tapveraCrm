const User = require("../models/User");
const DailyWork = require("../models/DailyWork");
const LeaveRequest = require("../models/LeaveRequest");

exports.getEmployeeList = async (req, res) => {
  try {
    const { department, status } = req.query;
    const filter = {};
    if (department) filter.department = department;
    if (status) filter.status = status;

    const employees = await User.find(filter, "employeeId name department role status").lean();
    res.json(employees);
  } catch (err) {
    console.error("Error fetching employee list:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getEmployeeSummary = async (req, res) => {
  try {
    const { employeeId, startDate, endDate } = req.query;
    if (!employeeId || !startDate || !endDate)
      return res.status(400).json({ message: "Missing required query params" });

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const attendanceRecords = await DailyWork.find({
      userId: employeeId,
      date: { $gte: start, $lte: end },
    }).sort({ date: 1 }).lean();

    const leaves = await LeaveRequest.find({
      "employee._id": employeeId,
      "period.start": { $lte: end },
      "period.end": { $gte: start },
    }).sort({ "period.start": 1 }).lean();

    const totalWorkSeconds = attendanceRecords.reduce((sum, r) => sum + (r.workDurationSeconds || 0), 0);
    const totalBreakSeconds = attendanceRecords.reduce((sum, r) => sum + (r.breakDurationSeconds || 0), 0);
    const totalDays = attendanceRecords.length;
    const lateDays = attendanceRecords.filter(r => r.isLate).length;
    const absentDays = attendanceRecords.filter(r => r.isAbsent).length;

    const summary = {
      totalWorkHours: (totalWorkSeconds / 3600).toFixed(2),
      totalBreakHours: (totalBreakSeconds / 3600).toFixed(2),
      totalDays,
      lateDays,
      absentDays,
      leavesTaken: leaves.length,
    };

    res.json({ attendanceRecords, leaves, summary });
  } catch (err) {
    console.error("Error fetching employee summary:", err);
    res.status(500).json({ message: "Server error" });
  }
};
