// services/biometric/BiometricAttendanceService.js
//
// Bridges the fingerprint terminal to the existing date-centric attendance
// system. This is the only file that knows how a raw device row becomes a real
// attendance event.
//
// ─────────────────────────────────────────────────────────────────────────────
// DESIGN RULES
// ─────────────────────────────────────────────────────────────────────────────
//
// 1. NEVER WRITE ATTENDANCE DIRECTLY.
//    Everything goes through AttendanceService.recordPunchEvent so that shift
//    resolution, night-shift date assignment, late calculation, leave handling,
//    daily stats and the transaction wrapper all behave identically whether a
//    punch came from the machine, the app, or an admin correction. One source of
//    truth, one calculation path.
//
// 2. NEVER THROW AT THE DEVICE.
//    The terminal has no error handling worth the name — anything other than a
//    plain "OK" makes it re-send the same batch indefinitely. Every failure is
//    caught, recorded against the punch row, and reported as a per-record status
//    so the batch as a whole still succeeds.
//
// 3. EVERY PUNCH IS PERSISTED BEFORE IT IS INTERPRETED.
//    The raw row is written to BiometricPunch first. If our interpretation is
//    later found to be wrong (bad PIN mapping, wrong shift), the original data
//    is still there to replay. Nothing is lost to a logic bug.
//
// 4. THE TERMINAL OPENS A DAY; IT NEVER CLOSES ONE.
//    The first scan of an attendance day becomes PUNCH_IN. Every later scan is
//    stored as LOGGED presence evidence and produces no attendance event. The
//    day is closed by the employee pressing Punch Out in the CRM, or by the
//    auto-close job booking their last scan as the departure. See
//    resolveAction() for why, and services/AttendanceAutoCloseService.js for the
//    safety net.
//
// See docs/biometric-attendance-integration.md
"use strict";

const mongoose = require("mongoose");
const User = require("../../models/User");
const BiometricPunch = require("../../models/BiometricPunch");
const BiometricDevice = require("../../models/BiometricDevice");
const AttendanceService = require("../AttendanceService");
const AttendanceRecord = require("../../models/AttendanceRecord");

// ---- Configuration (env-overridable, safe defaults) ----

// Timezone the physical device clock is set to.
const DEVICE_TIMEZONE = process.env.BIOMETRIC_DEVICE_TIMEZONE || "Asia/Kolkata";

// Two scans closer together than this are treated as one punch. Fingerprint
// readers routinely register twice when a finger rolls slightly, and staff
// re-scan when they don't hear the beep. Without this, the second scan would be
// interpreted as the opposite action and immediately end the workday.
const MIN_PUNCH_GAP_SECONDS = Number(process.env.BIOMETRIC_MIN_PUNCH_GAP_SECONDS || 90);

// How far back a device-reported punch may be and still be accepted. Generous
// because a terminal that loses connectivity buffers internally and dumps the
// whole backlog on reconnect.
const MAX_BACKFILL_HOURS = Number(process.env.BIOMETRIC_MAX_BACKFILL_HOURS || 168); // 7 days

class BiometricAttendanceService {
  constructor() {
    this.attendanceService = new AttendanceService();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // BATCH ENTRY POINT
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Process a parsed ATTLOG batch from one device.
   *
   * Records are processed sequentially and in chronological order — never in
   * parallel. Order matters: whether a punch means "in" or "out" depends on the
   * state left by the punch before it, so concurrent processing would produce
   * nondeterministic results for a backlog batch.
   *
   * @param {Object} device BiometricDevice document
   * @param {Array} records output of AdmsParser.parseAttlog().records
   * @returns {Promise<Object>} summary counts + per-record results
   */
  async processAttlogBatch(device, records = []) {
    const summary = {
      received: records.length,
      applied: 0,
      logged: 0,
      duplicate: 0,
      unmapped: 0,
      skipped: 0,
      failed: 0,
      dryRun: 0,
      results: [],
    };

    // Oldest first, so state transitions replay in the order they happened.
    const ordered = [...records].sort((a, b) => a.punchedAt - b.punchedAt);

    for (const record of ordered) {
      let outcome;
      try {
        outcome = await this.processSinglePunch(device, record);
      } catch (err) {
        // Belt and braces — processSinglePunch already catches, but a bug here
        // must not cost us the remaining records in the batch.
        console.error("❌ Biometric punch processing crashed:", err);
        outcome = { status: "FAILED", message: err.message, pin: record.pin };
      }

      summary.results.push(outcome);

      switch (outcome.status) {
        case "APPLIED":
          summary.applied += 1;
          break;
        case "LOGGED":
          // Presence evidence for a day that is already open or already closed.
          // Expected and normal — most scans in a day land here — so it must not
          // be counted as a failure.
          summary.logged += 1;
          break;
        case "DUPLICATE":
          summary.duplicate += 1;
          break;
        case "UNMAPPED":
          summary.unmapped += 1;
          break;
        case "SKIPPED":
          summary.skipped += 1;
          break;
        case "DRY_RUN":
          summary.dryRun += 1;
          break;
        default:
          summary.failed += 1;
      }
    }

    await this.updateDeviceStats(device, summary, ordered);

    return summary;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SINGLE PUNCH PIPELINE
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Persist → dedupe → map → resolve → apply, for one device row.
   * Always resolves; never rejects.
   */
  async processSinglePunch(device, record) {
    // ---- STEP 1: persist the raw row (idempotent) ----
    // The unique index on (serialNumber, pin, punchedAt, rawStatus) is what makes
    // the whole integration safe to retry. A device re-sending yesterday's batch
    // hits a duplicate-key error here and stops immediately, before it can touch
    // anyone's attendance.
    let punchDoc;
    try {
      punchDoc = await BiometricPunch.create({
        serialNumber: device.serialNumber,
        pin: record.pin,
        punchedAt: record.punchedAt,
        rawStatus: record.rawStatus,
        rawVerify: record.rawVerify,
        rawWorkCode: record.rawWorkCode,
        rawLine: record.rawLine,
        status: "PENDING",
      });
    } catch (err) {
      if (err && err.code === 11000) {
        return {
          status: "DUPLICATE",
          pin: record.pin,
          punchedAt: record.punchedAt,
          message: "Already received this punch (device re-send)",
        };
      }
      throw err;
    }

    try {
      // ---- STEP 2: map PIN → CRM user ----
      const user = await User.findOne({
        biometricPin: String(record.pin).trim(),
      }).select("_id name employeeId status");

      if (!user) {
        return this.finalise(punchDoc, {
          status: "UNMAPPED",
          message: `No employee is mapped to device PIN ${record.pin}`,
        });
      }

      // An ex-employee whose finger is still enrolled on the device must not
      // generate attendance. Their punch is kept for the audit trail.
      if (user.status && user.status !== "active") {
        return this.finalise(punchDoc, {
          status: "SKIPPED",
          userId: user._id,
          message: `Employee ${user.employeeId} is ${user.status}; punch recorded but not applied`,
        });
      }

      punchDoc.userId = user._id;

      // ---- STEP 3: collapse rapid re-scans ----
      const recentDuplicate = await this.findRecentAppliedPunch(user._id, record.punchedAt);
      if (recentDuplicate) {
        const gap = Math.round((record.punchedAt - recentDuplicate.punchedAt) / 1000);
        return this.finalise(punchDoc, {
          status: "DUPLICATE",
          userId: user._id,
          message: `Re-scan ${gap}s after previous punch (min gap ${MIN_PUNCH_GAP_SECONDS}s)`,
        });
      }

      // ---- STEP 4: decide what this punch means ----
      const decision = await this.resolveAction(user._id, record);

      if (!decision.action) {
        // Not an error and not a rejection — the day is already open (or already
        // closed) and this scan is simply part of the raw trail. It is booked
        // against the attendance date it belongs to so the auto-close job can
        // find it later as a candidate departure time.
        return this.finalise(punchDoc, {
          status: "LOGGED",
          userId: user._id,
          attendanceDate: decision.attendanceDate,
          message: decision.reason,
        });
      }

      // ---- STEP 5: dry-run guard ----
      // Lets a newly installed device run against live traffic for a day
      // without touching anybody's real attendance.
      if (device.dryRun) {
        return this.finalise(punchDoc, {
          status: "DRY_RUN",
          userId: user._id,
          resolvedAction: decision.action,
          message: `Device in dry-run — would have recorded ${decision.action}`,
        });
      }

      // ---- STEP 6: hand off to the existing attendance engine ----
      const result = await this.attendanceService.recordPunchEvent(user._id, decision.action, {
        // The moment the finger touched the sensor, not the moment we got it.
        timestamp: record.punchedAt,
        location: device.location || "Office",
        device: `BIOMETRIC:${device.serialNumber}`,
        source: "BIOMETRIC",
        // Hardware reports what already happened. We cannot reject an early
        // arrival, only record it and let the shift rules judge it.
        allowEarlyPunch: true,
        // Accept backlogged punches from a device that was offline.
        maxPastHours: MAX_BACKFILL_HOURS,
        // `manual` stays false: this is an automated capture, not a
        // human-entered correction, and the distinction matters for auditing.
        manual: false,
        notes: `Fingerprint punch · PIN ${record.pin} · ${record.statusLabel}/${record.verifyLabel}`,
      });

      this.broadcast(user._id, decision.action, device);

      return this.finalise(punchDoc, {
        status: "APPLIED",
        userId: user._id,
        resolvedAction: decision.action,
        attendanceDate: result.date,
        message: result.message,
      });
    } catch (err) {
      // Business-rule rejections from validatePunchEvent ("already punched
      // out", "not punched in yet") are expected outcomes for a device that
      // doesn't know our state machine — they're SKIPPED, not FAILED, so they
      // don't pollute the error dashboard and don't get retried pointlessly.
      const isBusinessRule = /already|not punched in|not on break|must be working|Duplicate punch/i.test(
        err.message || ""
      );

      return this.finalise(punchDoc, {
        status: isBusinessRule ? "SKIPPED" : "FAILED",
        userId: punchDoc.userId,
        message: err.message,
      });
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ACTION RESOLUTION
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Decide what a device punch means.
   *
   * ─── THE TERMINAL OPENS THE DAY. IT NEVER CLOSES IT. ───
   *
   * Only the FIRST scan of an attendance day produces an attendance event
   * (PUNCH_IN). Every subsequent scan that day is recorded raw and produces no
   * event at all. The day is closed exactly one way: the employee presses Punch
   * Out in the CRM — or, if they forget, the auto-close job books their last
   * scan of the day as the departure (see services/AttendanceAutoCloseService).
   *
   * Why not infer PUNCH_OUT from a second scan (the previous behaviour):
   * people leave and re-enter the building repeatedly during a normal day —
   * lunch, a bank run, seeing a client to the door — and the terminal sits at
   * that door. Treating the next scan as a departure ended the workday at
   * whatever time someone stepped out for tea, and the scan on the way back in
   * opened a fresh session, fragmenting one day into several. Inferring nothing
   * is both simpler and closer to what the hardware actually tells us: that this
   * person was physically present at this moment.
   *
   * The device's own Status column is still ignored. It reflects which mode key
   * was pressed before scanning, almost nobody presses it, so it is
   * overwhelmingly 0 regardless of intent. It remains stored for audit.
   *
   * Breaks are likewise not derived here — break tracking stays in the app,
   * where the employee explicitly chooses it.
   *
   * @returns {Promise<{action: String|null, reason: String, attendanceDate: Date|null}>}
   */
  async resolveAction(userId, record) {
    const { status, attendanceDate } = await this.getDayState(userId, record.punchedAt);

    if (status === "NOT_STARTED") {
      // Nothing recorded yet for this attendance day → this is their arrival.
      return {
        action: "PUNCH_IN",
        reason: "First scan of the attendance day — arrival",
        attendanceDate,
      };
    }

    // The day is already open (WORKING / ON_BREAK) or already closed
    // (FINISHED). Either way the scan changes nothing about their attendance
    // state; it is kept as presence evidence and as a candidate departure time.
    const reason =
      status === "FINISHED"
        ? "Already punched out in the CRM — scan logged, day stays closed"
        : "Day already open — scan logged; day is closed from the CRM";

    return { action: null, reason, attendanceDate };
  }

  /**
   * Read the employee's attendance state for the day this punch belongs to,
   * along with the attendance date itself.
   *
   * Uses the same shift-aware date resolution as recordPunchEvent, because for a
   * night shift a 01:00 punch belongs to the previous day's record — reading
   * today's record instead would show NOT_STARTED and wrongly produce a second
   * punch-in at 1am.
   */
  async getDayState(userId, punchedAt) {
    try {
      const shift = await this.attendanceService.getUserShift(userId, punchedAt);
      const attendanceDate = this.attendanceService.getAttendanceDateForPunch(punchedAt, shift);

      const record = await AttendanceRecord.findOne({ date: attendanceDate })
        .select("employees.userId employees.calculated.currentStatus")
        .lean();

      if (!record) return { status: "NOT_STARTED", attendanceDate };

      const employee = (record.employees || []).find(
        (e) => String(e.userId) === String(userId)
      );

      return {
        status: employee?.calculated?.currentStatus || "NOT_STARTED",
        attendanceDate,
      };
    } catch (err) {
      // Deliberately rethrown rather than defaulted. Guessing NOT_STARTED here
      // would open a brand new work session for someone who may already be
      // FINISHED for the day; guessing WORKING would silently discard a real
      // arrival. Letting it fail marks the row FAILED, which surfaces it in the
      // admin error view and makes it eligible for the default replayPunches
      // sweep — so the punch is recovered rather than misinterpreted.
      console.error("❌ Could not resolve attendance state for punch:", err.message);
      throw new Error(`Attendance state lookup failed: ${err.message}`);
    }
  }

  /**
   * Look for an already-applied punch within the re-scan window.
   * Deliberately checks APPLIED only — a previously skipped or unmapped punch
   * shouldn't suppress a real one.
   */
  async findRecentAppliedPunch(userId, punchedAt) {
    const windowStart = new Date(punchedAt.getTime() - MIN_PUNCH_GAP_SECONDS * 1000);

    return BiometricPunch.findOne({
      userId,
      status: "APPLIED",
      punchedAt: { $gte: windowStart, $lt: punchedAt },
    })
      .sort({ punchedAt: -1 })
      .lean();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Write the outcome back onto the raw punch row and return it as a result.
   * Persistence failures here are logged but never propagated — the attendance
   * write has already happened and must not be undone by an audit-log problem.
   */
  async finalise(punchDoc, outcome) {
    try {
      punchDoc.status = outcome.status;
      punchDoc.message = outcome.message || "";
      punchDoc.processingAttempts = (punchDoc.processingAttempts || 0) + 1;

      if (outcome.userId) punchDoc.userId = outcome.userId;
      if (outcome.resolvedAction) punchDoc.resolvedAction = outcome.resolvedAction;
      if (outcome.attendanceDate) punchDoc.attendanceDate = outcome.attendanceDate;
      if (outcome.status === "APPLIED") punchDoc.appliedAt = new Date();

      await punchDoc.save();
    } catch (err) {
      console.error("⚠️  Failed to persist biometric punch outcome:", err.message);
    }

    return {
      status: outcome.status,
      pin: punchDoc.pin,
      punchedAt: punchDoc.punchedAt,
      userId: outcome.userId || null,
      action: outcome.resolvedAction || null,
      message: outcome.message || "",
    };
  }

  /**
   * Nudge connected clients so the attendance UI updates live, exactly as the
   * in-app punch path does. Best-effort: a socket problem must never fail a
   * hardware push.
   */
  broadcast(userId, action, device) {
    try {
      const { broadcastAttendanceUpdated } = require("../../utils/websocket");
      broadcastAttendanceUpdated(userId, {
        action,
        source: "BIOMETRIC",
        device: device.serialNumber,
      });
    } catch (err) {
      console.warn("WebSocket broadcast failed (biometric punch):", err.message);
    }
  }

  /**
   * Roll batch results into the device's telemetry counters.
   */
  async updateDeviceStats(device, summary, ordered) {
    try {
      const newest = ordered.length ? ordered[ordered.length - 1].punchedAt : null;

      // ---- Clock-skew estimate ----
      // Only measurable on realtime-sized batches: with Realtime=1 the device
      // pushes each punch within seconds, so arrival lag ≈ clock error. A large
      // batch is a backlog dump after an outage, where hours of lag are
      // legitimate — measuring those would scream "skew" at a healthy clock.
      //
      // Threshold of 120s: realtime delivery plus server processing is
      // single-digit seconds in practice; the failure modes worth catching
      // (TimeZone truncated to the wrong offset = 1800s, clock never set,
      // battery-backed RTC drifting) are minutes to hours.
      let skewSeconds = null;
      if (ordered.length > 0 && ordered.length <= 3 && newest) {
        skewSeconds = Math.round((Date.now() - newest.getTime()) / 1000);

        if (Math.abs(skewSeconds) > 120) {
          const behindAhead = skewSeconds > 0 ? "behind" : "ahead";
          console.warn(
            `⚠️  [iclock] Device ${device.serialNumber} clock appears ~${Math.abs(
              Math.round(skewSeconds / 60)
            )} min ${behindAhead}: every punch it stamps is off by that much. ` +
              `Check the device clock/timezone and the handshake TimeZone value.`
          );
        }
      }

      await BiometricDevice.updateOne(
        { _id: device._id },
        {
          $set: {
            lastSeenAt: new Date(),
            lastPushAt: new Date(),
            ...(newest ? { lastPunchAt: newest } : {}),
            ...(skewSeconds !== null
              ? {
                  "stats.lastClockSkewSeconds": skewSeconds,
                  "stats.lastClockSkewAt": new Date(),
                }
              : {}),
          },
          $inc: {
            "stats.totalPushes": 1,
            "stats.totalPunchesReceived": summary.received,
            "stats.totalPunchesApplied": summary.applied,
            "stats.totalPunchesDuplicate": summary.duplicate,
            "stats.totalPunchesUnmapped": summary.unmapped,
            "stats.totalPunchesFailed": summary.failed,
          },
        }
      );
    } catch (err) {
      console.warn("⚠️  Failed to update device stats:", err.message);
    }
  }

  /**
   * Re-run processing for punches that previously failed or had no PIN mapping.
   * The normal recovery path after mapping a new employee: their punches from
   * before the mapping existed are replayed rather than lost.
   *
   * @param {Object} filter { status, since, pin, serialNumber, limit }
   */
  async replayPunches(filter = {}) {
    const query = {
      status: { $in: filter.status || ["UNMAPPED", "FAILED"] },
    };
    if (filter.since) query.punchedAt = { $gte: new Date(filter.since) };
    if (filter.pin) query.pin = String(filter.pin).trim();
    if (filter.serialNumber) query.serialNumber = String(filter.serialNumber).toUpperCase();

    const pending = await BiometricPunch.find(query)
      .sort({ punchedAt: 1 })
      .limit(Number(filter.limit) || 500);

    const summary = { examined: pending.length, applied: 0, stillUnmapped: 0, skipped: 0, failed: 0 };

    for (const punch of pending) {
      const device = await BiometricDevice.findOne({ serialNumber: punch.serialNumber });
      if (!device) {
        summary.failed += 1;
        continue;
      }

      // Delete-then-reprocess so the unique index doesn't reject the replay of
      // a punch we already hold.
      await BiometricPunch.deleteOne({ _id: punch._id });

      const outcome = await this.processSinglePunch(device, {
        pin: punch.pin,
        punchedAt: punch.punchedAt,
        rawStatus: punch.rawStatus,
        rawVerify: punch.rawVerify,
        rawWorkCode: punch.rawWorkCode,
        rawLine: punch.rawLine,
        statusLabel: "REPLAY",
        verifyLabel: "REPLAY",
      });

      if (outcome.status === "APPLIED") summary.applied += 1;
      else if (outcome.status === "UNMAPPED") summary.stillUnmapped += 1;
      else if (outcome.status === "SKIPPED" || outcome.status === "DUPLICATE") summary.skipped += 1;
      else summary.failed += 1;
    }

    return summary;
  }
}

module.exports = BiometricAttendanceService;
module.exports.DEVICE_TIMEZONE = DEVICE_TIMEZONE;
module.exports.MIN_PUNCH_GAP_SECONDS = MIN_PUNCH_GAP_SECONDS;
module.exports.MAX_BACKFILL_HOURS = MAX_BACKFILL_HOURS;
