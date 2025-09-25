// controllers/summaryController.js
const DailyWork = require("../models/DailyWork");
const UserStatus = require("../models/UserStatus");
const User = require("../models/User");
const LeaveRequest = require("../models/LeaveRequest");
const { getEffectiveShift } = require("./statusController");
const attendanceService = require("../services/attendanceCalculationService");

// ======================
// Helper: Convert seconds to "Hh Mm" format
// ======================
function secToHM(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

// ======================
// GET /api/summary/week
// ======================
exports.getWeeklySummary = async (req, res) => {
  try {
    let userId = req.user?._id;

    // Check if admin is requesting data for a specific employee
    if (req.query.userId && ["admin", "super-admin", "hr"].includes(req.user.role)) {
      userId = req.query.userId;
    }

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findById(userId).lean();
    const userTimeZone = user?.timeZone || "UTC";

    let { startDate, endDate } = req.query;

    // Default: current week (Mon → Sun)
    if (!startDate || !endDate) {
      const now = new Date();
      const day = now.getDay(); // Sunday = 0
      const diffToMonday = (day + 6) % 7;

      startDate = new Date(now);
      startDate.setDate(now.getDate() - diffToMonday);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate = new Date(startDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(endDate);
      endDate.setHours(23, 59, 59, 999);
    }

    // OPTIMIZATION: Add performance logging and improve queries
    const startTime = Date.now();
    console.log(`Starting attendance summary for user ${userId}, date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Fetch DailyWork, UserStatus, and Leave data with optimized queries
    const [rawDailyData, userStatusData, leaveData] = await Promise.all([
      DailyWork.find({
        userId,
        date: { $gte: startDate, $lte: endDate },
      }).sort({ date: 1 }).lean(), // Use lean() for better performance
      UserStatus.find({
        userId,
        today: { $gte: startDate, $lte: endDate },
      }).sort({ today: 1 }).lean(), // Use lean() for better performance
      LeaveRequest.find({
        "employee._id": userId,
        status: "Approved", // Only approved leaves
        "period.start": { $lte: endDate },
        "period.end": { $gte: startDate }
      }).lean()
    ]);

    console.log(`Database queries completed in ${Date.now() - startTime}ms. Found ${rawDailyData.length} DailyWork records, ${userStatusData.length} UserStatus records, ${leaveData.length} leave records`);

    // Helper function to find leave for a specific date
    const findLeaveForDate = (date) => {
      const dateToCheck = new Date(date);
      dateToCheck.setHours(0, 0, 0, 0);

      return leaveData.find(leave => {
        const startDate = new Date(leave.period.start);
        const endDate = new Date(leave.period.end);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        return dateToCheck >= startDate && dateToCheck <= endDate;
      });
    };

    // Create a comprehensive date range with both sources
    const dateRange = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      dateRange.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    let totalWorkSeconds = 0;
    let totalBreakSeconds = 0;
    let earlyArrivals = 0;
    let lateArrivals = 0;
    let perfectDays = 0;
    let onTimeCount = 0;
    let breaksTaken = 0;
    let halfDays = 0;
    let absentDays = 0;
    let presentDays = 0;

    const dailyData = [];

    // OPTIMIZATION: Pre-fetch effective shifts for the entire date range to avoid N+1 queries
    const effectiveShiftsMap = {};
    console.log(`Fetching shifts for date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Batch fetch shifts for all dates (much faster than individual calls)
    for (const dateToProcess of dateRange) {
      const dateKey = dateToProcess.toISOString().split('T')[0];
      try {
        effectiveShiftsMap[dateKey] = await attendanceService.getEffectiveShift(userId, dateToProcess);
      } catch (error) {
        console.warn(`Failed to get shift for ${dateKey}:`, error.message);
        effectiveShiftsMap[dateKey] = null;
      }
    }

    console.log(`Processing ${dateRange.length} dates for user ${userId}`);

    // Process each date in the range
    for (const dateToProcess of dateRange) {
      const dateKey = dateToProcess.toISOString().split('T')[0];

      // Find existing DailyWork record (fix timezone issue - handle both string and Date objects)
      let dailyWorkRecord = rawDailyData.find(d => {
        let recordDateStr;
        if (typeof d.date === 'string') {
          recordDateStr = d.date.includes('T') ?
            d.date.split('T')[0] :
            new Date(d.date + 'T00:00:00').toISOString().split('T')[0];
        } else {
          // d.date is a Date object
          recordDateStr = d.date.toISOString().split('T')[0];
        }
        return recordDateStr === dateKey;
      });

      // Find corresponding UserStatus record (fix timezone issue - handle both string and Date objects)
      const userStatusRecord = userStatusData.find(s => {
        let statusDateStr;
        if (typeof s.today === 'string') {
          statusDateStr = s.today.includes('T') ?
            s.today.split('T')[0] :
            new Date(s.today + 'T00:00:00').toISOString().split('T')[0];
        } else {
          // s.today is a Date object
          statusDateStr = s.today.toISOString().split('T')[0];
        }
        return statusDateStr === dateKey;
      });

      // Get pre-fetched effective shift
      const effectiveShift = effectiveShiftsMap[dateKey];
      if (!effectiveShift) continue;

      // Find leave information for this date
      const leaveInfo = findLeaveForDate(dateToProcess);

      let workSeconds = 0;
      let breakSeconds = 0;
      let workedSessions = [];
      let breakSessions = [];
      let timeline = [];
      let arrivalTime = null;

      // Determine which data source to use and sync if needed
      if (userStatusRecord) {
        // Extract raw session data from UserStatus
        workedSessions = userStatusRecord.workedSessions || [];
        breakSessions = userStatusRecord.breakSessions || [];
        timeline = userStatusRecord.timeline || [];
        arrivalTime = userStatusRecord.arrivalTime;

        // CRITICAL: Always use attendance service to calculate work/break seconds with proper date filtering
        // Never trust workDurationSeconds/breakDurationSeconds from UserStatus as they may contain accumulated corruption
        try {
          const attendanceData = await attendanceService.getAttendanceData(
            userId,
            dateToProcess,
            workedSessions,
            breakSessions,
            arrivalTime,
            leaveInfo
          );

          if (!attendanceData.error) {
            workSeconds = attendanceData.workDurationSeconds;
            breakSeconds = attendanceData.breakDurationSeconds;
            console.log(`📊 Calculated work duration for ${dateKey}: ${(workSeconds/3600).toFixed(1)}h (filtered from ${workedSessions.length} sessions)`);
          } else {
            console.warn(`Attendance calculation failed for ${dateKey}:`, attendanceData.error);
            workSeconds = 0;
            breakSeconds = 0;
          }
        } catch (error) {
          console.error(`Attendance calculation error for ${dateKey}:`, error.message);
          workSeconds = 0;
          breakSeconds = 0;
        }

        // Sync DailyWork if it doesn't exist or is outdated
        if (!dailyWorkRecord) {
          try {
            dailyWorkRecord = new DailyWork({
              userId,
              userStatusId: userStatusRecord._id,
              date: dateToProcess,
              expectedStartTime: effectiveShift.isFlexible ? null : effectiveShift.start,
              shift: {
                name: effectiveShift.shiftName,
                start: effectiveShift.start,
                end: effectiveShift.end,
                isFlexible: effectiveShift.isFlexible,
                durationHours: effectiveShift.durationHours,
              },
              shiftType: effectiveShift.isFlexiblePermanent ? "flexiblePermanent" :
                        effectiveShift.isFlexible ? "flexible" : "standard",
              workDurationSeconds: workSeconds,
              breakDurationSeconds: breakSeconds,
              breakSessions,
              workedSessions,
              timeline,
              arrivalTime,
            });
            await dailyWorkRecord.save();
          } catch (syncError) {
            console.warn("Error syncing DailyWork:", syncError);
          }
        }
      } else if (dailyWorkRecord) {
        // Use existing DailyWork record
        workSeconds = dailyWorkRecord.workDurationSeconds || 0;
        breakSeconds = dailyWorkRecord.breakDurationSeconds || 0;
        workedSessions = dailyWorkRecord.workedSessions || [];
        breakSessions = dailyWorkRecord.breakSessions || [];
        timeline = dailyWorkRecord.timeline || [];
        arrivalTime = dailyWorkRecord.arrivalTime;
      } else {
        // No data available for this date - create absent record
        workSeconds = 0;
        breakSeconds = 0;
        workedSessions = [];
        breakSessions = [];
        timeline = [];
        arrivalTime = null;
      }

      // Get attendance status - calculate only if we haven't already done it for UserStatus
      let attendanceData = null;
      let isEarly = false;
      let isLate = false;
      let isHalfDay = false;
      let isAbsent = false;
      let isFullDay = false;
      let isWFH = false;

      if (userStatusRecord || leaveInfo) {
        // We calculate attendance data including leave information
        try {
          attendanceData = await attendanceService.getAttendanceData(
            userId,
            dateToProcess,
            workedSessions,
            breakSessions,
            arrivalTime,
            leaveInfo
          );

          if (!attendanceData.error) {
            const status = attendanceData.attendanceStatus;
            isAbsent = status.isAbsent;
            isHalfDay = status.isHalfDay;
            isFullDay = status.isFullDay;
            isLate = status.isLate;
            isEarly = status.isEarly;
            isWFH = status.isWFH;
          }
        } catch (error) {
          console.warn(`Status calculation failed for ${dateKey}:`, error.message);
        }
      }

      // Fallback calculation if attendance service failed or no data
      if (!attendanceData || attendanceData.error) {
        if (workSeconds < attendanceService.ATTENDANCE_RULES.MIN_HALF_DAY_WORK_HOURS * 3600) {
          isAbsent = true;
        } else if (workSeconds < attendanceService.ATTENDANCE_RULES.MIN_FULL_DAY_WORK_HOURS * 3600) {
          isHalfDay = true;
        } else {
          isFullDay = true;
        }
      }

      // Validate and cap work duration to prevent corrupted data from affecting frontend
      const maxDailySeconds = 86400; // 24 hours
      const cappedWorkSeconds = Math.min(workSeconds, maxDailySeconds);
      const cappedBreakSeconds = Math.min(breakSeconds, maxDailySeconds);

      // Update counters - treat WFH as present days
      totalWorkSeconds += cappedWorkSeconds;
      totalBreakSeconds += cappedBreakSeconds;

      if (isAbsent && !isWFH) {
        // Only count as absent if not on approved WFH
        absentDays++;
      } else {
        // Count WFH, half-day leaves, and regular presence as present
        presentDays++;
        if (isHalfDay) halfDays++;

        // For WFH, consider as on-time unless explicitly marked late
        if (isWFH) {
          onTimeCount++; // WFH is always considered on-time
          if (leaveInfo && leaveInfo.type !== 'halfDay') {
            perfectDays++; // Full-day WFH counts as perfect day
          }
        } else {
          // Regular attendance calculations
          if (isEarly) earlyArrivals++;
          if (isLate) lateArrivals++;

          if (!isLate && isFullDay) {
            onTimeCount++;
            if (cappedWorkSeconds >= attendanceService.ATTENDANCE_RULES.MIN_FULL_DAY_WORK_HOURS * 3600) {
              perfectDays++;
            }
          }
        }
      }

      if (Array.isArray(breakSessions)) {
        breaksTaken += breakSessions.length;
      }

      // Log if capping was applied
      if (workSeconds > maxDailySeconds) {
        console.warn(`⚠️ Capping work duration for ${dateToProcess}:`, {
          original: `${(workSeconds/3600).toFixed(1)}h`,
          capped: `${(cappedWorkSeconds/3600).toFixed(1)}h`,
          userId
        });
      }

      // Build comprehensive daily data with validated values
      const dailyDataItem = {
        _id: dailyWorkRecord?._id || null,
        userId,
        date: dateToProcess,
        workDurationSeconds: cappedWorkSeconds,
        breakDurationSeconds: cappedBreakSeconds,
        originalWorkDurationSeconds: workSeconds, // Keep original for debugging
        workedSessions,
        breakSessions,
        timeline,
        arrivalTime,
        effectiveShift,
        isEarly,
        isLate,
        isHalfDay,
        isAbsent,
        isFullDay,
        isWFH,
        leaveInfo: leaveInfo ? {
          type: leaveInfo.type,
          status: leaveInfo.status,
          reason: leaveInfo.reason
        } : null,
        shift: {
          name: effectiveShift.shiftName,
          start: effectiveShift.start,
          end: effectiveShift.end,
          isFlexible: effectiveShift.isFlexible,
          durationHours: effectiveShift.durationHours,
        },
        shiftType: effectiveShift.isFlexiblePermanent ? "flexiblePermanent" :
                  effectiveShift.isFlexible ? "flexible" : "standard",
        expectedStartTime: effectiveShift.isFlexible ? null : effectiveShift.start,
        dataValidationApplied: workSeconds !== cappedWorkSeconds || breakSeconds !== cappedBreakSeconds
      };

      // Debug logging (temporary)
      console.log(`📊 Backend: ${dateToProcess.toISOString().split('T')[0]} -> ${(cappedWorkSeconds/3600).toFixed(1)}h`, {
        date: dateToProcess,
        workSeconds: cappedWorkSeconds,
        breakSeconds: cappedBreakSeconds,
        status: { isAbsent, isHalfDay, isFullDay, isLate },
        capped: workSeconds !== cappedWorkSeconds || breakSeconds !== cappedBreakSeconds,
        sessionsCount: {
          work: workedSessions?.length || 0,
          break: breakSessions?.length || 0
        }
      });

      dailyData.push(dailyDataItem);
    }

    const daysCount = Math.max(dailyData.length, 1);
    const onTimeRate = presentDays > 0 ? `${Math.round((onTimeCount / presentDays) * 100)}%` : "0%";
    const avgDailyWork = Math.floor(totalWorkSeconds / daysCount);
    const avgDailyBreak = Math.floor(totalBreakSeconds / daysCount);

    const weeklySummary = {
      totalWork: secToHM(totalWorkSeconds),
      totalBreak: secToHM(totalBreakSeconds),
      avgDailyWork: secToHM(avgDailyWork),
      avgDailyBreak: secToHM(avgDailyBreak),
      daysCount: presentDays,
      totalDaysInRange: dailyData.length,
      onTimeRate,
      breaksTaken,
      halfDays,
      absentDays,
      presentDays,
      quickStats: {
        earlyArrivals,
        lateArrivals,
        perfectDays,
        onTimeCount,
      },
    };

    const totalTime = Date.now() - startTime;
    console.log(`✅ Attendance summary completed in ${totalTime}ms for ${dailyData.length} days`);

    res.json({ dailyData, weeklySummary });
  } catch (err) {
    console.error("❌ Error fetching weekly summary:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};