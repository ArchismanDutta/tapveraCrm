const User = require("../models/User");
const UserStatus = require("../models/UserStatus");
const AttendanceRecord = require("../models/AttendanceRecord");
const { getEffectiveShift, getAttendanceData } = require("../services/attendanceCalculationService");
const unifiedAttendanceService = require("../services/unifiedAttendanceService");

// CRITICAL: Use enhanced attendance system for all manual attendance
const USE_ENHANCED_ATTENDANCE_SYSTEM = true;

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

    // CRITICAL: Route to enhanced attendance system
    if (USE_ENHANCED_ATTENDANCE_SYSTEM) {
      return await createManualAttendanceEnhanced(req, res);
    }

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

    const existingAttendanceRecord = await AttendanceRecord.findOne({
      userId,
      date: { $gte: targetDate, $lte: endOfDay }
    });

    if ((existingUserStatus || existingAttendanceRecord) && !overrideExisting) {
      return res.status(409).json({
        success: false,
        error: "Attendance record already exists for this date. Set overrideExisting=true to replace it.",
        existingRecords: {
          hasUserStatus: !!existingUserStatus,
          hasAttendanceRecord: !!existingAttendanceRecord
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

      await AttendanceRecord.deleteOne({
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

    // Create AttendanceRecord using new schema
    const attendanceRecordData = {
      userId,
      date: targetDate,

      // Status and presence
      status: attendanceData.attendanceStatus.status,
      isPresent: !attendanceData.attendanceStatus.isAbsent,
      isAbsent: attendanceData.attendanceStatus.isAbsent || false,
      isLate: attendanceData.attendanceStatus.isLate || false,
      isHalfDay: attendanceData.attendanceStatus.isHalfDay || false,
      isWFH: false, // Manual entries are typically office-based

      // Times
      arrivalTime: punchIn,
      departureTime: punchOut,

      // Duration calculations
      workDurationSeconds: totalWorkSeconds,
      breakDurationSeconds: totalBreakSeconds,

      // Shift information
      shiftType: effectiveShift.type === "flexiblePermanent" ? "flexiblePermanent" :
                 effectiveShift.isFlexible ? "flexible" : "standard",
      expectedStartTime: effectiveShift.start,
      expectedEndTime: effectiveShift.end,

      // Events converted from timeline
      events: timeline || [],

      // Leave and holiday flags
      leaveInfo: isOnLeave ? { type: 'manual', approved: true } : null,
      isHoliday,

      // Metadata
      metadata: {
        createdBy: 'manual-entry',
        source: 'manual-attendance-form',
        isManual: true,
        userStatusId: userStatus._id, // Keep reference for compatibility
        originalShift: {
          name: effectiveShift.shiftName,
          start: effectiveShift.start,
          end: effectiveShift.end,
          isFlexible: effectiveShift.isFlexible,
          durationHours: effectiveShift.durationHours
        },
        workedSessions,
        breakSessions: processedBreakSessions
      },

      notes
    };

    const attendanceRecord = new AttendanceRecord(attendanceRecordData);

    // Save both records in sequence to ensure consistency and referential integrity
    await userStatus.save();
    await attendanceRecord.save();

    // Return success response
    res.status(201).json({
      success: true,
      message: "Manual attendance record created successfully",
      data: {
        userStatus: userStatus,
        dailyWork: attendanceRecord, // For backward compatibility
        attendanceRecord: attendanceRecord,
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
      isOnLeave = false,
      isHoliday = false
    } = req.body;

    // Find the AttendanceRecord
    const attendanceRecord = await AttendanceRecord.findById(id).populate("userId");
    if (!attendanceRecord) {
      return res.status(404).json({
        success: false,
        error: "Attendance record not found"
      });
    }

    const userId = attendanceRecord.userId._id;
    const targetDate = new Date(attendanceRecord.date);
    targetDate.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get effective shift for the user and date
    const effectiveShift = await getEffectiveShift(userId, targetDate);
    if (!effectiveShift) {
      return res.status(400).json({
        success: false,
        error: "No shift configuration found for this user and date"
      });
    }

    // Validate and parse punch times
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

    // Update UserStatus record
    const userStatusUpdate = {
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

    // Update AttendanceRecord record
    const attendanceRecordUpdate = {
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

    // Update the records
    const [updatedUserStatus, updatedAttendanceRecord] = await Promise.all([
      attendanceRecord.metadata?.userStatusId ?
        UserStatus.findByIdAndUpdate(attendanceRecord.metadata.userStatusId, userStatusUpdate, { new: true }) :
        null,
      AttendanceRecord.findByIdAndUpdate(id, attendanceRecordUpdate, { new: true }).populate("userId")
    ]);

    // If no UserStatus record existed, create one
    if (!updatedUserStatus && attendanceRecord.metadata?.userStatusId) {
      const newUserStatus = new UserStatus({
        userId,
        today: targetDate,
        ...userStatusUpdate
      });
      await newUserStatus.save();

      // Update AttendanceRecord to reference the new UserStatus
      await AttendanceRecord.findByIdAndUpdate(id, { userStatusId: newUserStatus._id });
    }

    res.status(200).json({
      success: true,
      message: "Manual attendance record updated successfully",
      data: {
        userStatus: updatedUserStatus,
        dailyWork: updatedAttendanceRecord, // For backward compatibility
        attendanceRecord: updatedAttendanceRecord,
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

    // Find the AttendanceRecord record
    const attendanceRecord = await AttendanceRecord.findById(id);
    if (!attendanceRecord) {
      return res.status(404).json({
        success: false,
        error: "Attendance record not found"
      });
    }

    // Delete related UserStatus record
    if (attendanceRecord.metadata?.userStatusId) {
      await UserStatus.findByIdAndDelete(attendanceRecord.metadata.userStatusId);
    }

    // Delete AttendanceRecord record
    await AttendanceRecord.findByIdAndDelete(id);

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
    console.log("=== getManualAttendanceRecords: Function called ===");

    // First test: Simple response without any model usage
    res.status(200).json({
      success: true,
      data: {
        records: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalRecords: 0,
          recordsPerPage: 20,
          hasNextPage: false,
          hasPrevPage: false
        }
      },
      message: "Test endpoint - no database operations"
    });

  } catch (error) {
    console.error("Error in getManualAttendanceRecords:", error);
    console.error("Error stack:", error.stack);
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
    const [attendanceRecord, userStatus] = await Promise.all([
      AttendanceRecord.findOne({
        userId,
        date: { $gte: targetDate, $lte: endOfDay }
      }).populate("userId", "name employeeId email role"),
      UserStatus.findOne({
        userId,
        today: { $gte: targetDate, $lte: endOfDay }
      })
    ]);

    if (!attendanceRecord && !userStatus) {
      return res.status(404).json({
        success: false,
        error: "No attendance record found for this user and date"
      });
    }

    res.status(200).json({
      success: true,
      data: {
        attendanceRecord,
        userStatus,
        hasRecord: !!(attendanceRecord || userStatus)
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

/**
 * Create manual attendance using ENHANCED ATTENDANCE SYSTEM
 * Uses AttendanceRecord with enhanced fields and unifiedAttendanceService for calculations
 */
const createManualAttendanceEnhanced = async (req, res) => {
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

    console.log("📝 Creating manual attendance with ENHANCED system:", {
      userId,
      date,
      punchInTime,
      punchOutTime,
      breakSessionsCount: breakSessions.length,
      overrideExisting
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
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Find or create the date-based AttendanceRecord
    let attendanceRecord = await AttendanceRecord.findOne({
      date: { $gte: targetDate, $lte: endOfDay }
    });

    // Check if this employee already has attendance for this date
    const existingEmployeeData = attendanceRecord?.employees?.find(
      emp => emp.userId.toString() === userId.toString()
    );

    if (existingEmployeeData && !overrideExisting) {
      return res.status(409).json({
        success: false,
        error: "Attendance record already exists for this employee on this date. Set overrideExisting=true to replace it.",
        existingRecords: {
          hasAttendanceRecord: true
        }
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
        duration: breakDuration,
        type: breakSession.type || "break"
      });
    }

    // Calculate work duration
    let totalWorkSeconds = 0;
    const workSessions = [];

    if (punchIn && punchOut && !isOnLeave && !isHoliday) {
      if (processedBreakSessions.length === 0) {
        totalWorkSeconds = Math.floor((punchOut - punchIn) / 1000);
        workSessions.push({
          start: punchIn,
          end: punchOut,
          duration: totalWorkSeconds
        });
      } else {
        let currentStart = punchIn;
        const sortedBreaks = processedBreakSessions.sort((a, b) => a.start - b.start);

        for (const breakSession of sortedBreaks) {
          if (currentStart < breakSession.start) {
            const workDuration = Math.floor((breakSession.start - currentStart) / 1000);
            if (workDuration > 0) {
              totalWorkSeconds += workDuration;
              workSessions.push({
                start: currentStart,
                end: breakSession.start,
                duration: workDuration
              });
            }
          }
          currentStart = breakSession.end;
        }

        if (currentStart < punchOut) {
          const workDuration = Math.floor((punchOut - currentStart) / 1000);
          if (workDuration > 0) {
            totalWorkSeconds += workDuration;
            workSessions.push({
              start: currentStart,
              end: punchOut,
              duration: workDuration
            });
          }
        }
      }
    }

    // Get effective shift and calculate status
    const effectiveShift = await getEffectiveShift(userId, targetDate);
    const attendanceData = await unifiedAttendanceService.getUnifiedAttendanceData(
      userId,
      targetDate,
      workSessions,
      processedBreakSessions,
      punchIn,
      effectiveShift
    );

    // Build events array (using PunchEventSchema format)
    const events = [];
    if (punchIn && !isOnLeave && !isHoliday) {
      events.push({
        type: "PUNCH_IN",
        timestamp: punchIn,
        manual: true,
        approvedBy: req.user._id,
        notes: notes || 'Manual entry'
      });
    }
    processedBreakSessions.forEach(breakSession => {
      events.push({
        type: "BREAK_START",
        timestamp: breakSession.start,
        manual: true,
        approvedBy: req.user._id
      });
      events.push({
        type: "BREAK_END",
        timestamp: breakSession.end,
        manual: true,
        approvedBy: req.user._id
      });
    });
    if (punchOut && !isOnLeave && !isHoliday) {
      events.push({
        type: "PUNCH_OUT",
        timestamp: punchOut,
        manual: true,
        approvedBy: req.user._id,
        notes: notes || 'Manual entry'
      });
    }

    // Build employee attendance data
    const employeeData = {
      userId,
      events,
      calculated: {
        arrivalTime: punchIn,
        departureTime: punchOut,
        workDurationSeconds: totalWorkSeconds,
        breakDurationSeconds: totalBreakSeconds,
        totalDurationSeconds: totalWorkSeconds + totalBreakSeconds,
        workDuration: `${Math.floor(totalWorkSeconds / 3600)}h ${Math.floor((totalWorkSeconds % 3600) / 60)}m`,
        breakDuration: `${Math.floor(totalBreakSeconds / 3600)}h ${Math.floor((totalBreakSeconds % 3600) / 60)}m`,
        isPresent: !isOnLeave && !isHoliday && punchIn !== null,
        isAbsent: isOnLeave || isHoliday || (!punchIn && !punchOut),
        isLate: attendanceData.isLate || false,
        isHalfDay: attendanceData.isHalfDay || false,
        isFullDay: totalWorkSeconds >= (6.5 * 3600),
        currentlyWorking: false,
        onBreak: false,
        currentStatus: 'FINISHED',
        totalWorkSessions: workSessions.length,
        totalBreakSessions: processedBreakSessions.length
      },
      assignedShift: effectiveShift ? {
        name: effectiveShift.name || 'Standard',
        startTime: effectiveShift.start,
        endTime: effectiveShift.end,
        durationHours: effectiveShift.durationHours || 9,
        // Map shift types to valid enum values: STANDARD, FLEXIBLE, NIGHT, SPLIT
        type: (() => {
          const shiftType = effectiveShift.type?.toLowerCase() || 'standard';
          if (shiftType.includes('flexible')) return 'FLEXIBLE';
          if (shiftType === 'night') return 'NIGHT';
          if (shiftType === 'split') return 'SPLIT';
          return 'STANDARD';
        })(),
        isFlexible: effectiveShift.type?.toLowerCase().includes('flexible') || false
      } : undefined,
      leaveInfo: {
        isOnLeave,
        isHoliday
      },
      metadata: {
        manualEntry: true,
        enteredBy: req.user._id,
        notes
      }
    };

    // Create or update the date record
    if (!attendanceRecord) {
      // Create new date record
      attendanceRecord = new AttendanceRecord({
        date: targetDate,
        employees: [employeeData],
        dailyStats: {
          totalEmployees: 1,
          present: employeeData.calculated.isPresent ? 1 : 0,
          absent: employeeData.calculated.isAbsent ? 1 : 0,
          late: employeeData.calculated.isLate ? 1 : 0,
          halfDay: employeeData.calculated.isHalfDay ? 1 : 0,
          fullDay: employeeData.calculated.isFullDay ? 1 : 0,
          onLeave: isOnLeave ? 1 : 0,
          onHoliday: isHoliday ? 1 : 0
        }
      });
    } else {
      // Update existing date record
      if (existingEmployeeData && overrideExisting) {
        // Remove old employee data
        attendanceRecord.employees = attendanceRecord.employees.filter(
          emp => emp.userId.toString() !== userId.toString()
        );
      }
      // Add new employee data
      attendanceRecord.employees.push(employeeData);
    }

    await attendanceRecord.save();

    console.log("✅ Manual attendance created/updated successfully:", {
      attendanceRecordId: attendanceRecord._id,
      date: attendanceRecord.date,
      employeeCount: attendanceRecord.employees?.length || 0,
      workDurationSeconds: totalWorkSeconds,
      breakDurationSeconds: totalBreakSeconds,
      eventsCount: events.length
    });

    res.status(200).json({
      success: true,
      message: overrideExisting ? "Manual attendance updated successfully" : "Manual attendance created successfully",
      data: {
        dailyWork: employeeData, // Return the employee data for frontend compatibility
        calculatedMetrics: {
          workHours: (totalWorkSeconds / 3600).toFixed(2),
          breakHours: (totalBreakSeconds / 3600).toFixed(2),
          status: attendanceData.status,
          isLate: attendanceData.isLate,
          isHalfDay: attendanceData.isHalfDay
        }
      }
    });

  } catch (error) {
    console.error("Error creating manual attendance (new system):", error);
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
  getAttendanceByUserAndDate,
  createManualAttendanceEnhanced
};