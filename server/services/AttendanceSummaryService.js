// services/AttendanceSummaryService.js
//
// THE monthly attendance figures. One calculation, consumed by both the
// attendance screens and payroll, so the two can never disagree.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS EXISTS
//
// Before this service there were seventeen separate places counting monthly
// present/absent/leave days — the employee attendance page, the super-admin
// portal (twice, one overwriting the other), payroll, dashboards, exports —
// each with its own rule about half days, WFH and lateness. They disagreed.
// Payroll is the one that turns those numbers into money, so every
// disagreement was somebody's pay.
//
// ─────────────────────────────────────────────────────────────────────────────
// TWO RULES THAT MAKE THIS DIFFERENT FROM WHAT CAME BEFORE
//
// 1. It walks the CALENDAR, not the attendance records.
//    An attendance row only exists once somebody punches. Counting rows can
//    therefore never see a day the employee simply did not show up, and every
//    record-driven counter in this codebase structurally cannot report an
//    absence.
//
// 2. Leave is resolved from LeaveRequest, not from record.leaveInfo.
//    leaveInfo is stamped onto an employee's row at the moment that row is
//    created — i.e. on their first punch of the day. Someone on approved leave
//    does not punch, so no row exists and no leaveInfo is ever written; a leave
//    approved after the day has passed is never stamped either. Reading
//    leaveInfo means approved paid leave looks identical to an unexplained
//    absence. This service asks LeaveRequest directly.
//
// ─────────────────────────────────────────────────────────────────────────────
// PAY BASIS (must stay in step with AutoPayrollService.calculateSalaryBreakdown)
//
// Salary is prorated as (component / days in month) x paidDays, so paidDays is
// counted against the whole calendar: weekends and company holidays are paid
// days, and only a working day that was neither worked nor covered by leave
// reduces pay.
//
// Unpaid leave is a deliberate exception. It is CREDITED here as a paid day and
// then removed once by the lwpDeduction line in payroll, so the employee can
// see on the payslip what was taken and why. Subtracting it in both places is
// what made one day of unpaid leave cost nearly three days of pay.

const AttendanceRecord = require("../models/AttendanceRecord");
const LeaveRequest = require("../models/LeaveRequest");
const Holiday = require("../models/Holiday");
const AttendanceService = require("./AttendanceService");

// Day classifications. Every day of the month gets exactly one.
const DAY_STATUS = {
  WEEKEND: "weekend",
  HOLIDAY: "holiday",
  PRESENT: "present",
  HALF_DAY: "halfDay",
  WFH: "wfh",
  PAID_LEAVE: "paidLeave",
  UNPAID_LEAVE: "unpaidLeave",
  ABSENT: "absent",
  UPCOMING: "upcoming", // in a month still running: not yet happened
};

// Share of a day's pay each classification earns.
const DAY_CREDIT = {
  [DAY_STATUS.WEEKEND]: 1,
  [DAY_STATUS.HOLIDAY]: 1,
  [DAY_STATUS.PRESENT]: 1,
  [DAY_STATUS.WFH]: 1,
  [DAY_STATUS.PAID_LEAVE]: 1,
  [DAY_STATUS.HALF_DAY]: 0.5,
  [DAY_STATUS.UNPAID_LEAVE]: 1, // deducted once by payroll's lwpDeduction
  [DAY_STATUS.ABSENT]: 0,
  [DAY_STATUS.UPCOMING]: 0,
};

// When two approved leave requests cover the same day, the higher rank wins.
// Deterministic, and resolves in the employee's favour.
const LEAVE_RANK = { paid: 4, sick: 4, maternity: 4, workFromHome: 3, halfDay: 2, unpaid: 1 };

class AttendanceSummaryService {
  constructor() {
    this.attendanceService = new AttendanceService();
  }

  /**
   * Format a date as "YYYY-MM-DD" from local parts.
   *
   * Local parts are used on every side of every comparison in this file —
   * the calendar walk, attendance records, leave ranges, holidays — so the
   * keys always line up. Mixing local and UTC parts shifts dates by one in
   * any timezone east of UTC, which is where this deployment runs.
   */
  toDateKey(date) {
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${month}-${day}`;
  }

  isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  /**
   * Approved leave for the month, expanded to one entry per covered date.
   * @returns {Promise<Map<string,string>>} date key -> LeaveRequest.type
   */
  async fetchLeaveByDate(userId, monthStart, monthEnd) {
    const byDate = new Map();

    const leaves = await LeaveRequest.find({
      "employee._id": userId,
      status: "Approved",
      "period.start": { $lte: monthEnd },
      "period.end": { $gte: monthStart },
    }).lean();

    for (const leave of leaves) {
      const start = new Date(Math.max(new Date(leave.period.start), monthStart));
      const end = new Date(Math.min(new Date(leave.period.end), monthEnd));

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = this.toDateKey(d);
        const existing = byDate.get(key);
        if (!existing || (LEAVE_RANK[leave.type] || 0) > (LEAVE_RANK[existing] || 0)) {
          byDate.set(key, leave.type);
        }
      }
    }

    return byDate;
  }

  /**
   * Company holidays in the month, as date keys.
   * A holiday lookup that fails must not silently dock everyone a day, so a
   * failure returns an empty set and says so.
   */
  async fetchHolidayKeys(monthStart, monthEnd) {
    try {
      const holidays = await Holiday.find({ date: { $gte: monthStart, $lte: monthEnd } }).lean();
      return new Set(holidays.map((h) => this.toDateKey(h.date)));
    } catch (err) {
      console.error("⚠️  Holiday lookup failed, treating none as holidays:", err.message);
      return new Set();
    }
  }

  /**
   * This employee's attendance rows for the month, keyed by date.
   * Each row is recalculated first so isLate / lateMinutes / work hours
   * reflect the current rules rather than whatever was cached when it was
   * written.
   */
  async fetchAttendanceByDate(userId, monthStart, monthEnd) {
    const byDate = new Map();

    const records = await AttendanceRecord.find({
      date: { $gte: monthStart, $lte: monthEnd },
      "employees.userId": userId,
    }).lean();

    for (const record of records) {
      const employee = (record.employees || []).find(
        (e) => e.userId && e.userId.toString() === userId.toString()
      );
      if (!employee) continue;

      this.attendanceService.recalculateEmployeeData(employee, record.date);
      byDate.set(this.toDateKey(record.date), employee);
    }

    return byDate;
  }

  /**
   * Classify one calendar day.
   * @returns {{status: string, isLate: boolean, lateMinutes: number, workHours: number, breakPolicyFlagged: boolean}}
   */
  classifyDay({ date, isUpcoming, holidayKeys, leaveByDate, attendanceByDate }) {
    const key = this.toDateKey(date);
    const blank = { isLate: false, lateMinutes: 0, workHours: 0, breakPolicyFlagged: false };

    if (isUpcoming) return { status: DAY_STATUS.UPCOMING, ...blank };
    if (this.isWeekend(date)) return { status: DAY_STATUS.WEEKEND, ...blank };
    if (holidayKeys.has(key)) return { status: DAY_STATUS.HOLIDAY, ...blank };

    const leaveType = leaveByDate.get(key) || null;
    const employee = attendanceByDate.get(key);
    const calc = (employee && employee.calculated) || {};

    // arrivalTime is the honest record of whether somebody turned up: unlike
    // isPresent it is not rewritten by the break-duration policy.
    const worked = Boolean(calc.arrivalTime);
    const workHours = (calc.workDurationSeconds || 0) / 3600;
    const lateMinutes = worked ? calc.lateMinutes || 0 : 0;

    // A break-policy absence stays visible for HR but does not cost pay:
    // it is a flag about how the day was logged, not evidence of not working.
    const breakPolicyFlagged = Boolean(calc.isBreakPolicyAbsent);

    const detail = {
      isLate: lateMinutes > 0,
      lateMinutes,
      workHours: Math.round(workHours * 100) / 100,
      breakPolicyFlagged,
    };

    if (worked) {
      if (leaveType === "workFromHome") return { status: DAY_STATUS.WFH, ...detail };

      // Mirrors AttendanceService: >= 4 and < 4.5 hours is a half day.
      const c = this.attendanceService.CONSTANTS;
      const isHalfDay =
        leaveType === "halfDay" ||
        (workHours >= c.MIN_HALF_DAY_HOURS && workHours < c.HALF_DAY_THRESHOLD_HOURS);

      return { status: isHalfDay ? DAY_STATUS.HALF_DAY : DAY_STATUS.PRESENT, ...detail };
    }

    // Nobody punched. Approved leave explains the day; nothing else does.
    switch (leaveType) {
      case "workFromHome":
        // An approved WFH day with no punch is still an approved working
        // arrangement, so it is paid and reported separately for HR.
        return { status: DAY_STATUS.WFH, ...detail };
      case "paid":
      case "sick":
      case "maternity":
        return { status: DAY_STATUS.PAID_LEAVE, ...detail };
      case "halfDay":
        return { status: DAY_STATUS.HALF_DAY, ...detail };
      case "unpaid":
        return { status: DAY_STATUS.UNPAID_LEAVE, ...detail };
      default:
        return { status: DAY_STATUS.ABSENT, ...detail };
    }
  }

  /**
   * The month's attendance, as one canonical object.
   *
   * @param {string} userId
   * @param {string} payPeriod - "YYYY-MM"
   * @param {Object} [options]
   * @param {Date}   [options.referenceDate] - "now"; days after it are UPCOMING
   * @returns {Promise<Object>} canonical monthly summary
   */
  async getMonthlySummary(userId, payPeriod, options = {}) {
    const [year, month] = String(payPeriod).split("-").map(Number);
    if (!year || !month || month < 1 || month > 12) {
      throw new Error(`Invalid pay period "${payPeriod}", expected YYYY-MM`);
    }

    const referenceDate = options.referenceDate || new Date();
    const daysInMonth = new Date(year, month, 0).getDate();

    const monthStart = new Date(year, month - 1, 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(year, month, 0);
    monthEnd.setHours(23, 59, 59, 999);

    const [attendanceByDate, leaveByDate, holidayKeys] = await Promise.all([
      this.fetchAttendanceByDate(userId, monthStart, monthEnd),
      this.fetchLeaveByDate(userId, monthStart, monthEnd),
      this.fetchHolidayKeys(monthStart, monthEnd),
    ]);

    const counts = {
      present: 0, halfDay: 0, wfh: 0, paidLeave: 0,
      unpaidLeave: 0, absent: 0, weekend: 0, holiday: 0, upcoming: 0,
    };

    const days = [];
    let paidDays = 0;
    let lateDays = 0;
    let totalLateMinutes = 0;
    let totalWorkHours = 0;
    let breakPolicyFlaggedDays = 0;

    for (let dayOfMonth = 1; dayOfMonth <= daysInMonth; dayOfMonth++) {
      const date = new Date(year, month - 1, dayOfMonth);
      const isUpcoming = date > referenceDate && this.toDateKey(date) !== this.toDateKey(referenceDate);

      const day = this.classifyDay({ date, isUpcoming, holidayKeys, leaveByDate, attendanceByDate });
      const credit = DAY_CREDIT[day.status] ?? 0;

      counts[day.status] = (counts[day.status] || 0) + 1;
      paidDays += credit;
      totalWorkHours += day.workHours;
      if (day.isLate) {
        lateDays++;
        totalLateMinutes += day.lateMinutes;
      }
      if (day.breakPolicyFlagged) breakPolicyFlaggedDays++;

      days.push({ date: this.toDateKey(date), credit, ...day });
    }

    // Days the employee was expected to work: the month, less weekends,
    // holidays and anything that has not happened yet.
    const expectedWorkingDays =
      daysInMonth - counts.weekend - counts.holiday - counts.upcoming;
    const attendedDays = counts.present + counts.wfh + counts.halfDay * 0.5;

    const round = (n) => Math.round(n * 100) / 100;

    return {
      payPeriod,
      year,
      month,

      // Calendar
      daysInMonth,
      weekendDays: counts.weekend,
      holidayDays: counts.holiday,
      upcomingDays: counts.upcoming,
      expectedWorkingDays,

      // Attendance
      presentDays: counts.present,
      halfDays: counts.halfDay,
      wfhDays: counts.wfh,
      paidLeaveDays: counts.paidLeave,
      unpaidLeaveDays: counts.unpaidLeave,
      absentDays: counts.absent,
      lateDays,
      totalLateMinutes,
      breakPolicyFlaggedDays,
      totalWorkHours: round(totalWorkHours),

      // What payroll prorates by
      paidDays: round(paidDays),

      // Rates, for the attendance screens
      attendanceRate: expectedWorkingDays > 0 ? round((attendedDays / expectedWorkingDays) * 100) : 0,
      punctualityRate:
        counts.present + counts.wfh + counts.halfDay > 0
          ? round(((counts.present + counts.wfh + counts.halfDay - lateDays) /
              (counts.present + counts.wfh + counts.halfDay)) * 100)
          : 0,
      averageWorkHours:
        counts.present + counts.wfh + counts.halfDay > 0
          ? round(totalWorkHours / (counts.present + counts.wfh + counts.halfDay))
          : 0,

      hasPerfectAttendance:
        counts.absent === 0 && counts.unpaidLeave === 0 && counts.halfDay === 0 && lateDays === 0,

      // Per-day audit trail: why the month added up the way it did.
      days,
    };
  }
}

module.exports = new AttendanceSummaryService();
module.exports.DAY_STATUS = DAY_STATUS;
module.exports.DAY_CREDIT = DAY_CREDIT;
