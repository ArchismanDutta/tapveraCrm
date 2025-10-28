// services/AttendanceService.js
// Complete business logic for the new date-centric attendance system
const AttendanceRecord = require("../models/AttendanceRecord");
const User = require("../models/User");
const Shift = require("../models/Shift");
const LeaveRequest = require("../models/LeaveRequest");
const Holiday = require("../models/Holiday");
const FlexibleShiftRequest = require("../models/FlexibleShiftRequest");

class AttendanceService {

  constructor() {
    // Constants for calculations
    this.CONSTANTS = {
      MIN_HALF_DAY_HOURS: 4,
      HALF_DAY_THRESHOLD_HOURS: 4.5, // < 4.5 hours = Half Day, >= 4.5 hours = Present
      MIN_FULL_DAY_HOURS: 8,
      MAX_WORK_HOURS: 12,
      LATE_THRESHOLD_MINUTES: 0, // STRICT ENFORCEMENT: Even 1 minute late counts as late
      BREAK_TIME_LIMIT_MINUTES: 60,
      MAX_DAILY_WORK_HOURS: 20,
      MIN_SESSION_DURATION_SECONDS: 30,
      EARLY_PUNCH_IN_ALLOWED: true, // No restriction on early punch-in
      TIMEZONE: 'Asia/Kolkata' // IST timezone for all calculations
    };

    // Standard shifts (all times in IST)
    this.STANDARD_SHIFTS = {
      MORNING: { name: "Day Shift (Morning Shift)", startTime: "09:00", endTime: "18:00", durationHours: 9 },
      EVENING: { name: "Evening Shift", startTime: "13:00", endTime: "22:00", durationHours: 9 },
      NIGHT: { name: "Night Shift", startTime: "20:00", endTime: "05:00", durationHours: 9 },
      EARLY: { name: "Early Morning Shift", startTime: "05:30", endTime: "14:30", durationHours: 9 }
    };
  }

  /**
   * Convert UTC timestamp to IST time components
   * This ensures timezone-independent calculations regardless of server timezone
   * @param {Date} utcDate - UTC timestamp
   * @returns {Object} { hour, minute, second } in IST
   */
  getISTTimeComponents(utcDate) {
    if (!utcDate) return null;

    const date = new Date(utcDate);

    // Use Intl.DateTimeFormat to get IST components
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: this.CONSTANTS.TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(date);
    const hour = parseInt(parts.find(p => p.type === 'hour').value);
    const minute = parseInt(parts.find(p => p.type === 'minute').value);
    const second = parseInt(parts.find(p => p.type === 'second').value);

    return { hour, minute, second };
  }

  /**
   * Get IST date components from UTC timestamp
   * @param {Date} utcDate - UTC timestamp
   * @returns {Object} { year, month, day } in IST
   */
  getISTDateComponents(utcDate) {
    if (!utcDate) return null;

    const date = new Date(utcDate);

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: this.CONSTANTS.TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    const parts = formatter.formatToParts(date);
    const year = parseInt(parts.find(p => p.type === 'year').value);
    const month = parseInt(parts.find(p => p.type === 'month').value);
    const day = parseInt(parts.find(p => p.type === 'day').value);

    return { year, month, day };
  }

  /**
   * Get or create attendance record for a specific date
   */
  async getAttendanceRecord(date) {
    const targetDate = this.normalizeDate(date);

    let record = await AttendanceRecord.findOne({ date: targetDate });

    if (!record) {
      record = new AttendanceRecord({
        date: targetDate,
        employees: [],
        dailyStats: this.getDefaultDailyStats(),
        departmentStats: [],
        specialDay: await this.getSpecialDayInfo(targetDate)
      });
      await record.save();
    }

    return record;
  }

  /**
   * Record punch event for employee
   */
  async recordPunchEvent(userId, eventType, options = {}) {
    // Use actual UTC timestamp - JavaScript Date is always UTC internally
    const now = new Date();

    console.log(`⏰ Recording punch event:`);
    console.log(`   User: ${userId}`);
    console.log(`   Event: ${eventType}`);
    console.log(`   UTC timestamp: ${now.toISOString()}`);
    console.log(`   Server local time: ${now.toLocaleString()}`);

    // IMPORTANT: For night shifts, determine the correct date
    // First, get user's shift to determine correct date
    const userShift = await this.getUserShift(userId, now);
    const today = this.getAttendanceDateForPunch(now, userShift);

    console.log(`   User shift: ${userShift?.startTime}-${userShift?.endTime}`);
    console.log(`   Assigned to date: ${today.toISOString().split('T')[0]}`);

    // Get attendance record for the determined date
    const record = await this.getAttendanceRecord(today);

    // Find or create employee record
    let employee = record.getEmployee(userId);

    if (!employee) {
      const employeeData = await this.createEmployeeRecord(userId, today);
      employee = record.upsertEmployee(employeeData);
    }

    // Validate punch event
    this.validatePunchEvent(employee, eventType, now);

    // Add punch event with actual UTC timestamp
    const punchEvent = {
      type: eventType,
      timestamp: now,  // Store actual UTC timestamp
      location: options.location,
      ipAddress: options.ipAddress,
      device: options.device,
      manual: options.manual || false,
      approvedBy: options.approvedBy,
      notes: options.notes
    };

    employee.events.push(punchEvent);

    // Recalculate all derived data
    this.recalculateEmployeeData(employee, today);

    // Update daily statistics
    this.updateDailyStats(record);

    // Save the record
    await record.save();

    return {
      success: true,
      employee,
      event: punchEvent,
      message: this.getPunchMessage(eventType)
    };
  }

  /**
   * Create new employee record for the day
   */
  async createEmployeeRecord(userId, date) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const shift = await this.getUserShift(userId, date);
    const leaveInfo = await this.getLeaveInfo(userId, date);

    return {
      userId,
      events: [],
      calculated: this.getDefaultCalculatedData(),
      assignedShift: shift,
      leaveInfo: leaveInfo,
      performance: this.getDefaultPerformanceData(),
      metadata: {
        lastUpdated: new Date(),
        version: 1,
        syncStatus: 'SYNCED'
      }
    };
  }

  /**
   * Get user's shift for a specific date
   */
  async getUserShift(userId, date) {
    try {
      const user = await User.findById(userId).populate('assignedShift');
      if (!user) return this.STANDARD_SHIFTS.MORNING;

      // Use the new integrated shift system from User model
      const effectiveShift = await user.getEffectiveShift(date);

      console.log('🔍 getUserShift - effectiveShift:', effectiveShift);

      if (effectiveShift) {
        const shiftData = {
          name: effectiveShift.name,
          startTime: effectiveShift.start,
          endTime: effectiveShift.end,
          durationHours: effectiveShift.durationHours,
          isFlexible: effectiveShift.isFlexible,
          type: effectiveShift.isFlexible ? "FLEXIBLE" : "STANDARD"
        };
        console.log('🔍 getUserShift - returning:', shiftData);
        return shiftData;
      }

      // Fallback to legacy system if no effective shift found
      const dateKey = this.formatDateKey(date);

      // Check for shift overrides
      if (user.shiftOverrides && user.shiftOverrides.has(dateKey)) {
        const override = user.shiftOverrides.get(dateKey);
        return {
          name: override.name || "Override Shift",
          startTime: override.start || "09:00",
          endTime: override.end || "18:00",
          durationHours: override.durationHours || 9,
          isFlexible: override.type === "flexible",
          type: override.type === "flexible" ? "FLEXIBLE" : "STANDARD"
        };
      }

      // Check for flexible shift request
      const flexRequest = await FlexibleShiftRequest.findOne({
        userId,
        date: { $gte: this.normalizeDate(date), $lt: new Date(this.normalizeDate(date).getTime() + 24 * 60 * 60 * 1000) },
        status: 'approved'
      });

      if (flexRequest) {
        return {
          name: "Flexible Shift",
          startTime: flexRequest.proposedStartTime || "09:00",
          endTime: flexRequest.proposedEndTime || "18:00",
          durationHours: flexRequest.proposedDurationHours || 9,
          isFlexible: true,
          type: "FLEXIBLE"
        };
      }

      // Return user's legacy shift or morning shift as final fallback
      if (user.shift && user.shift.start && user.shift.end) {
        return {
          name: user.shift.name || "Legacy Shift",
          startTime: user.shift.start,
          endTime: user.shift.end,
          durationHours: user.shift.durationHours || 9,
          isFlexible: user.shift.isFlexible || false,
          type: user.shift.isFlexible ? "FLEXIBLE" : "STANDARD"
        };
      }

      // Ultimate fallback to morning shift
      return this.STANDARD_SHIFTS.MORNING;

    } catch (error) {
      console.error('Error getting user shift:', error);
      return this.STANDARD_SHIFTS.MORNING;
    }
  }

  /**
   * Get leave information for user on date
   */
  /**
   * Get leave information for user on a specific date
   * Handles regular leaves AND Work From Home requests
   */
  async getLeaveInfo(userId, date) {
    try {
      const normalizedDate = this.normalizeDate(date);

      // Check for approved leave requests (including WFH)
      const leaveRequest = await LeaveRequest.findOne({
        'employee._id': userId,
        'period.start': { $lte: normalizedDate },
        'period.end': { $gte: normalizedDate },
        status: 'Approved' // Note: Status is capitalized in LeaveRequest model
      });

      // Check for holidays
      const holiday = await Holiday.findOne({
        date: normalizedDate
      });

      // Determine leave type
      let isOnLeave = false;
      let isWFH = false;
      let isPaidLeave = false;
      let leaveType = null;

      if (leaveRequest) {
        if (leaveRequest.type === 'workFromHome') {
          // WFH is NOT a leave - employee should work normal hours
          isWFH = true;
          leaveType = 'workFromHome';
          isOnLeave = false; // ⭐ WFH is NOT counted as leave
          isPaidLeave = false;
        } else if (leaveRequest.type === 'paid') {
          // ⭐ Paid leave: Separate from unpaid leaves, still counts as leave but marked distinctly
          isPaidLeave = true;
          isOnLeave = true;
          leaveType = 'paid';
        } else {
          // Other leaves (sick, unpaid, maternity, halfDay)
          isOnLeave = true;
          isPaidLeave = false;
          leaveType = leaveRequest.type;
        }
      }

      return {
        isOnLeave,      // True for all leaves (NOT for WFH)
        isWFH,          // Separate flag for Work From Home
        isPaidLeave,    // ⭐ NEW: Separate flag for Paid Leave
        leaveType,      // Type: sick/paid/unpaid/maternity/halfDay/workFromHome
        isHoliday: !!holiday,
        holidayName: holiday?.name || null
      };

    } catch (error) {
      console.error('Error getting leave info:', error);
      return {
        isOnLeave: false,
        isWFH: false,
        isPaidLeave: false,
        leaveType: null,
        isHoliday: false,
        holidayName: null
      };
    }
  }

  /**
   * Validate punch event against business rules
   * @param {Object} employee - Employee record
   * @param {String} eventType - Type of punch event
   * @param {Date} timestamp - Timestamp of the event
   */
  validatePunchEvent(employee, eventType, timestamp) {
    const lastEvent = employee.events[employee.events.length - 1];
    const currentStatus = employee.calculated.currentStatus;

    switch (eventType) {
      case 'PUNCH_IN':
        if (currentStatus === 'WORKING') {
          throw new Error('Employee is already punched in');
        }
        if (currentStatus === 'ON_BREAK') {
          throw new Error('Employee is on break. Use BREAK_END first');
        }
        break;

      case 'PUNCH_OUT':
        if (currentStatus === 'NOT_STARTED') {
          throw new Error('Employee has not punched in yet');
        }
        if (currentStatus === 'FINISHED') {
          throw new Error('Employee has already punched out');
        }
        break;

      case 'BREAK_START':
        if (currentStatus !== 'WORKING') {
          throw new Error('Employee must be working to start a break');
        }
        break;

      case 'BREAK_END':
        if (currentStatus !== 'ON_BREAK') {
          throw new Error('Employee is not on break');
        }
        break;

      default:
        throw new Error('Invalid event type');
    }

    // Check for duplicate events (within 1 minute)
    if (lastEvent &&
        lastEvent.type === eventType &&
        (timestamp - new Date(lastEvent.timestamp)) < 60000) {
      throw new Error('Duplicate punch event detected. Please wait before trying again.');
    }

    // Check for events too far in the past or future
    const maxPastHours = 24;
    const maxFutureMinutes = 5;
    const now = new Date();

    if (timestamp < new Date(now.getTime() - maxPastHours * 60 * 60 * 1000)) {
      throw new Error('Cannot record events more than 24 hours in the past');
    }

    if (timestamp > new Date(now.getTime() + maxFutureMinutes * 60 * 1000)) {
      throw new Error('Cannot record future events');
    }
  }

  /**
   * Recalculate all derived data from events
   * @param {Object} employee - The employee record
   * @param {Date} attendanceDate - The attendance date (REQUIRED for night shift duration/late calculation)
   */
  recalculateEmployeeData(employee, attendanceDate = null) {
    const events = employee.events.sort((a, b) =>
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    let workSeconds = 0;
    let breakSeconds = 0;
    let currentWorkStart = null;
    let currentBreakStart = null;
    let arrivalTime = null;
    let departureTime = null;
    let workSessions = 0;
    let breakSessions = 0;
    let longestWork = 0;
    let longestBreak = 0;
    let currentStatus = 'NOT_STARTED';

    for (const event of events) {
      const timestamp = new Date(event.timestamp);

      switch (event.type) {
        case 'PUNCH_IN':
          if (!arrivalTime) arrivalTime = timestamp;
          currentWorkStart = timestamp;
          currentStatus = 'WORKING';
          workSessions++;
          break;

        case 'BREAK_START':
          if (currentWorkStart) {
            const sessionDuration = (timestamp - currentWorkStart) / 1000;
            console.log(`   🔢 BREAK_START work session: ${timestamp.getTime()} - ${currentWorkStart.getTime()} = ${sessionDuration}s`);
            if (sessionDuration > 0) {
              workSeconds += sessionDuration;
              longestWork = Math.max(longestWork, sessionDuration);
            } else {
              console.warn(`   ⚠️ Negative work session duration detected: ${sessionDuration}s - skipping`);
            }
            currentWorkStart = null;
          }
          currentBreakStart = timestamp;
          currentStatus = 'ON_BREAK';
          breakSessions++;
          break;

        case 'BREAK_END':
          if (currentBreakStart) {
            const sessionDuration = (timestamp - currentBreakStart) / 1000;
            breakSeconds += sessionDuration;
            longestBreak = Math.max(longestBreak, sessionDuration);
            currentBreakStart = null;
          }
          currentWorkStart = timestamp;
          currentStatus = 'WORKING';
          break;

        case 'PUNCH_OUT':
          if (currentWorkStart) {
            const sessionDuration = (timestamp - currentWorkStart) / 1000;
            workSeconds += sessionDuration;
            longestWork = Math.max(longestWork, sessionDuration);
            currentWorkStart = null;
          }
          if (currentBreakStart) {
            const sessionDuration = (timestamp - currentBreakStart) / 1000;
            breakSeconds += sessionDuration;
            longestBreak = Math.max(longestBreak, sessionDuration);
            currentBreakStart = null;
          }
          departureTime = timestamp;
          currentStatus = 'FINISHED';
          break;
      }
    }

    // Handle ongoing sessions (for current day)
    const now = new Date();

    console.log(`⏱️ Duration Calculation Debug:`);
    console.log(`   Current UTC time: ${now.toISOString()}`);
    console.log(`   Arrival time: ${arrivalTime ? new Date(arrivalTime).toISOString() : 'null'}`);
    console.log(`   Current work start: ${currentWorkStart ? new Date(currentWorkStart).toISOString() : 'null'}`);
    console.log(`   Current break start: ${currentBreakStart ? new Date(currentBreakStart).toISOString() : 'null'}`);
    console.log(`   Attendance date: ${attendanceDate ? new Date(attendanceDate).toISOString().split('T')[0] : 'null'}`);
    console.log(`   Is night shift: ${this.isNightShift(employee.assignedShift)}`);

    // Use shouldIncludeInDateCalculation for night shift support
    if (this.shouldIncludeInDateCalculation(now, attendanceDate, employee.assignedShift)) {
      if (currentWorkStart) {
        const duration = (now - currentWorkStart) / 1000;
        console.log(`   🔢 Work duration calculation: ${duration}s`);
        workSeconds += duration;
      }
      if (currentBreakStart) {
        const duration = (now - currentBreakStart) / 1000;
        console.log(`   🔢 Break duration calculation: ${duration}s`);
        breakSeconds += duration;
      }
    } else {
      console.log(`   ⏭️  Skipping duration calculation - timestamp outside attendance date`);
    }

    console.log(`   📊 Final calculated durations: work=${workSeconds}s, break=${breakSeconds}s`);

    // Calculate all derived fields
    const totalSeconds = workSeconds + breakSeconds;
    const workHours = workSeconds / 3600;
    const breakHours = breakSeconds / 3600;

    // Check if employee has flexible shift (flexible permanent employees are never "late")
    const isFlexibleShift = employee.assignedShift?.isFlexible ||
                           employee.assignedShift?.name?.toLowerCase().includes('flexible') ||
                           false;

    // Check if employee is working from home (WFH)
    const isWFH = employee.leaveInfo?.isWFH || false;

    // Check if employee is on paid leave
    const isPaidLeave = employee.leaveInfo?.isPaidLeave || false;

    employee.calculated = {
      arrivalTime,
      departureTime,
      workDurationSeconds: Math.round(Math.max(0, workSeconds)),
      breakDurationSeconds: Math.round(Math.max(0, breakSeconds)),
      totalDurationSeconds: Math.round(Math.max(0, totalSeconds)),

      workDuration: this.formatDuration(workSeconds),
      breakDuration: this.formatDuration(breakSeconds),
      totalDuration: this.formatDuration(totalSeconds),

      isPresent: workSeconds > 0,
      isAbsent: workSeconds === 0,
      // Flexible employees are NEVER marked as late (no shift start time to compare against)
      isLate: isFlexibleShift ? false : this.calculateIsLate(arrivalTime, employee.assignedShift, attendanceDate),
      // Half-day status: >= 4 hours AND < 4.5 hours
      isHalfDay: workHours >= this.CONSTANTS.MIN_HALF_DAY_HOURS && workHours < this.CONSTANTS.HALF_DAY_THRESHOLD_HOURS,
      isFullDay: workHours >= this.CONSTANTS.MIN_FULL_DAY_HOURS,
      isOvertime: workHours > this.CONSTANTS.MAX_WORK_HOURS,
      isWFH, // ⭐ Work From Home flag (from approved WFH leave request)
      isPaidLeave, // ⭐ Paid Leave flag (from approved paid leave request)

      currentlyWorking: currentStatus === 'WORKING',
      onBreak: currentStatus === 'ON_BREAK',
      currentStatus,

      totalWorkSessions: workSessions,
      totalBreakSessions: breakSessions,
      longestWorkSession: Math.round(longestWork),
      longestBreakSession: Math.round(longestBreak)
    };

    // Update performance metrics
    this.updatePerformanceMetrics(employee);

    employee.metadata.lastUpdated = new Date();
  }

  /**
   * Update daily statistics
   */
  updateDailyStats(record) {
    const employees = record.employees;

    record.dailyStats = {
      totalEmployees: employees.length,
      present: employees.filter(e => e.calculated.isPresent).length,
      absent: employees.filter(e => e.calculated.isAbsent).length,
      late: employees.filter(e => e.calculated.isLate).length,
      halfDay: employees.filter(e => e.calculated.isHalfDay).length,
      fullDay: employees.filter(e => e.calculated.isFullDay).length,
      onLeave: employees.filter(e => e.leaveInfo.isOnLeave).length,
      onHoliday: employees.filter(e => e.leaveInfo.isHoliday).length,

      currentlyWorking: employees.filter(e => e.calculated.currentlyWorking).length,
      onBreak: employees.filter(e => e.calculated.onBreak).length,
      finished: employees.filter(e => e.calculated.currentStatus === 'FINISHED').length,

      totalWorkHours: employees.reduce((sum, e) => sum + (e.calculated.workDurationSeconds / 3600), 0),
      totalBreakHours: employees.reduce((sum, e) => sum + (e.calculated.breakDurationSeconds / 3600), 0),
      averageWorkHours: employees.length > 0 ?
        employees.reduce((sum, e) => sum + (e.calculated.workDurationSeconds / 3600), 0) / employees.length : 0,

      averagePunctualityScore: employees.length > 0 ?
        employees.reduce((sum, e) => sum + e.performance.punctualityScore, 0) / employees.length : 0,
      averageAttendanceScore: employees.length > 0 ?
        employees.reduce((sum, e) => sum + e.performance.attendanceScore, 0) / employees.length : 0,
      totalOvertimeHours: employees.reduce((sum, e) =>
        e.calculated.isOvertime ? sum + Math.max(0, (e.calculated.workDurationSeconds / 3600) - this.CONSTANTS.MAX_WORK_HOURS) : sum, 0)
    };

    // Calculate average times
    const presentEmployees = employees.filter(e => e.calculated.arrivalTime);
    if (presentEmployees.length > 0) {
      const avgArrival = presentEmployees.reduce((sum, e) => {
        const time = new Date(e.calculated.arrivalTime);
        return sum + (time.getHours() * 60 + time.getMinutes());
      }, 0) / presentEmployees.length;

      record.dailyStats.averageArrivalTime = this.minutesToTimeString(avgArrival);
    }

    const departedEmployees = employees.filter(e => e.calculated.departureTime);
    if (departedEmployees.length > 0) {
      const avgDeparture = departedEmployees.reduce((sum, e) => {
        const time = new Date(e.calculated.departureTime);
        return sum + (time.getHours() * 60 + time.getMinutes());
      }, 0) / departedEmployees.length;

      record.dailyStats.averageDepartureTime = this.minutesToTimeString(avgDeparture);
    }
  }

  /**
   * Get employee's attendance for date range
   */
  async getEmployeeAttendance(userId, startDate, endDate) {
    const start = this.normalizeDate(startDate);
    const end = this.normalizeDate(endDate);

    const records = await AttendanceRecord.find({
      date: { $gte: start, $lte: end },
      'employees.userId': userId
    }).sort({ date: 1 });

    const attendance = [];

    for (const record of records) {
      const employee = record.getEmployee(userId);

      if (employee) {
        // CRITICAL: Recalculate data with current time to get accurate live durations
        // This ensures ongoing work/break sessions show correct elapsed time
        this.recalculateEmployeeData(employee, record.date);

        // Format calculated data to ensure dates are ISO strings, not Date objects
        const calculated = { ...employee.calculated };
        if (calculated.arrivalTime instanceof Date) {
          calculated.arrivalTime = calculated.arrivalTime.toISOString();
        }
        if (calculated.departureTime instanceof Date) {
          calculated.departureTime = calculated.departureTime.toISOString();
        }

        attendance.push({
          date: this.formatDateKey(record.date), // Return as YYYY-MM-DD string to avoid timezone issues
          ...calculated,
          events: employee.events,
          shift: employee.assignedShift,
          leave: employee.leaveInfo,
          performance: employee.performance
        });
      }
    }

    return {
      userId,
      period: { start: startDate, end: endDate },
      data: attendance,
      summary: this.calculatePeriodSummary(attendance)
    };
  }

  /**
   * Get daily attendance report
   */
  async getDailyReport(date) {
    const record = await this.getAttendanceRecord(date);
    await record.populate('employees.userId', 'name email department profileImage');

    return {
      date: record.date,
      stats: record.dailyStats,
      departmentStats: record.departmentStats,
      specialDay: record.specialDay,
      employees: record.employees.map(emp => ({
        user: emp.userId,
        attendance: emp.calculated,
        events: emp.events,
        shift: emp.assignedShift,
        leave: emp.leaveInfo,
        performance: emp.performance
      }))
    };
  }

  /**
   * Get weekly attendance summary
   */
  async getWeeklySummary(startDate, endDate) {
    const start = this.normalizeDate(startDate);
    const end = this.normalizeDate(endDate);

    const records = await AttendanceRecord.find({
      date: { $gte: start, $lte: end }
    }).sort({ date: 1 });

    const summary = {
      period: { start: startDate, end: endDate },
      dailyData: records.map(r => ({
        date: r.date,
        stats: r.dailyStats,
        employeeCount: r.employees.length
      })),
      weeklyTotals: {
        totalWorkDays: records.length,
        totalEmployeeDays: records.reduce((sum, r) => sum + r.employees.length, 0),
        totalPresentDays: records.reduce((sum, r) => sum + r.dailyStats.present, 0),
        totalAbsentDays: records.reduce((sum, r) => sum + r.dailyStats.absent, 0),
        totalLateDays: records.reduce((sum, r) => sum + r.dailyStats.late, 0),
        totalWorkHours: records.reduce((sum, r) => sum + r.dailyStats.totalWorkHours, 0),
        averageAttendanceRate: records.length > 0 ?
          (records.reduce((sum, r) => sum + (r.dailyStats.present / Math.max(r.dailyStats.totalEmployees, 1)), 0) / records.length) * 100 : 0,
        averagePunctualityRate: records.length > 0 ?
          (records.reduce((sum, r) => sum + ((r.dailyStats.present - r.dailyStats.late) / Math.max(r.dailyStats.present, 1)), 0) / records.length) * 100 : 0
      }
    };

    return summary;
  }

  /**
   * Calculate period summary for attendance data
   */
  calculatePeriodSummary(attendance) {
    if (attendance.length === 0) {
      return {
        totalDays: 0,
        presentDays: 0,
        absentDays: 0,
        lateDays: 0,
        totalHours: 0,
        averageHours: 0,
        attendanceRate: 0,
        punctualityRate: 0
      };
    }

    const totalDays = attendance.length;
    const presentDays = attendance.filter(a => a.isPresent).length;
    const absentDays = attendance.filter(a => a.isAbsent).length;
    const lateDays = attendance.filter(a => a.isLate).length;
    const totalHours = attendance.reduce((sum, a) => sum + (a.workDurationSeconds / 3600), 0);

    return {
      totalDays,
      presentDays,
      absentDays,
      lateDays,
      totalHours: Math.round(totalHours * 100) / 100,
      averageHours: Math.round((totalHours / totalDays) * 100) / 100,
      attendanceRate: Math.round((presentDays / totalDays) * 100),
      punctualityRate: presentDays > 0 ? Math.round(((presentDays - lateDays) / presentDays) * 100) : 100
    };
  }

  /**
   * Get special day information (holidays, weekends)
   */
  async getSpecialDayInfo(date) {
    try {
      const normalizedDate = this.normalizeDate(date);
      const dayOfWeek = normalizedDate.getDay();

      // Check if it's a holiday
      const holiday = await Holiday.findOne({ date: normalizedDate });

      return {
        isHoliday: !!holiday,
        holidayName: holiday?.name || null,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6, // Sunday = 0, Saturday = 6
        isWorkingDay: !holiday && dayOfWeek !== 0 && dayOfWeek !== 6
      };

    } catch (error) {
      console.error('Error getting special day info:', error);
      return {
        isHoliday: false,
        holidayName: null,
        isWeekend: false,
        isWorkingDay: true
      };
    }
  }

  // Helper methods
  normalizeDate(date) {
    // Keep using local timezone for backward compatibility with existing records
    // The date represents midnight in the server's local timezone
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Get the correct attendance date for a punch event
   * For night shifts, punches after midnight belong to the PREVIOUS day's shift
   * Uses IST timezone regardless of server timezone
   */
  getAttendanceDateForPunch(punchTime, shift) {
    const punch = new Date(punchTime);

    // Get punch hour in IST (timezone-independent)
    const istTime = this.getISTTimeComponents(punchTime);
    if (!istTime) {
      return this.normalizeDate(punch);
    }
    const punchHour = istTime.hour;

    // If no shift or not a night shift, use the punch date
    if (!shift || !shift.startTime || !shift.endTime) {
      return this.normalizeDate(punch);
    }

    const [startHour] = shift.startTime.split(':').map(Number);
    const [endHour] = shift.endTime.split(':').map(Number);

    // Check if this is a night shift (shift that crosses midnight)
    const isNightShift = endHour < startHour;

    if (isNightShift) {
      // For night shifts, if punch is BEFORE shift end time AND after midnight,
      // it belongs to PREVIOUS day's shift
      // Example: Shift 20:00-05:00
      //   - Punch at 18:00 IST = Sept 10 → Record for Sept 10 ✅
      //   - Punch at 22:00 IST = Sept 10 → Record for Sept 10 ✅
      //   - Punch at 02:00 IST = Sept 11 → Record for Sept 10 ✅ (belongs to previous shift)
      //   - Punch at 06:00 IST = Sept 11 → Record for Sept 11 ✅ (after shift ends)

      if (punchHour < endHour) {
        // Punch is in the early morning hours (00:00 - endHour) IST
        // This belongs to YESTERDAY's night shift
        const yesterday = new Date(punch);
        yesterday.setDate(yesterday.getDate() - 1);
        console.log(`🌙 Night shift detected: Punch at ${punchHour}:00 IST before shift end ${endHour}:00`);
        console.log(`   Assigning to previous day: ${yesterday.toISOString().split('T')[0]}`);
        return this.normalizeDate(yesterday);
      } else if (punchHour >= startHour) {
        // Punch is in the evening (after shift start) IST
        // This belongs to TODAY's night shift
        console.log(`🌙 Night shift detected: Punch at ${punchHour}:00 IST after shift start ${startHour}:00`);
        console.log(`   Assigning to current day: ${punch.toISOString().split('T')[0]}`);
        return this.normalizeDate(punch);
      } else {
        // Punch is between endHour and startHour (the "off" hours) IST
        // For example, punching at 10:00 AM IST for a 20:00-05:00 shift
        // This is unusual - could be early punch for today's shift
        // Assign to today
        console.log(`⚠️  Unusual punch time: Punch at ${punchHour}:00 IST between shift end ${endHour}:00 and start ${startHour}:00`);
        console.log(`   Assigning to current day: ${punch.toISOString().split('T')[0]}`);
        return this.normalizeDate(punch);
      }
    }

    // Not a night shift, use the punch date
    return this.normalizeDate(punch);
  }

  formatDateKey(date) {
    // IMPORTANT: Use local date components (not UTC) because normalizeDate stores dates
    // as midnight in local timezone. This ensures the formatted date matches the intended date.
    // For example, if record.date is "Oct 5 midnight IST" stored as 2025-10-04T18:30:00.000Z:
    // - In IST: getFullYear/Month/Date returns Oct 5 (correct)
    // - In UTC: would need to use the same approach
    // Since we're using local timezone consistently, use local date methods
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  isSameDate(date1, date2) {
    if (!date1 || !date2) return false;
    return this.normalizeDate(date1).getTime() === this.normalizeDate(date2).getTime();
  }

  /**
   * Check if a shift crosses midnight (night shift)
   * @param {Object} shift - Shift object with startTime and endTime
   * @returns {Boolean} - True if shift crosses midnight
   */
  isNightShift(shift) {
    if (!shift?.startTime || !shift?.endTime) return false;

    const [startHour] = shift.startTime.split(':').map(Number);
    const [endHour] = shift.endTime.split(':').map(Number);

    return endHour < startHour; // e.g., 20:00-05:00
  }

  /**
   * Check if timestamp should be included in attendance date's calculations
   * Handles night shifts that span midnight without affecting day/evening shifts
   * @param {Date} timestamp - The timestamp to check
   * @param {Date} attendanceDate - The attendance date
   * @param {Object} shift - The shift object
   * @returns {Boolean} - True if timestamp belongs to this attendance date
   */
  shouldIncludeInDateCalculation(timestamp, attendanceDate, shift) {
    if (!timestamp || !attendanceDate) return false;

    // For regular shifts (non-night), use simple date comparison
    if (!this.isNightShift(shift)) {
      return this.isSameDate(timestamp, attendanceDate);
    }

    // For night shifts, check if timestamp belongs to this shift
    const timestampAttendanceDate = this.getAttendanceDateForPunch(timestamp, shift);
    return this.normalizeDate(timestampAttendanceDate).getTime() ===
           this.normalizeDate(attendanceDate).getTime();
  }

  formatDuration(seconds) {
    if (!seconds || seconds < 0) return "0h 0m";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  minutesToTimeString(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Calculate if employee is late based on shift start time
   * STRICT ENFORCEMENT: Even 1 second late counts as late (NO GRACE PERIOD)
   * Times are compared in IST regardless of server timezone
   *
   * NOTE: Flexible permanent employees are NEVER marked as late
   *
   * @param {Date} arrivalTime - First punch in time (UTC timestamp from database)
   * @param {Object} shift - Employee's assigned shift { startTime, endTime, ... } (times in IST)
   * @param {Date} attendanceDate - The attendance date (for night shift handling)
   * @returns {Boolean} - True if late
   */
  calculateIsLate(arrivalTime, shift, attendanceDate = null) {
    console.log('🔍 calculateIsLate called with:', {
      arrivalTime,
      shift,
      attendanceDate,
      hasStartTime: !!shift?.startTime,
      isFlexible: shift?.isFlexible
    });

    // Flexible permanent employees are NEVER late (they can work any 9 hours in 24h period)
    if (shift?.isFlexible || shift?.name?.toLowerCase().includes('flexible')) {
      console.log('✅ calculateIsLate: Flexible shift detected - NEVER LATE');
      return false;
    }

    if (!arrivalTime || !shift?.startTime) {
      console.log('❌ calculateIsLate: Missing data - RETURNING FALSE', {
        arrivalTime,
        shiftStartTime: shift?.startTime,
        shiftObject: shift
      });
      return false;
    }

    // Parse shift start time (defined in IST)
    const [shiftHour, shiftMin] = shift.startTime.split(':').map(Number);

    // Get arrival time components in IST (timezone-independent)
    const istTime = this.getISTTimeComponents(arrivalTime);
    if (!istTime) {
      console.log('❌ calculateIsLate: Failed to get IST components');
      return false;
    }

    const { hour: arrivalHour, minute: arrivalMin, second: arrivalSec } = istTime;

    // Convert to total seconds since midnight IST for precise comparison
    const arrivalTotalSeconds = arrivalHour * 3600 + arrivalMin * 60 + arrivalSec;
    const shiftStartSeconds = shiftHour * 3600 + shiftMin * 60; // Shift starts at 0 seconds

    // STRICT ENFORCEMENT: Even 1 second late counts as late
    // If arrival time is AFTER shift start (even by 1 second), employee is late
    const secondsLate = arrivalTotalSeconds - shiftStartSeconds;
    const isLate = secondsLate > 0;
    const minutesLate = Math.max(0, Math.floor(secondsLate / 60));

    console.log('🕐 calculateIsLate RESULT (STRICT MODE - NO GRACE PERIOD):', {
      arrivalTimeUTC: new Date(arrivalTime).toISOString(),
      arrivalIST: `${String(arrivalHour).padStart(2, '0')}:${String(arrivalMin).padStart(2, '0')}:${String(arrivalSec).padStart(2, '0')} IST`,
      shiftStartTime: `${shift.startTime}:00 IST`,
      arrivalSeconds: arrivalTotalSeconds,
      shiftStartSeconds,
      secondsLate,
      minutesLate,
      isLate,
      verdict: secondsLate < 0 ? `✅ EARLY by ${Math.abs(secondsLate)}s` :
               secondsLate === 0 ? '✅ ON-TIME (exactly on time)' :
               `❌ LATE by ${secondsLate}s (${minutesLate} min ${secondsLate % 60}s)`
    });

    return isLate;
  }

  /**
   * Calculate exact late minutes for employee
   * STRICT ENFORCEMENT: Counts seconds and rounds up to next minute
   * Uses IST timezone regardless of server timezone
   *
   * @param {Date} arrivalTime - Arrival timestamp (UTC from database)
   * @param {String} shiftStartTime - Shift start time in HH:MM format (IST)
   * @returns {Number} - Minutes late (0 if early/on-time)
   */
  calculateLateMinutes(arrivalTime, shiftStartTime) {
    if (!arrivalTime || !shiftStartTime) return 0;

    // Parse shift start time (in IST)
    const [shiftHour, shiftMin] = shiftStartTime.split(':').map(Number);

    // Get arrival time components in IST (timezone-independent)
    const istTime = this.getISTTimeComponents(arrivalTime);
    if (!istTime) return 0;

    const { hour: arrivalHour, minute: arrivalMin, second: arrivalSec } = istTime;

    // Convert to total seconds since midnight IST for precise calculation
    const arrivalTotalSeconds = arrivalHour * 3600 + arrivalMin * 60 + arrivalSec;
    const shiftStartSeconds = shiftHour * 3600 + shiftMin * 60;

    // Calculate seconds late
    const secondsLate = Math.max(0, arrivalTotalSeconds - shiftStartSeconds);

    // Round up to next minute if there are any remaining seconds
    // Example: 1 minute 30 seconds late = 2 minutes late (rounded up)
    return Math.ceil(secondsLate / 60);
  }

  updatePerformanceMetrics(employee) {
    const calc = employee.calculated;

    // Punctuality score (0-100)
    let punctualityScore = 100;
    if (calc.isLate && calc.arrivalTime && employee.assignedShift?.startTime) {
      const lateMinutes = this.calculateLateMinutes(calc.arrivalTime, employee.assignedShift.startTime);
      punctualityScore = Math.max(0, 100 - (lateMinutes * 2)); // -2 points per minute late
    }

    // Attendance score (0-100)
    let attendanceScore = 100;
    if (calc.isAbsent) attendanceScore = 0;
    else if (calc.isHalfDay) attendanceScore = 50;

    // Productivity hours (actual work hours)
    const productivityHours = calc.workDurationSeconds / 3600;

    // Efficiency rating (1-5)
    const efficiencyRating = this.calculateEfficiencyRating(employee);

    employee.performance = {
      punctualityScore: Math.round(punctualityScore),
      attendanceScore: Math.round(attendanceScore),
      productivityHours: Math.round(productivityHours * 100) / 100,
      efficiencyRating: Math.round(efficiencyRating * 100) / 100
    };
  }

  calculateEfficiencyRating(employee) {
    const workHours = employee.calculated.workDurationSeconds / 3600;
    const breakHours = employee.calculated.breakDurationSeconds / 3600;

    if (workHours === 0) return 1;

    const breakRatio = breakHours / workHours;
    let rating = 5; // Start with perfect score

    // Deduct points for excessive breaks
    if (breakRatio > 0.15) rating -= 0.5; // More than 15% break time
    if (breakRatio > 0.25) rating -= 0.5; // More than 25% break time
    if (breakRatio > 0.35) rating -= 1;   // More than 35% break time

    // Deduct points for insufficient work hours
    if (workHours < 6) rating -= 0.5;
    if (workHours < 4) rating -= 1;
    if (workHours < 2) rating -= 1.5;

    // Bonus for good work hours
    if (workHours >= 8 && breakRatio <= 0.15) rating += 0.2;

    return Math.max(1, Math.min(5, rating));
  }

  getPunchMessage(eventType) {
    const messages = {
      'PUNCH_IN': 'Successfully punched in',
      'PUNCH_OUT': 'Successfully punched out',
      'BREAK_START': 'Break started',
      'BREAK_END': 'Break ended, work resumed'
    };
    return messages[eventType] || 'Event recorded';
  }

  getDefaultCalculatedData() {
    return {
      arrivalTime: null,
      departureTime: null,
      workDurationSeconds: 0,
      breakDurationSeconds: 0,
      totalDurationSeconds: 0,
      workDuration: "0h 0m",
      breakDuration: "0h 0m",
      totalDuration: "0h 0m",
      isPresent: false,
      isAbsent: true,
      isLate: false,
      isHalfDay: false,
      isFullDay: false,
      isOvertime: false,
      isWFH: false, // ⭐ Work From Home flag
      isPaidLeave: false, // ⭐ Paid Leave flag
      currentlyWorking: false,
      onBreak: false,
      currentStatus: 'NOT_STARTED',
      totalWorkSessions: 0,
      totalBreakSessions: 0,
      longestWorkSession: 0,
      longestBreakSession: 0
    };
  }

  getDefaultDailyStats() {
    return {
      totalEmployees: 0,
      present: 0,
      absent: 0,
      late: 0,
      halfDay: 0,
      fullDay: 0,
      onLeave: 0,
      onHoliday: 0,
      currentlyWorking: 0,
      onBreak: 0,
      finished: 0,
      totalWorkHours: 0,
      totalBreakHours: 0,
      averageWorkHours: 0,
      averageArrivalTime: "00:00",
      averageDepartureTime: "00:00",
      averagePunctualityScore: 0,
      averageAttendanceScore: 0,
      totalOvertimeHours: 0
    };
  }

  getDefaultPerformanceData() {
    return {
      punctualityScore: 0,
      attendanceScore: 0,
      productivityHours: 0,
      efficiencyRating: 0
    };
  }
}

module.exports = AttendanceService;