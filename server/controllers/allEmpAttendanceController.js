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

    // ─── FORMER STAFF ARE EXCLUDED BY DEFAULT ────────────────────────────
    //
    // This used to apply NO status filter unless the caller asked for one,
    // and no caller does — the attendance portal requests
    // `/api/admin/employees?t=<cachebuster>` and nothing else. So every
    // terminated and absconded account came back and sat in the employee
    // picker and the "All employees" grid indefinitely, growing with every
    // departure.
    //
    // Their attendance history is still real and sometimes genuinely needed
    // (final payroll, a disputed month), so this hides them rather than
    // making them unreachable: `?status=terminated` fetches exactly them, and
    // `?status=all` returns everyone. Same posture as the chat directory —
    // you cannot pick a former colleague from the default list, but nothing
    // about their record is erased.
    if (status && status !== "all") {
      filter.status = status.trim().toLowerCase();
    } else if (!status) {
      filter.status = { $nin: ["terminated", "absconded"] };
    }

    // Alphabetical, with the collation that makes it mean what a reader
    // expects. Mongo's default sort is byte order, which files every
    // capitalised name above every lowercase one — strength: 1 compares
    // case- and accent-insensitively. Same pattern as GET /api/clients.
    const employees = await User.find(
      filter,
      "employeeId name department role status avatar"
    )
      .collation({ locale: "en", strength: 1 })
      .sort({ name: 1 })
      .lean();

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

    // Fetch this employee's rows.
    //
    // AttendanceRecord holds ONE document per calendar date containing every
    // employee; there is no top-level userId on it. The old query filtered on
    // `userId` at the root, matched nothing, every time, and every total below
    // came back as zero for everybody. The employee lives at
    // employees[].userId, and their day is flattened out of the record here so
    // the shape the rest of this handler reads (`r.isLate`, `r.isAbsent`,
    // `r.workDurationSeconds`) is actually populated.
    const records = await AttendanceRecord.find({
      date: { $gte: start, $lte: end },
      "employees.userId": employeeId,
    })
      .sort({ date: 1 })
      .lean();

    const dailyData = records
      .map((record) => {
        const employee = (record.employees || []).find(
          (e) => e.userId && e.userId.toString() === employeeId.toString()
        );
        if (!employee) return null;

        const calc = employee.calculated || {};
        return {
          date: record.date,
          workDurationSeconds: calc.workDurationSeconds || 0,
          breakDurationSeconds: calc.breakDurationSeconds || 0,
          arrivalTime: calc.arrivalTime || null,
          departureTime: calc.departureTime || null,
          isLate: Boolean(calc.isLate),
          isAbsent: Boolean(calc.isAbsent),
          isHalfDay: Boolean(calc.isHalfDay),
          lateMinutes: calc.lateMinutes || 0,
          shift: employee.assignedShift || null,
          leave: employee.leaveInfo || null,
        };
      })
      .filter(Boolean);

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

    // Days of leave inside the range, not the number of requests. One ten-day
    // leave is ten days off, and counting it as 1 made a fortnight's absence
    // read the same as an afternoon's.
    const leaveDays = new Set();
    for (const leave of leaves) {
      const from = new Date(Math.max(new Date(leave.period.start), start));
      const to = new Date(Math.min(new Date(leave.period.end), end));
      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        leaveDays.add(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        );
      }
    }

    const summary = {
      totalWorkHours: (totalWorkSeconds / 3600).toFixed(2),
      totalBreakHours: (totalBreakSeconds / 3600).toFixed(2),
      totalDays,
      lateDays,
      absentDays,
      leavesTaken: leaveDays.size,
      leaveRequests: leaves.length,
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
