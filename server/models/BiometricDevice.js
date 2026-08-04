// models/BiometricDevice.js
// Registry of physical fingerprint terminals (Identix / ZKTeco ADMS "PUSH" devices).
//
// Why this exists:
//   The ADMS protocol has no authentication of any kind. The only identity a
//   device presents is its serial number in the query string (?SN=...). This
//   collection is the allowlist: a serial that is not registered here (or is
//   registered but disabled) is rejected before any attendance is written.
//
//   It doubles as the health/monitoring record — `lastSeenAt` tells you whether
//   the machine is still talking to the server, which is the single most useful
//   signal when someone reports "my punch didn't show up".
//
// See docs/biometric-attendance-integration.md
const mongoose = require("mongoose");

const BiometricDeviceSchema = new mongoose.Schema(
  {
    // Device serial number, exactly as the terminal reports it in ?SN=
    serialNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    // Human-friendly label shown in the admin UI
    name: { type: String, trim: true, default: "" },
    location: { type: String, trim: true, default: "" },

    // Master switch. A disabled device is rejected at the door — useful when a
    // terminal is being serviced, relocated, or is suspected of sending junk.
    enabled: { type: Boolean, default: true },

    // When true, punches are recorded in BiometricPunch but NOT pushed into the
    // attendance system. Lets you watch real traffic from a new device for a day
    // before letting it affect anyone's attendance record.
    dryRun: { type: Boolean, default: false },

    // ---- Health / telemetry ----
    lastSeenAt: { type: Date, default: null }, // any request from the device
    lastPushAt: { type: Date, default: null }, // last ATTLOG payload received
    lastPunchAt: { type: Date, default: null }, // timestamp of newest punch seen
    firmware: { type: String, default: "" },
    deviceIp: { type: String, default: "" },

    // Cumulative counters (monitoring only — never used for calculations)
    stats: {
      totalPushes: { type: Number, default: 0 },
      totalPunchesReceived: { type: Number, default: 0 },
      totalPunchesApplied: { type: Number, default: 0 },
      totalPunchesDuplicate: { type: Number, default: 0 },
      totalPunchesUnmapped: { type: Number, default: 0 },
      totalPunchesFailed: { type: Number, default: 0 },

      // Estimated device clock error, measured on realtime pushes: the device
      // pushes each punch within seconds of the finger touching the sensor
      // (Realtime=1), so received-time minus punch-time ≈ how far off the
      // device clock is. Positive = clock runs behind (punch times too early).
      // A mis-set clock silently corrupts every arrival time it stamps — this
      // is how the "punched at 5:00, shows 4:30" class of bug becomes a
      // visible number instead of a payroll dispute weeks later.
      lastClockSkewSeconds: { type: Number, default: null },
      lastClockSkewAt: { type: Date, default: null },
    },

    // Raw options string reported by the device on handshake, kept verbatim for
    // troubleshooting firmware quirks.
    lastHandshakeRaw: { type: String, default: "" },

    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

BiometricDeviceSchema.index({ enabled: 1, lastSeenAt: -1 });

/**
 * Find an enabled device by serial, or null.
 * @param {String} serialNumber
 */
BiometricDeviceSchema.statics.findEnabled = function (serialNumber) {
  if (!serialNumber) return Promise.resolve(null);
  return this.findOne({
    serialNumber: String(serialNumber).trim().toUpperCase(),
    enabled: true,
  });
};

/**
 * Mark the device as alive. Uses an unawaited-safe atomic update so telemetry
 * can never block or fail an attendance push.
 */
BiometricDeviceSchema.statics.touch = function (serialNumber, patch = {}) {
  if (!serialNumber) return Promise.resolve(null);
  return this.updateOne(
    { serialNumber: String(serialNumber).trim().toUpperCase() },
    { $set: { lastSeenAt: new Date(), ...patch } }
  ).catch((err) => {
    console.warn("⚠️  BiometricDevice.touch failed:", err.message);
    return null;
  });
};

module.exports = mongoose.model("BiometricDevice", BiometricDeviceSchema);
