const User = require("../models/User");
const UserStatus = require("../models/UserStatus");
const DailyWork = require("../models/DailyWork");
const { getEffectiveShift, getAttendanceData } = require("../services/attendanceCalculationService");

/**
 * Create manual attendance entry for an employee on a specific date
 * @route POST /api/admin/manual-attendance
 * @access Admin, HR, Super-Admin
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

    // Set date to start of day
    targetDate.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Check if attendance already exists
    const existingUserStatus = await UserStatus.findOne({
      userId,
      today: { $gte: targetDate, $lte: endOfDay }
    });

    const existingDailyWork = await DailyWork.findOne({
      userId,
      date: { $gte: targetDate, $lte: endOfDay }
    });

    if ((existingUserStatus || existingDailyWork) && !overrideExisting) {
      return res.status(409).json({
        success: false,
        error: "Attendance record already exists for this date. Set overrideExisting=true to replace it.",
        existingRecords: {
          hasUserStatus: !!existingUserStatus,
          hasDailyWork: !!existingDailyWork
        }
      });
    }

    // Get effective shift for the user and date
    const effectiveShift = await getEffectiveShift(userId, targetDate);
    if (!effectiveShift) {
      return res.status(400).json({
        success: false,
        error: "No shift configuration found for this user and date"
      });
    }

    // Validate punch times if provided
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

    // Validate punch out is after punch in
    if (punchIn && punchOut && punchOut <= punchIn) {
      return res.status(400).json({
        success: false,
        error: "Punch out time must be after punch in time"
      });
    }

    // Process break sessions
    const processedBreakSessions = [];
    let totalBreakSeconds = 0;

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

      const breakDuration = Math.floor((breakEnd - breakStart) / 1000);
      totalBreakSeconds += breakDuration;

      processedBreakSessions.push({
        start: breakStart,
        end: breakEnd,
        type: breakSession.type || "break"
      });
    }

    // Create work sessions based on punch times and breaks
    const workedSessions = [];
    let totalWorkSeconds = 0;

    if (punchIn && punchOut && !isOnLeave && !isHoliday) {
      // If no breaks, create one continuous session
      if (processedBreakSessions.length === 0) {
        const workDuration = Math.floor((punchOut - punchIn) / 1000);
        totalWorkSeconds = workDuration;
        workedSessions.push({
          start: punchIn,
          end: punchOut
        });
      } else {
        // Split work sessions around breaks
        let currentStart = punchIn;

        // Sort breaks by start time
        const sortedBreaks = processedBreakSessions.sort((a, b) => a.start - b.start);

        for (const breakSession of sortedBreaks) {
          if (currentStart < breakSession.start) {
            // Work session before break
            const workDuration = Math.floor((breakSession.start - currentStart) / 1000);
            if (workDuration > 0) {
              totalWorkSeconds += workDuration;
              workedSessions.push({
                start: currentStart,
                end: breakSession.start
              });
            }
          }
          currentStart = breakSession.end;
        }

        // Final work session after last break
        if (currentStart < punchOut) {
          const workDuration = Math.floor((punchOut - currentStart) / 1000);
          if (workDuration > 0) {
            totalWorkSeconds += workDuration;
            workedSessions.push({
              start: currentStart,
              end: punchOut
            });
          }
        }
      }
    }

    // Create timeline events
    const timeline = [];
    if (punchIn && !isOnLeave && !isHoliday) {
      timeline.push({ type: "punch in", time: punchIn });
    }

    // Add break events to timeline
    processedBreakSessions.forEach(breakSession => {
      timeline.push({ type: "break start", time: breakSession.start });
      timeline.push({ type: "break end", time: breakSession.end });
    });

    if (punchOut && !isOnLeave && !isHoliday) {
      timeline.push({ type: "punch out", time: punchOut });
    }

    // Calculate attendance status using the attendance service
    const attendanceData = await getAttendanceData(
      userId,
      targetDate,
      workedSessions,
      processedBreakSessions,
      punchIn
    );

    // Delete existing records if overriding
    if (overrideExisting) {
      await UserStatus.deleteOne({
        userId,
        today: { $gte: targetDate, $lte: endOfDay }
      });

      await DailyWork.deleteOne({
        userId,
        date: { $gte: targetDate, $lte: endOfDay }
      });
    }

    // Create UserStatus record
    const userStatusData = {
      userId,
      today: targetDate,
      arrivalTime: punchIn,
      currentlyWorking: false,
      onBreak: false,
      workDurationSeconds: totalWorkSeconds,
      breakDurationSeconds: totalBreakSeconds,
      workDuration: `${Math.floor(totalWorkSeconds / 3600)}h ${Math.floor((totalWorkSeconds % 3600) / 60)}m`,
      breakDuration: `${Math.floor(totalBreakSeconds / 3600)}h ${Math.floor((totalBreakSeconds % 3600) / 60)}m`,
      workedSessions,
      breakSessions: processedBreakSessions,
      timeline,
      isLate: attendanceData.attendanceStatus.isLate || false,
      isHalfDay: attendanceData.attendanceStatus.isHalfDay || false,
      isAbsent: attendanceData.attendanceStatus.isAbsent || false,
    };

    const userStatus = new UserStatus(userStatusData);
    await userStatus.save();

    // Create DailyWork record
    const dailyWorkData = {
      userId,
      userStatusId: userStatus._id,
      date: targetDate,
      shift: {
        name: effectiveShift.shiftName,
        start: effectiveShift.start,
        end: effectiveShift.end,
        isFlexible: effectiveShift.isFlexible,
        durationHours: effectiveShift.durationHours
      },
      shiftType: effectiveShift.type === "flexiblePermanent" ? "flexiblePermanent" :
                 effectiveShift.isFlexible ? "flexible" : "standard",
      workDurationSeconds: totalWorkSeconds,
      breakDurationSeconds: totalBreakSeconds,
      workedSessions,
      breakSessions: processedBreakSessions,
      timeline,
      arrivalTime: punchIn,
      departureTime: punchOut,
      isLate: attendanceData.attendanceStatus.isLate || false,
      isHalfDay: attendanceData.attendanceStatus.isHalfDay || false,
      isAbsent: attendanceData.attendanceStatus.isAbsent || false,
      isOnLeave,
      isHoliday,
      notes
    };

    const dailyWork = new DailyWork(dailyWorkData);
    await dailyWork.save();

    // Return success response
    res.status(201).json({
      success: true,
      message: "Manual attendance record created successfully",
      data: {
        userStatus: userStatus,
        dailyWork: dailyWork,
        effectiveShift,
        attendanceStatus: attendanceData.attendanceStatus,
        calculatedMetrics: {
          totalWorkHours: (totalWorkSeconds / 3600).toFixed(2),
          totalBreakHours: (totalBreakSeconds / 3600).toFixed(2),
          workSessions: workedSessions.length,
          breakSessions: processedBreakSessions.length
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
 * @access Admin, HR, Super-Admin
 */
const updateManualAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      punchInTime,
      punchOutTime,
      breakSessions = [],
      notes = "",
      isOnLeave,
      isHoliday
    } = req.body;

    // Find the DailyWork record
    const dailyWork = await DailyWork.findById(id);
    if (!dailyWork) {
      return res.status(404).json({
        success: false,
        error: "Attendance record not found"
      });
    }

    // Update the record using the same logic as create
    // This is a simplified approach - in practice, you might want to refactor
    // the common logic into a separate service function

    res.status(200).json({
      success: true,
      message: "Manual attendance update functionality - implementation needed",
      data: { id }
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
 * @route DELETE /api/admin/manual-attendance/:id
 * @access Admin, HR, Super-Admin
 */
const deleteManualAttendance = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the DailyWork record
    const dailyWork = await DailyWork.findById(id);
    if (!dailyWork) {
      return res.status(404).json({
        success: false,
        error: "Attendance record not found"
      });
    }

    // Delete related UserStatus record
    if (dailyWork.userStatusId) {
      await UserStatus.findByIdAndDelete(dailyWork.userStatusId);
    }

    // Delete DailyWork record
    await DailyWork.findByIdAndDelete(id);

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
 * Get manual attendance entries with filters
 * @route GET /api/admin/manual-attendance
 * @access Admin, HR, Super-Admin
 */
const getManualAttendanceRecords = async (req, res) => {
  try {
    const {
      userId,
      startDate,
      endDate,
      page = 1,
      limit = 50,
      sortBy = "date",
      sortOrder = "desc"
    } = req.query;

    // Build filter object
    const filter = {};

    if (userId) {
      filter.userId = userId;
    }

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        filter.date.$gte = new Date(startDate);
      }
      if (endDate) {
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999);
        filter.date.$lte = endDateObj;
      }
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const [records, totalCount] = await Promise.all([
      DailyWork.find(filter)
        .populate("userId", "name employeeId email role")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      DailyWork.countDocuments(filter)
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.status(200).json({
      success: true,
      data: {
        records,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalRecords: totalCount,
          recordsPerPage: parseInt(limit),
          hasNextPage,
          hasPrevPage
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
 * @access Admin, HR, Super-Admin
 */
const getAttendanceByUserAndDate = async (req, res) => {
  try {
    const { userId, date } = req.params;

    // Validate inputs
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
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Find records
    const [dailyWork, userStatus] = await Promise.all([
      DailyWork.findOne({
        userId,
        date: { $gte: targetDate, $lte: endOfDay }
      }).populate("userId", "name employeeId email role"),
      UserStatus.findOne({
        userId,
        today: { $gte: targetDate, $lte: endOfDay }
      })
    ]);

    if (!dailyWork && !userStatus) {
      return res.status(404).json({
        success: false,
        error: "No attendance record found for this user and date"
      });
    }

    res.status(200).json({
      success: true,
      data: {
        dailyWork,
        userStatus,
        hasRecord: !!(dailyWork || userStatus)
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