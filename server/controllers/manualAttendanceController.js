// controllers/manualAttendanceController.NEW.js
// Updated manual attendance controller using the NEW AttendanceService

const User = require("../models/User");
const AttendanceService = require("../services/AttendanceService");

const attendanceService = new AttendanceService();

/**
 * Create manual attendance entry using NEW attendance system
 * @route POST /api/admin/manual-attendance
 */
const createManualAttendance = async (req, res) => {
  try {
    const {
      userId,
      date,
      punchInTime,
      punchOutTime,
      breakSessions = [],
      notes = "",
      isOnLeave = false,
      isHoliday = false,
      overrideExisting = false
    } = req.body;

    console.log("📝 Creating manual attendance:", {
      userId,
      date,
      punchInTime,
      punchOutTime,
      breakSessionsCount: breakSessions.length
    });

    // Validate required fields
    if (!userId || !date) {
      return res.status(400).json({
        success: false,
        error: "User ID and date are required"
      });
    }

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    // Parse and validate date
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: "Invalid date format"
      });
    }

    targetDate.setHours(0, 0, 0, 0);

    // Get attendance record for the date
    const attendanceRecord = await attendanceService.getAttendanceRecord(targetDate);

    // Check if employee already has attendance
    const existingEmployee = attendanceRecord.getEmployee(userId);

    if (existingEmployee && !overrideExisting) {
      return res.status(409).json({
        success: false,
        error: "Attendance record already exists for this employee on this date. Set overrideExisting=true to replace it."
      });
    }

    // Validate punch times
    let punchIn = null;
    let punchOut = null;

    if (punchInTime) {
      punchIn = new Date(punchInTime);
      if (isNaN(punchIn.getTime())) {
        return res.status(400).json({
          success: false,
          error: "Invalid punch in time format"
        });
      }
    }

    if (punchOutTime) {
      punchOut = new Date(punchOutTime);
      if (isNaN(punchOut.getTime())) {
        return res.status(400).json({
          success: false,
          error: "Invalid punch out time format"
        });
      }
    }

    if (punchIn && punchOut && punchOut <= punchIn) {
      return res.status(400).json({
        success: false,
        error: "Punch out time must be after punch in time"
      });
    }

    // Validate break sessions
    for (const breakSession of breakSessions) {
      const breakStart = new Date(breakSession.start);
      const breakEnd = new Date(breakSession.end);

      if (isNaN(breakStart.getTime()) || isNaN(breakEnd.getTime())) {
        return res.status(400).json({
          success: false,
          error: "Invalid break session time format"
        });
      }

      if (breakEnd <= breakStart) {
        return res.status(400).json({
          success: false,
          error: "Break end time must be after break start time"
        });
      }
    }

    // Remove existing employee data if overriding
    if (existingEmployee && overrideExisting) {
      attendanceRecord.employees = attendanceRecord.employees.filter(
        emp => emp.userId.toString() !== userId.toString()
      );
    }

    // Create employee record
    const employeeData = await attendanceService.createEmployeeRecord(userId, targetDate);

    // Add manual events
    const events = [];

    if (punchIn && !isOnLeave && !isHoliday) {
      events.push({
        type: "PUNCH_IN",
        timestamp: punchIn,
        manual: true,
        approvedBy: req.user?._id,
        notes: notes || 'Manual entry'
      });
    }

    // Add break events
    for (const breakSession of breakSessions) {
      events.push({
        type: "BREAK_START",
        timestamp: new Date(breakSession.start),
        manual: true,
        approvedBy: req.user?._id
      });
      events.push({
        type: "BREAK_END",
        timestamp: new Date(breakSession.end),
        manual: true,
        approvedBy: req.user?._id
      });
    }

    if (punchOut && !isOnLeave && !isHoliday) {
      events.push({
        type: "PUNCH_OUT",
        timestamp: punchOut,
        manual: true,
        approvedBy: req.user?._id,
        notes: notes || 'Manual entry'
      });
    }

    // Sort events by timestamp
    events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Add events to employee record
    employeeData.events = events;

    // Update leave info if applicable
    if (isOnLeave) {
      employeeData.leaveInfo.isOnLeave = true;
      employeeData.leaveInfo.leaveType = 'manual';
    }

    if (isHoliday) {
      employeeData.leaveInfo.isHoliday = true;
    }

    // Recalculate attendance data (pass targetDate for night shift late detection)
    attendanceService.recalculateEmployeeData(employeeData, targetDate);

    // Add employee to record
    attendanceRecord.employees.push(employeeData);

    // Update daily stats
    attendanceService.updateDailyStats(attendanceRecord);

    // Save record
    await attendanceRecord.save();

    console.log("✅ Manual attendance created successfully:", {
      date: targetDate,
      userId,
      eventsCount: events.length,
      workDurationSeconds: employeeData.calculated.workDurationSeconds
    });

    res.status(201).json({
      success: true,
      message: "Manual attendance record created successfully",
      data: {
        dailyWork: employeeData.calculated, // For frontend compatibility
        employee: employeeData,
        calculatedMetrics: {
          workHours: (employeeData.calculated.workDurationSeconds / 3600).toFixed(2),
          breakHours: (employeeData.calculated.breakDurationSeconds / 3600).toFixed(2),
          isLate: employeeData.calculated.isLate,
          isHalfDay: employeeData.calculated.isHalfDay,
          isAbsent: employeeData.calculated.isAbsent
        }
      }
    });

  } catch (error) {
    console.error("Error creating manual attendance:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      details: error.message
    });
  }
};

/**
 * Update existing manual attendance entry
 * @route PUT /api/admin/manual-attendance/:id
 */
const updateManualAttendance = async (req, res) => {
  try {
    const { id } = req.params; // This should be userId since new system doesn't have individual IDs
    const {
      date,
      punchInTime,
      punchOutTime,
      breakSessions = [],
      notes = "",
      isOnLeave = false,
      isHoliday = false
    } = req.body;

    console.log("📝 Updating manual attendance:", {
      userId: id,
      date
    });

    // For update, we need userId and date
    if (!id || !date) {
      return res.status(400).json({
        success: false,
        error: "User ID and date are required for update"
      });
    }

    // Parse date
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: "Invalid date format"
      });
    }
    targetDate.setHours(0, 0, 0, 0);

    // Get attendance record
    const attendanceRecord = await attendanceService.getAttendanceRecord(targetDate);

    // Find employee
    let employee = attendanceRecord.getEmployee(id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: "Attendance record not found for this employee on this date"
      });
    }

    // Clear existing events
    employee.events = [];

    // Validate and add new punch times
    let punchIn = null;
    let punchOut = null;

    if (punchInTime) {
      punchIn = new Date(punchInTime);
      if (isNaN(punchIn.getTime())) {
        return res.status(400).json({
          success: false,
          error: "Invalid punch in time format"
        });
      }
    }

    if (punchOutTime) {
      punchOut = new Date(punchOutTime);
      if (isNaN(punchOut.getTime())) {
        return res.status(400).json({
          success: false,
          error: "Invalid punch out time format"
        });
      }
    }

    if (punchIn && punchOut && punchOut <= punchIn) {
      return res.status(400).json({
        success: false,
        error: "Punch out time must be after punch in time"
      });
    }

    // Build new events
    const events = [];

    if (punchIn && !isOnLeave && !isHoliday) {
      events.push({
        type: "PUNCH_IN",
        timestamp: punchIn,
        manual: true,
        approvedBy: req.user?._id,
        notes: notes || 'Manual update'
      });
    }

    // Add break events
    for (const breakSession of breakSessions) {
      const breakStart = new Date(breakSession.start);
      const breakEnd = new Date(breakSession.end);

      if (isNaN(breakStart.getTime()) || isNaN(breakEnd.getTime())) {
        return res.status(400).json({
          success: false,
          error: "Invalid break session time format"
        });
      }

      if (breakEnd <= breakStart) {
        return res.status(400).json({
          success: false,
          error: "Break end time must be after break start time"
        });
      }

      events.push({
        type: "BREAK_START",
        timestamp: breakStart,
        manual: true,
        approvedBy: req.user?._id
      });
      events.push({
        type: "BREAK_END",
        timestamp: breakEnd,
        manual: true,
        approvedBy: req.user?._id
      });
    }

    if (punchOut && !isOnLeave && !isHoliday) {
      events.push({
        type: "PUNCH_OUT",
        timestamp: punchOut,
        manual: true,
        approvedBy: req.user?._id,
        notes: notes || 'Manual update'
      });
    }

    // Sort events
    events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Update employee events
    employee.events = events;

    // Update leave info
    if (isOnLeave) {
      employee.leaveInfo.isOnLeave = true;
      employee.leaveInfo.leaveType = 'manual';
    }

    if (isHoliday) {
      employee.leaveInfo.isHoliday = true;
    }

    // Recalculate (pass targetDate for night shift late detection)
    attendanceService.recalculateEmployeeData(employee, targetDate);

    // Update daily stats
    attendanceService.updateDailyStats(attendanceRecord);

    // Save
    await attendanceRecord.save();

    console.log("✅ Manual attendance updated successfully");

    res.status(200).json({
      success: true,
      message: "Manual attendance record updated successfully",
      data: {
        dailyWork: employee.calculated,
        employee: employee,
        calculatedMetrics: {
          workHours: (employee.calculated.workDurationSeconds / 3600).toFixed(2),
          breakHours: (employee.calculated.breakDurationSeconds / 3600).toFixed(2),
          isLate: employee.calculated.isLate,
          isHalfDay: employee.calculated.isHalfDay,
          isAbsent: employee.calculated.isAbsent
        }
      }
    });

  } catch (error) {
    console.error("Error updating manual attendance:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      details: error.message
    });
  }
};

/**
 * Delete manual attendance entry
 * @route DELETE /api/admin/manual-attendance/:userId/:date
 */
const deleteManualAttendance = async (req, res) => {
  try {
    const { id } = req.params;

    // We need to parse userId and date from the request
    // The frontend should pass this as query params or in the URL
    const { date } = req.query;

    if (!id || !date) {
      return res.status(400).json({
        success: false,
        error: "User ID and date are required for deletion"
      });
    }

    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: "Invalid date format"
      });
    }
    targetDate.setHours(0, 0, 0, 0);

    // Get attendance record
    const attendanceRecord = await attendanceService.getAttendanceRecord(targetDate);

    // Remove employee from record
    const initialLength = attendanceRecord.employees.length;
    attendanceRecord.employees = attendanceRecord.employees.filter(
      emp => emp.userId.toString() !== id.toString()
    );

    if (attendanceRecord.employees.length === initialLength) {
      return res.status(404).json({
        success: false,
        error: "Attendance record not found for this employee on this date"
      });
    }

    // Update daily stats
    attendanceService.updateDailyStats(attendanceRecord);

    // Save
    await attendanceRecord.save();

    console.log("✅ Manual attendance deleted successfully");

    res.status(200).json({
      success: true,
      message: "Manual attendance record deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting manual attendance:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      details: error.message
    });
  }
};

/**
 * Get manual attendance records with filters
 * @route GET /api/admin/manual-attendance
 */
const getManualAttendanceRecords = async (req, res) => {
  try {
    const { startDate, endDate, userId, department, page = 1, limit = 20 } = req.query;

    const query = {};

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const AttendanceRecord = require("../models/AttendanceRecord");

    const records = await AttendanceRecord.find(query)
      .sort({ date: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    // Filter and flatten employee records
    let manualRecords = [];

    for (const record of records) {
      for (const employee of record.employees) {
        // Only include manual entries
        const hasManualEvents = employee.events.some(e => e.manual);

        if (hasManualEvents) {
          // Apply userId filter if specified
          if (userId && employee.userId.toString() !== userId.toString()) {
            continue;
          }

          const User = require("../models/User");
          const user = await User.findById(employee.userId).select('name email department profileImage');

          manualRecords.push({
            _id: `${employee.userId}_${record.date.toISOString().split('T')[0]}`, // Composite ID
            userId: employee.userId,
            user: user,
            date: record.date,
            calculated: employee.calculated,
            events: employee.events,
            shift: employee.assignedShift,
            leave: employee.leaveInfo,
            metadata: employee.metadata
          });
        }
      }
    }

    // Apply department filter if specified
    if (department) {
      manualRecords = manualRecords.filter(r => r.user?.department === department);
    }

    const totalRecords = manualRecords.length;
    const totalPages = Math.ceil(totalRecords / parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        records: manualRecords,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalRecords,
          recordsPerPage: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error("Error fetching manual attendance records:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      details: error.message
    });
  }
};

/**
 * Get attendance record for a specific user and date
 * @route GET /api/admin/manual-attendance/user/:userId/date/:date
 */
const getAttendanceByUserAndDate = async (req, res) => {
  try {
    const { userId, date } = req.params;

    if (!userId || !date) {
      return res.status(400).json({
        success: false,
        error: "User ID and date are required"
      });
    }

    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: "Invalid date format"
      });
    }
    targetDate.setHours(0, 0, 0, 0);

    // Get attendance record
    const attendanceRecord = await attendanceService.getAttendanceRecord(targetDate);

    // Find employee
    const employee = attendanceRecord.getEmployee(userId);

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: "No attendance record found for this user and date"
      });
    }

    // Get user info
    const User = require("../models/User");
    const user = await User.findById(userId).select('name email department profileImage');

    res.status(200).json({
      success: true,
      data: {
        attendanceRecord: {
          _id: `${userId}_${targetDate.toISOString().split('T')[0]}`,
          userId,
          user,
          date: targetDate,
          calculated: employee.calculated,
          events: employee.events,
          shift: employee.assignedShift,
          leave: employee.leaveInfo,
          metadata: employee.metadata
        },
        hasRecord: true
      }
    });

  } catch (error) {
    console.error("Error fetching attendance by user and date:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      details: error.message
    });
  }
};

module.exports = {
  createManualAttendance,
  updateManualAttendance,
  deleteManualAttendance,
  getManualAttendanceRecords,
  getAttendanceByUserAndDate
};
