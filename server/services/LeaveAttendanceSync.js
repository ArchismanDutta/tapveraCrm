// services/LeaveAttendanceSync.js
//
// Puts an approved leave onto the attendance days it covers.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS EXISTS
//
// Approving a leave used to write to LeaveRequest and nowhere else. The
// approval handler never touched an attendance record — not on approval, not
// afterwards. Leave reached a day exactly once, inside
// AttendanceService.createEmployeeRecord, which runs on the employee's FIRST
// PUNCH of that day. So:
//
//   - somebody on approved leave does not punch, no record is created, and
//     every attendance screen reads the day as an unexplained absence;
//   - a leave approved after the day has passed — the normal case for sick
//     leave — is never stamped at all, even if they did punch.
//
// The monthly summary survives this because it re-queries LeaveRequest itself,
// which is why payroll stayed right while the screens were wrong. This service
// closes the gap for everything that reads the day record directly.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT IT DELIBERATELY DOES NOT DO
//
// It does not stamp days in the future. Nothing reads them yet, an approved
// leave for next month would materialise a month of empty records, and the day
// gets stamped correctly anyway the moment it arrives — either by
// createEmployeeRecord if the employee punches, or by the summary if they
// don't.
//
// It only clears a stamp it can prove it owns (leaveInfo.sourceRequestId). The
// manual attendance screen writes the same flags and creates no request, so
// blanking leaveInfo on un-approval would silently undo an HR correction.

"use strict";

const AttendanceRecord = require("../models/AttendanceRecord");
const AttendanceService = require("./AttendanceService");

const attendanceService = new AttendanceService();

// A guard, not a policy. Long leave is legitimate (maternity runs months), but
// each day is a separate document save, so an unbounded loop inside a request
// handler is how an approval click turns into a timeout. Anything past this is
// left to the summary, which reads LeaveRequest directly and is already right.
const MAX_DAYS_PER_SYNC = 120;

/**
 * The leaveInfo flags an approved request of this type implies.
 * Mirrors AttendanceService.getLeaveInfo so a stamped day and a punched day
 * can never disagree about what the same request means.
 */
function leaveInfoForType(type) {
  const base = {
    isOnLeave: false,
    isWFH: false,
    isPaidLeave: false,
    isHalfDayLeave: false,
    leaveType: type || null,
  };

  switch (type) {
    case "workFromHome":
      // Not leave: a working arrangement. The employee is still expected to work.
      return { ...base, isWFH: true };
    case "halfDay":
      // Not leave either: reduced hours, still working.
      return { ...base, isHalfDayLeave: true };
    case "paid":
    case "sick":
    case "maternity":
      return { ...base, isOnLeave: true, isPaidLeave: true };
    default:
      // unpaid, and anything added to the schema later
      return { ...base, isOnLeave: true };
  }
}

/** Every calendar day the period covers, up to and including today, capped. */
function daysToSync(periodStart, periodEnd, now = new Date()) {
  const today = attendanceService.normalizeDate(now);
  const start = attendanceService.normalizeDate(periodStart);
  const end = attendanceService.normalizeDate(periodEnd);
  const last = end < today ? end : today;

  const days = [];
  for (let d = new Date(start); d <= last && days.length < MAX_DAYS_PER_SYNC; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  return days;
}

/**
 * Write one employee's leaveInfo onto one day, creating the day's row for them
 * if they have none. Returns true if anything changed.
 */
async function stampDay(userId, date, leaveInfo, requestId) {
  const record = await attendanceService.getAttendanceRecord(date);

  let employee = record.getEmployee(userId);
  if (!employee) {
    // No punch that day. Build the same row a punch would have built, minus the
    // punch — that is what makes the day readable as leave rather than as a day
    // nobody has heard of.
    const employeeData = await attendanceService.createEmployeeRecord(userId, date);
    employee = record.upsertEmployee(employeeData);
  }

  const existing = employee.leaveInfo
    ? (typeof employee.leaveInfo.toObject === "function" ? employee.leaveInfo.toObject() : employee.leaveInfo)
    : {};

  employee.leaveInfo = { ...existing, ...leaveInfo, sourceRequestId: requestId };

  // Re-derive with the stamp in place: isPresent, the break policy and the
  // day's aggregate counts all read leaveInfo.
  attendanceService.recalculateEmployeeData(employee, date);
  attendanceService.updateDailyStats(record);
  await record.save();

  return true;
}

/** Remove a stamp this request left behind. Leaves HR's own edits alone. */
async function unstampDay(userId, date, requestId) {
  const { start, end } = attendanceService.getDayWindow(date);
  const record = await AttendanceRecord.findOne({ date: { $gte: start, $lt: end } });
  if (!record) return false;

  const employee = record.getEmployee(userId);
  if (!employee) return false;

  const stampedBy = employee.leaveInfo && employee.leaveInfo.sourceRequestId;
  if (!stampedBy || String(stampedBy) !== String(requestId)) return false;

  employee.leaveInfo = {
    isOnLeave: false,
    isWFH: false,
    isPaidLeave: false,
    isHalfDayLeave: false,
    leaveType: null,
    // A holiday is a property of the calendar, not of this request.
    isHoliday: employee.leaveInfo.isHoliday,
    holidayName: employee.leaveInfo.holidayName,
    sourceRequestId: null,
  };

  attendanceService.recalculateEmployeeData(employee, date);
  attendanceService.updateDailyStats(record);
  await record.save();

  return true;
}

/**
 * Bring the attendance records for a leave request in line with its status.
 *
 *   Approved      -> stamp every covered day up to today
 *   anything else -> clear the days this request stamped
 *
 * Never throws: a leave decision must not fail because an attendance row could
 * not be written. Returns a summary so the caller can log it.
 *
 * @param {Object} leaveRequest - a saved LeaveRequest document
 * @returns {Promise<{synced: number, cleared: number, failed: number, capped: boolean}>}
 */
async function syncLeaveToAttendance(leaveRequest) {
  const result = { synced: 0, cleared: 0, failed: 0, capped: false };

  const userId = leaveRequest && leaveRequest.employee && leaveRequest.employee._id;
  const start = leaveRequest && leaveRequest.period && leaveRequest.period.start;
  const end = leaveRequest && leaveRequest.period && leaveRequest.period.end;
  if (!userId || !start || !end) return result;

  const days = daysToSync(start, end);
  result.capped = days.length >= MAX_DAYS_PER_SYNC;

  const approved = leaveRequest.status === "Approved";
  const leaveInfo = approved ? leaveInfoForType(leaveRequest.type) : null;

  for (const day of days) {
    try {
      if (approved) {
        if (await stampDay(userId, day, leaveInfo, leaveRequest._id)) result.synced++;
      } else {
        if (await unstampDay(userId, day, leaveRequest._id)) result.cleared++;
      }
    } catch (err) {
      result.failed++;
      console.error(
        `⚠️  Leave sync failed for ${userId} on ${attendanceService.formatDateKey(day)}: ${err.message}`
      );
    }
  }

  return result;
}

module.exports = { syncLeaveToAttendance, leaveInfoForType, daysToSync, MAX_DAYS_PER_SYNC };
