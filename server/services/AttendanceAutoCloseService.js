// services/AttendanceAutoCloseService.js
//
// Safety net for employees who never punch out.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS EXISTS
// ─────────────────────────────────────────────────────────────────────────────
//
// The fingerprint terminal only ever OPENS an attendance day — the first scan
// becomes PUNCH_IN and every scan after that is stored as LOGGED presence
// evidence (see services/biometric/BiometricAttendanceService.js). The day is
// closed by the employee pressing Punch Out in the CRM.
//
// People forget. Without this job an unclosed day stays WORKING forever:
// departureTime is never set, currentStatus never reaches FINISHED, and the
// duration calculation keeps accruing time against `now`. Payroll and the
// half-day/absent flags then read a number that grows on its own.
//
// So: once someone is far enough past their shift end that they are obviously
// gone, book a PUNCH_OUT at THE LAST TIME WE KNOW THEY WERE PHYSICALLY PRESENT —
// their final fingerprint scan of that attendance day. That is the closest thing
// to ground truth we have, and it is exactly the rule an HR person would apply
// by hand.
//
// ─────────────────────────────────────────────────────────────────────────────
// DESIGN RULES
// ─────────────────────────────────────────────────────────────────────────────
//
// 1. NEVER INVENT TIME. The departure is a real scan timestamp wherever one
//    exists. The shift-end fallback is used only when the employee's arrival is
//    their sole scan of the day, and every such row is flagged for review rather
//    than quietly accepted.
//
// 2. NEVER CLOSE A DAY THAT MIGHT STILL BE RUNNING. Closing is gated on shift
//    end plus a grace window, computed per employee from their own assigned
//    shift, so a night-shift worker at 02:00 is left alone while a day-shift
//    worker from the same record is closed.
//
// 3. GO THROUGH recordPunchEvent LIKE EVERYONE ELSE. Same transaction, same
//    recalculation, same night-shift date handling as a real punch. This file
//    contains no attendance maths of its own.
//
// 4. ONE EMPLOYEE'S FAILURE IS THEIR OWN. Each close is independent; a bad
//    shift config on one record must not stop the other two hundred from being
//    closed.
"use strict";

const AttendanceRecord = require("../models/AttendanceRecord");
const BiometricPunch = require("../models/BiometricPunch");
const AttendanceService = require("./AttendanceService");

// How long after a shift ends we wait before assuming someone has gone home.
// Generous on purpose: closing a day early is far more damaging than closing it
// late, because it silently truncates paid hours. Overtime past this window is
// still captured — the departure comes from the last scan, not from the moment
// we decide to close.
const GRACE_HOURS = Number(process.env.ATTENDANCE_AUTOCLOSE_GRACE_HOURS || 4);

// How far back to sweep. Covers a long weekend or a server outage, so days that
// were missed while the job wasn't running still get closed.
const LOOKBACK_DAYS = Number(process.env.ATTENDANCE_AUTOCLOSE_LOOKBACK_DAYS || 7);

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

class AttendanceAutoCloseService {
  constructor() {
    this.attendanceService = new AttendanceService();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ENTRY POINT
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Close every attendance day that is still open past its shift end + grace.
   *
   * Safe to run as often as you like — an already-FINISHED employee is skipped,
   * and recordPunchEvent rejects a second PUNCH_OUT anyway, so a double run
   * cannot double-close anyone.
   *
   * @param {Object} options
   * @param {Date}   [options.now]      override "now" (tests)
   * @param {Number} [options.graceHours]
   * @param {Boolean}[options.dryRun]   compute everything, write nothing
   * @returns {Promise<Object>} summary
   */
  async closeStaleDays(options = {}) {
    const now = options.now ? new Date(options.now) : new Date();
    const graceHours = Number.isFinite(options.graceHours) ? options.graceHours : GRACE_HOURS;
    const dryRun = !!options.dryRun;

    const summary = {
      scannedRecords: 0,
      openEmployees: 0,
      closed: 0,
      closedFromScan: 0,
      closedFromShiftEnd: 0,
      stillWithinGrace: 0,
      failed: 0,
      dryRun,
      details: [],
    };

    const since = new Date(now.getTime() - LOOKBACK_DAYS * 24 * HOUR_MS);

    // Only records that actually contain an open employee are worth loading.
    const records = await AttendanceRecord.find({
      date: { $gte: this.attendanceService.normalizeDate(since) },
      "employees.calculated.currentStatus": { $in: ["WORKING", "ON_BREAK"] },
    })
      .select("date employees.userId employees.assignedShift employees.calculated")
      .lean();

    summary.scannedRecords = records.length;

    for (const record of records) {
      const open = (record.employees || []).filter((e) =>
        ["WORKING", "ON_BREAK"].includes(e?.calculated?.currentStatus)
      );

      for (const employee of open) {
        summary.openEmployees += 1;

        try {
          const outcome = await this.closeEmployeeDay(record, employee, {
            now,
            graceHours,
            dryRun,
          });

          summary.details.push(outcome);

          if (outcome.result === "CLOSED") {
            summary.closed += 1;
            if (outcome.source === "LAST_SCAN") summary.closedFromScan += 1;
            else summary.closedFromShiftEnd += 1;
          } else if (outcome.result === "WITHIN_GRACE") {
            summary.stillWithinGrace += 1;
          } else if (outcome.result === "FAILED") {
            summary.failed += 1;
          }
        } catch (err) {
          // Rule 4 — one employee's bad data must not abort the sweep.
          console.error(
            `❌ Auto-close crashed for user ${employee.userId} on ${record.date}:`,
            err.message
          );
          summary.failed += 1;
          summary.details.push({
            userId: String(employee.userId),
            date: record.date,
            result: "FAILED",
            message: err.message,
          });
        }
      }
    }

    this.logSummary(summary);
    return summary;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PER-EMPLOYEE CLOSE
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Decide whether one employee's day is closable, and close it.
   */
  async closeEmployeeDay(record, employee, { now, graceHours, dryRun }) {
    const userId = employee.userId;
    const attendanceDate = record.date;

    const shiftEnd = this.getShiftEndUTC(attendanceDate, employee.assignedShift);
    const closableAfter = new Date(shiftEnd.getTime() + graceHours * HOUR_MS);

    // Rule 2 — still plausibly at work, leave them alone.
    if (now < closableAfter) {
      return {
        userId: String(userId),
        date: attendanceDate,
        result: "WITHIN_GRACE",
        message: `Shift ends ${shiftEnd.toISOString()}; closable after ${closableAfter.toISOString()}`,
      };
    }

    const departure = await this.resolveDepartureTime(employee, attendanceDate, shiftEnd);

    if (dryRun) {
      return {
        userId: String(userId),
        date: attendanceDate,
        result: "CLOSED",
        source: departure.source,
        departureAt: departure.at,
        message: `[dry run] would punch out at ${departure.at.toISOString()} (${departure.source})`,
      };
    }

    // Rule 3 — same path as a real punch. A PUNCH_OUT from ON_BREAK is valid and
    // closes the open break as well as the work session, so no separate
    // BREAK_END is needed.
    try {
      await this.attendanceService.recordPunchEvent(userId, "PUNCH_OUT", {
        timestamp: departure.at,
        location: "Auto-close",
        device: "SYSTEM:AUTO_CLOSE",
        source: "AUTO_CLOSE",
        // The departure is by definition in the past — often hours, and after an
        // outage possibly days. The default 24h window would reject it.
        maxPastHours: LOOKBACK_DAYS * 24,
        // Not a human correction: nobody typed this in. Keeping manual=false
        // preserves the distinction admin corrections rely on for auditing.
        manual: false,
        notes: departure.note,
      });
    } catch (err) {
      // Most likely someone punched out in the CRM between our read and our
      // write. That is the good outcome, not an error.
      if (/already punched out|has not punched in/i.test(err.message || "")) {
        return {
          userId: String(userId),
          date: attendanceDate,
          result: "SKIPPED",
          message: `Closed by someone else first: ${err.message}`,
        };
      }
      throw err;
    }

    this.broadcast(userId, attendanceDate);

    return {
      userId: String(userId),
      date: attendanceDate,
      result: "CLOSED",
      source: departure.source,
      departureAt: departure.at,
      needsReview: departure.source === "SHIFT_END",
      message: departure.note,
    };
  }

  /**
   * Work out when this person actually left.
   *
   * Preference order:
   *   1. Their last fingerprint scan of the attendance day, provided it is after
   *      their arrival. This is real evidence of presence and is what the rule
   *      is meant to use.
   *   2. Their shift end time — used only when the arrival scan is the only scan
   *      of the day. Booking the departure at the arrival instead would record a
   *      zero-hour day for someone who demonstrably worked, which is worse than
   *      assuming they worked their scheduled shift. Flagged for review.
   */
  async resolveDepartureTime(employee, attendanceDate, shiftEnd) {
    const arrival = employee?.calculated?.arrivalTime
      ? new Date(employee.calculated.arrivalTime)
      : null;

    // Every scan the terminal sent for this attendance day, whatever its
    // outcome — LOGGED rows are the whole point, but an APPLIED arrival or a
    // DUPLICATE re-scan is equally valid evidence that they were standing there.
    //
    // Matched on a TIME WINDOW rather than on attendanceDate equality.
    //
    // BiometricPunch.attendanceDate and AttendanceRecord.date are normalised
    // differently and sit 5h30m apart: getAttendanceDateForPunch() returns UTC
    // midnight of the IST date, while getAttendanceRecord() re-applies
    // normalizeDate(), which uses server-local midnight. `attendanceDate` here
    // comes from the record, so joining it against the punch field matched
    // nothing — and because "no scan found" is a legitimate outcome, this
    // failed silently by always falling through to the shift-end guess.
    //
    // The window runs from the record's date to +36h, which covers a night
    // shift crossing midnight regardless of which convention either side used.
    const windowStart = new Date(new Date(attendanceDate).getTime() - 6 * HOUR_MS);
    const windowEnd = new Date(new Date(attendanceDate).getTime() + 36 * HOUR_MS);

    const lastScan = await BiometricPunch.findOne({
      userId: employee.userId,
      status: { $in: ["APPLIED", "LOGGED", "DUPLICATE"] },
      punchedAt: {
        // Never earlier than their arrival — a scan before it belongs to a
        // different day's record.
        $gt: arrival && arrival > windowStart ? arrival : windowStart,
        $lte: windowEnd,
      },
    })
      .sort({ punchedAt: -1 })
      .select("punchedAt")
      .lean();

    if (lastScan?.punchedAt) {
      return {
        at: new Date(lastScan.punchedAt),
        source: "LAST_SCAN",
        note: "Auto punch-out — employee did not punch out in the CRM; departure taken from their last fingerprint scan of the day",
      };
    }

    return {
      at: shiftEnd,
      source: "SHIFT_END",
      note: "Auto punch-out — no fingerprint scan after arrival and no CRM punch-out; departure assumed at shift end. Please verify.",
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TIME HELPERS
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * The UTC instant an attendance date's shift ends.
   *
   * `attendanceDate` is stored as UTC midnight standing for an IST calendar
   * date, so its UTC components ARE the IST y/m/d — read them with getUTC*, not
   * the local getters, or a server outside IST computes the wrong day.
   *
   * For a night shift (end hour before start hour) the shift ends on the
   * following calendar day: 20:00–05:00 booked against the 10th ends 05:00 on
   * the 11th.
   */
  getShiftEndUTC(attendanceDate, shift) {
    const date = new Date(attendanceDate);

    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();

    // No usable shift config — fall back to end of the IST day.
    if (!shift?.startTime || !shift?.endTime) {
      return new Date(Date.UTC(year, month, day, 23, 59, 0, 0) - IST_OFFSET_MS);
    }

    const [startHour] = String(shift.startTime).split(":").map(Number);
    const [endHour, endMin = 0] = String(shift.endTime).split(":").map(Number);

    const crossesMidnight = endHour < startHour;

    return new Date(
      Date.UTC(year, month, day + (crossesMidnight ? 1 : 0), endHour, endMin, 0, 0) -
        IST_OFFSET_MS
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MISC
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Push the change to any open CRM tab so the employee's own Today Status page
   * stops showing a running timer. Best-effort only.
   */
  broadcast(userId, attendanceDate) {
    try {
      const { broadcastAttendanceUpdated } = require("../utils/websocket");
      broadcastAttendanceUpdated(userId, {
        action: "PUNCH_OUT",
        source: "AUTO_CLOSE",
        date: attendanceDate,
      });
    } catch (err) {
      console.warn("WebSocket broadcast failed (auto-close):", err.message);
    }
  }

  logSummary(summary) {
    console.log(
      `🌙 Attendance auto-close${summary.dryRun ? " (dry run)" : ""}: ` +
        `${summary.openEmployees} open, ${summary.closed} closed ` +
        `(${summary.closedFromScan} from last scan, ${summary.closedFromShiftEnd} from shift end), ` +
        `${summary.stillWithinGrace} still within grace, ${summary.failed} failed`
    );

    if (summary.closedFromShiftEnd > 0) {
      console.warn(
        `⚠️  ${summary.closedFromShiftEnd} day(s) closed at shift end with no scan after arrival — these need HR review`
      );
    }
  }
}

module.exports = AttendanceAutoCloseService;
module.exports.GRACE_HOURS = GRACE_HOURS;
module.exports.LOOKBACK_DAYS = LOOKBACK_DAYS;
