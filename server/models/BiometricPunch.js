// models/BiometricPunch.js
// Raw, append-only log of every punch record received from a fingerprint device.
//
// Why store the raw punch separately instead of writing straight into
// AttendanceRecord:
//
//  1. IDEMPOTENCY. ADMS devices re-send batches. If the network drops mid-push,
//     or the device is power-cycled, the same rows arrive again. The unique
//     index below makes a re-send a no-op at the database level rather than a
//     duplicate punch in someone's timesheet.
//
//  2. RECOVERY. If a PIN wasn't mapped yet, or the shift config was wrong, the
//     punch is still captured here with status UNMAPPED/FAILED and can be
//     replayed later — the data is never lost just because the CRM wasn't ready.
//
//  3. AUDIT. Payroll disputes get resolved against exactly what the hardware
//     sent, not against our interpretation of it.
//
// See docs/biometric-attendance-integration.md
const mongoose = require("mongoose");

const BiometricPunchSchema = new mongoose.Schema(
  {
    // ---- Identity as reported by the hardware ----
    serialNumber: { type: String, required: true, trim: true, uppercase: true, index: true },
    pin: { type: String, required: true, trim: true, index: true },

    // Actual moment the finger touched the sensor (device clock, converted to UTC).
    // NOT the time we received it — a device pushing a backlog after an outage
    // sends punches hours or days old.
    punchedAt: { type: Date, required: true, index: true },

    // Raw ADMS fields, kept verbatim
    rawStatus: { type: String, default: "" }, // check type: 0=in, 1=out, 2/3=break, 4/5=OT
    rawVerify: { type: String, default: "" }, // 1=fingerprint, 3=password, 4=card...
    rawWorkCode: { type: String, default: "" },
    rawLine: { type: String, default: "" }, // the original tab-separated line

    // ---- Resolution against the CRM ----
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // What we decided this punch means in attendance terms
    resolvedAction: {
      type: String,
      enum: ["PUNCH_IN", "PUNCH_OUT", "BREAK_START", "BREAK_END", null],
      default: null,
    },

    status: {
      type: String,
      enum: [
        "PENDING", // received, not yet processed
        "APPLIED", // successfully written into AttendanceRecord
        "DUPLICATE", // identical punch already applied (device re-send / double scan)
        "UNMAPPED", // no user has this biometricPin
        "SKIPPED", // deliberately not applied (business rule, e.g. already punched out)
        "FAILED", // processing threw — safe to retry
        "DRY_RUN", // device is in dryRun mode; captured but intentionally not applied
      ],
      default: "PENDING",
      index: true,
    },

    // Human-readable outcome, surfaced in the admin UI
    message: { type: String, default: "" },

    // Set when the punch is written into AttendanceRecord
    appliedAt: { type: Date, default: null },
    // The attendance date the punch was ultimately booked against (night shifts
    // mean this is not always the calendar date of punchedAt).
    attendanceDate: { type: Date, default: null },

    processingAttempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// ---- The idempotency guarantee ----
// One physical punch = one document. A device re-sending the same batch hits
// this index and is rejected as a duplicate key error, which the service treats
// as "already have it, nothing to do".
BiometricPunchSchema.index(
  { serialNumber: 1, pin: 1, punchedAt: 1, rawStatus: 1 },
  { unique: true, name: "uniq_device_punch" }
);

// Admin views: newest first, and "what still needs attention"
BiometricPunchSchema.index({ createdAt: -1 });
BiometricPunchSchema.index({ status: 1, createdAt: -1 });
BiometricPunchSchema.index({ userId: 1, punchedAt: -1 });

module.exports = mongoose.model("BiometricPunch", BiometricPunchSchema);
