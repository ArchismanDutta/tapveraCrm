// services/AttendanceService.js
// Complete business logic for the new date-centric attendance system
const AttendanceRecord = require("../models/AttendanceRecord");
const User = require("../models/User");
const LeaveRequest = require("../models/LeaveRequest");
const Holiday = require("../models/Holiday");
const FlexibleShiftRequest = require("../models/FlexibleShiftRequest");

class AttendanceService {

  constructor() {
    // Constants for calculations
    this.CONSTANTS = {
      MIN_HALF_DAY_HOURS: 4,
      MIN_FULL_DAY_HOURS: 8,
      MAX_WORK_HOURS: 12,
      LATE_THRESHOLD_MINUTES: 15,
      BREAK_TIME_LIMIT_MINUTES: 60,
      MAX_DAILY_WORK_HOURS: 20,
      MIN_SESSION_DURATION_SECONDS: 30
    };

    // Standard shifts
    this.STANDARD_SHIFTS = {
      MORNING: { name: "Day Shift (Morning Shift)", startTime: "09:00", endTime: "18:00", durationHours: 9 },
      EVENING: { name: "Evening Shift", startTime: "13:00", endTime: "22:00", durationHours: 9 },
      NIGHT: { name: "Night Shift", startTime: "20:00", endTime: "05:00", durationHours: 9 },
      EARLY: { name: "Early Morning Shift", startTime: "05:30", endTime: "14:30", durationHours: 9 }
    };
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
    const now = new Date();
    const today = this.normalizeDate(now);

    // Get attendance record for today
    const record = await this.getAttendanceRecord(today);

    // Find or create employee record
    let employee = record.getEmployee(userId);

    if (!employee) {
      const employeeData = await this.createEmployeeRecord(userId, today);
      employee = record.upsertEmployee(employeeData);
    }

    // Validate punch event
    this.validatePunchEvent(employee, eventType, now);

    // Add punch event
    const punchEvent = {
      type: eventType,
      timestamp: now,
      location: options.location,
      ipAddress: options.ipAddress,
      device: options.device,
      manual: options.manual || false,
      approvedBy: options.approvedBy,
      notes: options.notes
    };

    employee.events.push(punchEvent);

    // Recalculate all derived data
    this.recalculateEmployeeData(employee);

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
      const effectiveShift = user.getEffectiveShift(date);

      if (effectiveShift) {
        return {
          name: effectiveShift.name,
          startTime: effectiveShift.start,
          endTime: effectiveShift.end,
          durationHours: effectiveShift.durationHours,
          isFlexible: effectiveShift.isFlexible,
          type: effectiveShift.isFlexible ? "FLEXIBLE" : "STANDARD"
        };
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
  async getLeaveInfo(userId, date) {
    try {
      const normalizedDate = this.normalizeDate(date);

      // Check for approved leave requests
      const leaveRequest = await LeaveRequest.findOne({
        userId,
        startDate: { $lte: normalizedDate },
        endDate: { $gte: normalizedDate },
        status: 'approved'
      });

      // Check for holidays
      const holiday = await Holiday.findOne({
        date: normalizedDate
      });

      return {
        isOnLeave: !!leaveRequest,
        leaveType: leaveRequest?.leaveType || null,
        isHoliday: !!holiday,
        holidayName: holiday?.name || null
      };

    } catch (error) {
      console.error('Error getting leave info:', error);
      return {
        isOnLeave: false,
        leaveType: null,
        isHoliday: false,
        holidayName: null
      };
    }
  }

  /**
   * Validate punch event against business rules
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
   */
  recalculateEmployeeData(employee) {
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
            workSeconds += sessionDuration;
            longestWork = Math.max(longestWork, sessionDuration);
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
    if (this.isSameDate(arrivalTime, now)) {
      if (currentWorkStart) {
        workSeconds += (now - currentWorkStart) / 1000;
      }
      if (currentBreakStart) {
        breakSeconds += (now - currentBreakStart) / 1000;
      }
    }

    // Calculate all derived fields
    const totalSeconds = workSeconds + breakSeconds;
    const workHours = workSeconds / 3600;
    const breakHours = breakSeconds / 3600;

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
      isLate: this.calculateIsLate(arrivalTime, employee.assignedShift),
      isHalfDay: workHours >= this.CONSTANTS.MIN_HALF_DAY_HOURS && workHours < this.CONSTANTS.MIN_FULL_DAY_HOURS,
      isFullDay: workHours >= this.CONSTANTS.MIN_FULL_DAY_HOURS,
      isOvertime: workHours > this.CONSTANTS.MAX_WORK_HOURS,

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
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  formatDateKey(date) {
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

  calculateIsLate(arrivalTime, shift) {
    if (!arrivalTime || !shift?.startTime) return false;

    const arrival = new Date(arrivalTime);
    const [shiftHour, shiftMin] = shift.startTime.split(':').map(Number);
    const shiftStart = new Date(arrival);
    shiftStart.setHours(shiftHour, shiftMin, 0, 0);

    return arrival > new Date(shiftStart.getTime() + this.CONSTANTS.LATE_THRESHOLD_MINUTES * 60000);
  }

  calculateLateMinutes(arrivalTime, shiftStartTime) {
    if (!arrivalTime || !shiftStartTime) return 0;

    const arrival = new Date(arrivalTime);
    const [shiftHour, shiftMin] = shiftStartTime.split(':').map(Number);
    const shiftStart = new Date(arrival);
    shiftStart.setHours(shiftHour, shiftMin, 0, 0);

    if (arrival <= shiftStart) return 0;

    return Math.floor((arrival - shiftStart) / 60000); // Convert to minutes
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