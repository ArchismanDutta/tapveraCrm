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
    // Minutes to ADD to every punch this device reports, to compensate for a
    // clock we cannot fix at the source.
    //
    // Some firmware mishandles the handshake TimeZone value and rebases its
    // clock to the wrong offset — for IST that lands it 30 minutes slow, so a
    // 05:00 arrival is stamped 04:30 by the device itself before we ever see
    // it. Where the device can't be corrected, this brings attendance back to
    // reality.
    //
    // null = fall back to BIOMETRIC_CLOCK_OFFSET_MINUTES (global default).
    //
    // ⚠️  This is a correction for a BROKEN clock. If the device clock is ever
    // fixed, set this back to 0 — otherwise punches land 30 minutes LATE
    // instead, which is the same bug pointing the other way and far harder to
    // notice. The skew watchdog in BiometricAttendanceService warns when the
    // offset stops matching reality.
    clockOffsetMinutes: { type: Number, default: null },

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
 *
 * ─── Throttling ──────────────────────────────────────────────────────────────
 * A BARE touch(serial) — no patch — only writes `lastSeenAt`, and the command
 * poll calls it on every request. At a 10s poll that was ~8,640 writes per
 * device per day to store a timestamp whose only consumer is a
 * "last seen N minutes ago" label in the admin UI.
 *
 * So bare calls are throttled: at most one write per TOUCH_THROTTLE_MS. The
 * skipped calls still resolve, so callers that `await` them behave identically.
 *
 * A touch WITH a patch (the handshake, which records deviceIp / firmware /
 * lastHandshakeRaw) is NEVER throttled — that data is not a heartbeat and
 * dropping it would lose real information.
 */
const TOUCH_THROTTLE_MS = (() => {
  const raw = Number(process.env.BIOMETRIC_TOUCH_THROTTLE_SECONDS);
  if (!Number.isFinite(raw) || raw < 0) return 5 * 60 * 1000;
  return Math.min(3600, raw) * 1000;
})();

/** serial -> epoch ms of the last lastSeenAt write we actually issued. */
const lastTouchAt = new Map();

BiometricDeviceSchema.statics.touch = function (serialNumber, patch = {}) {
  if (!serialNumber) return Promise.resolve(null);

  const serial = String(serialNumber).trim().toUpperCase();
  const hasPatch = patch && Object.keys(patch).length > 0;

  if (!hasPatch && TOUCH_THROTTLE_MS > 0) {
    const previous = lastTouchAt.get(serial);
    if (previous !== undefined && Date.now() - previous < TOUCH_THROTTLE_MS) {
      return Promise.resolve(null); // heartbeat already fresh enough
    }
    lastTouchAt.set(serial, Date.now());
  }

  return this.updateOne(
    { serialNumber: serial },
    { $set: { lastSeenAt: new Date(), ...patch } }
  ).catch((err) => {
    // Let the next call retry rather than sitting out the whole throttle window
    // on the back of a write that never landed.
    lastTouchAt.delete(serial);
    console.warn("⚠️  BiometricDevice.touch failed:", err.message);
    return null;
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// HOT-PATH LOOKUP CACHE
// ─────────────────────────────────────────────────────────────────────────────
// Every single ADMS request — including the command poll, which is pure
// overhead — resolves ?SN= to a device document before it can do anything.
// That is one findOne per request against a collection that changes when an
// admin edits a device, i.e. roughly never.
//
// findEnabledCached memoises it briefly. Deliberately a SEPARATE static rather
// than a change to findEnabled: findEnabled keeps its exact previous
// semantics, so nothing outside the ADMS hot path is affected by any of this.
//
// Correctness notes, in order of how much they would hurt if wrong:
//
//   • The cached document carries `dryRun` and `enabled`. A stale copy would
//     mean an admin disabling a device, or putting it back into dry-run, does
//     not take effect until the entry expires — a device could keep writing
//     real attendance after being told to stop. That is why every mutation
//     path calls invalidateCache() (see routes/biometricAdminRoutes.js), which
//     makes admin changes take effect on the very next request. The TTL is the
//     backstop for writes made outside the app (mongosh, another process), not
//     the primary mechanism.
//
//   • Only positive hits are cached. Caching "unknown serial" would make a
//     newly registered device invisible until the entry expired.
//
//   • Cached per process. With multiple pm2 instances each keeps its own copy;
//     invalidateCache only clears the instance that served the admin request,
//     so the TTL is what bounds the others.
//
// The TTL MUST comfortably exceed the poll interval or the cache does nothing:
// entries would expire in step with the requests meant to hit them. At the
// default 60s poll, 300s means one read per five polls instead of one per one.
// If you lower BIOMETRIC_POLL_DELAY_SECONDS, this stays fine; if you raise it
// past ~5 min, raise this too or accept a miss on every poll.
const DEVICE_CACHE_TTL_MS = (() => {
  const raw = Number(process.env.BIOMETRIC_DEVICE_CACHE_SECONDS);
  if (!Number.isFinite(raw) || raw < 0) return 5 * 60 * 1000;
  return Math.min(3600, raw) * 1000;
})();

/** serial -> { doc, expiresAt } */
const deviceCache = new Map();

/**
 * Cached variant of findEnabled for the ADMS request path.
 * Set BIOMETRIC_DEVICE_CACHE_SECONDS=0 to bypass entirely.
 * @param {String} serialNumber
 */
BiometricDeviceSchema.statics.findEnabledCached = async function (serialNumber) {
  if (!serialNumber) return null;
  const serial = String(serialNumber).trim().toUpperCase();

  if (DEVICE_CACHE_TTL_MS <= 0) return this.findEnabled(serial);

  const hit = deviceCache.get(serial);
  if (hit && hit.expiresAt > Date.now()) return hit.doc;

  const doc = await this.findEnabled(serial);
  if (doc) {
    deviceCache.set(serial, { doc, expiresAt: Date.now() + DEVICE_CACHE_TTL_MS });
  } else {
    // Negative results are not cached, but a previously cached positive must go
    // — this is the "admin just disabled it" path.
    deviceCache.delete(serial);
  }
  return doc;
};

/**
 * Drop cached state for a serial (or all serials when called with no argument).
 * Call after ANY write that changes a device's identity, enabled flag or
 * dryRun flag.
 * @param {String} [serialNumber]
 */
BiometricDeviceSchema.statics.invalidateCache = function (serialNumber) {
  if (!serialNumber) {
    deviceCache.clear();
    lastTouchAt.clear();
    return;
  }
  const serial = String(serialNumber).trim().toUpperCase();
  deviceCache.delete(serial);
  lastTouchAt.delete(serial);
};

module.exports = mongoose.model("BiometricDevice", BiometricDeviceSchema);
