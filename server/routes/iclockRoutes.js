// routes/iclockRoutes.js
//
// ADMS ("PUSH SDK") endpoints for Identix / ZKTeco fingerprint terminals.
// Mounted at /iclock — this exact path is baked into the device firmware and
// cannot be changed from the CRM side.
//
// ─────────────────────────────────────────────────────────────────────────────
// NON-NEGOTIABLE PROTOCOL RULES — violating any of these makes the integration
// fail silently (device connects, nothing arrives):
//
//  • Requests are PLAIN TEXT, not JSON. The app-wide express.json() middleware
//    ignores text/plain and leaves req.body empty, so this router installs its
//    own text parser. Some firmwares also send no Content-Type at all, or
//    application/octet-stream, hence type: () => true.
//
//  • Responses must be PLAIN TEXT. A JSON body — even a 200 with {"ok":true} —
//    is not understood. The device concludes the push failed and re-sends.
//
//  • Always answer 200 with "OK", even for data we rejected. A non-200 makes the
//    terminal retry the same batch forever, and because it retries before
//    sending anything new, one poison record blocks all future attendance.
//    Problems are recorded in BiometricPunch and surfaced in the admin UI
//    instead.
//
//  • Identity is in the QUERY STRING (?SN=...), not the body.
//
// ─────────────────────────────────────────────────────────────────────────────
// SECURITY
//
// ADMS has no authentication whatsoever. Anyone who can reach this URL can POST
// fabricated attendance. Three layers guard it:
//   1. Serial allowlist — the SN must exist and be enabled in BiometricDevice.
//   2. Optional IP allowlist — BIOMETRIC_ALLOWED_IPS (comma-separated).
//   3. Optional shared secret — BIOMETRIC_PUSH_SECRET, required as ?key= on the
//      device's server URL if the firmware allows a query string.
// Layer 1 is always on. Enable 2 and/or 3 in production.
//
// See docs/biometric-attendance-integration.md
"use strict";

const express = require("express");
const router = express.Router();

const BiometricDevice = require("../models/BiometricDevice");
const BiometricAttendanceService = require("../services/biometric/BiometricAttendanceService");
const AdmsParser = require("../services/biometric/AdmsParser");

const biometricService = new BiometricAttendanceService();

const DEVICE_TIMEZONE = process.env.BIOMETRIC_DEVICE_TIMEZONE || "Asia/Kolkata";
const PUSH_SECRET = process.env.BIOMETRIC_PUSH_SECRET || "";
const ALLOWED_IPS = (process.env.BIOMETRIC_ALLOWED_IPS || "")
  .split(",")
  .map((ip) => ip.trim())
  .filter(Boolean);

// Auto-register a device the first time it appears. Convenient during initial
// setup; turn OFF in production so an unknown terminal can't enrol itself.
const AUTO_REGISTER = String(process.env.BIOMETRIC_AUTO_REGISTER_DEVICES || "true") === "true";

// ─────────────────────────────────────────────────────────────────────────────
// BODY PARSING
// ─────────────────────────────────────────────────────────────────────────────
// type: () => true accepts whatever Content-Type the firmware sends (or none).
// body-parser skips this if an earlier parser already populated req.body, so
// mounting after the global express.json() is safe.
router.use(
  express.text({
    type: () => true,
    limit: "5mb", // a reconnecting device can dump a large backlog in one push
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────

/** Plain-text reply helper. Every response on this router goes through here. */
function sendText(res, body, statusCode = 200) {
  res.status(statusCode).type("text/plain").send(body);
}

/** Client IP, accounting for Cloudflare / reverse proxies in front of us. */
function clientIp(req) {
  return (
    req.headers["cf-connecting-ip"] ||
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.ip ||
    ""
  );
}

/** Log every device interaction — invaluable when a punch "didn't show up". */
function logRequest(req, _res, next) {
  const bodySize = req.body ? String(req.body).length : 0;
  console.log(
    `📟 [iclock] ${req.method} ${req.path} SN=${req.query.SN || "-"} ` +
      `table=${req.query.table || "-"} ip=${clientIp(req)} bytes=${bodySize}`
  );
  next();
}

/** Optional IP allowlist. */
function checkIpAllowlist(req, res, next) {
  if (!ALLOWED_IPS.length) return next();

  const ip = clientIp(req);
  const allowed = ALLOWED_IPS.some((entry) => ip === entry || ip.endsWith(entry));

  if (!allowed) {
    console.warn(`🚫 [iclock] Rejected request from non-allowlisted IP: ${ip}`);
    // Still 200 + OK: we don't want to hand an attacker a probe signal, and a
    // real device behind a changed IP shouldn't enter a retry storm.
    return sendText(res, "OK");
  }
  return next();
}

/** Optional shared secret, passed by the device as ?key=... */
function checkSecret(req, res, next) {
  if (!PUSH_SECRET) return next();

  if (req.query.key !== PUSH_SECRET) {
    console.warn(`🚫 [iclock] Rejected request with bad/missing key (SN=${req.query.SN})`);
    return sendText(res, "OK");
  }
  return next();
}

/**
 * Resolve ?SN= to a registered, enabled device. This is the primary auth gate.
 */
async function resolveDevice(req, res, next) {
  const serial = String(req.query.SN || "").trim().toUpperCase();

  if (!serial) {
    console.warn("🚫 [iclock] Request with no serial number");
    return sendText(res, "OK");
  }

  try {
    let device = await BiometricDevice.findEnabled(serial);

    if (!device && AUTO_REGISTER) {
      const existing = await BiometricDevice.findOne({ serialNumber: serial });

      if (existing) {
        // Registered but disabled — deliberately turned off by an admin.
        console.warn(`🚫 [iclock] Device ${serial} is registered but disabled`);
        return sendText(res, "OK");
      }

      // New device seen for the first time. Registered in dry-run so it can be
      // observed before it is allowed to affect anyone's attendance.
      device = await BiometricDevice.create({
        serialNumber: serial,
        name: `Auto-registered ${serial}`,
        enabled: true,
        dryRun: true,
        deviceIp: clientIp(req),
        notes:
          "Auto-registered on first contact. Review, name it, then turn dryRun off " +
          "to start writing real attendance.",
      });
      console.log(`🆕 [iclock] Auto-registered new device ${serial} (dry-run mode)`);
    }

    if (!device) {
      console.warn(`🚫 [iclock] Unknown device serial: ${serial}`);
      return sendText(res, "OK");
    }

    req.biometricDevice = device;
    return next();
  } catch (err) {
    console.error("❌ [iclock] Device resolution failed:", err.message);
    return sendText(res, "OK");
  }
}

router.use(logRequest, checkIpAllowlist, checkSecret);

// ─────────────────────────────────────────────────────────────────────────────
// 1. HANDSHAKE  —  GET /iclock/cdata?SN=...&options=all&pushver=...
// ─────────────────────────────────────────────────────────────────────────────
// The device calls this on boot and periodically. It will not push a single
// attendance record until it receives a correctly shaped config block here.
// This is the step most integrations get wrong.
router.get("/cdata", resolveDevice, async (req, res) => {
  const device = req.biometricDevice;

  try {
    await BiometricDevice.touch(device.serialNumber, {
      deviceIp: clientIp(req),
      firmware: String(req.query.pushver || req.query.DeviceType || ""),
      lastHandshakeRaw: req.originalUrl,
    });
  } catch (err) {
    console.warn("⚠️  [iclock] Handshake telemetry failed:", err.message);
  }

  const response = AdmsParser.buildHandshakeResponse(device.serialNumber, {
    // Realtime=1 asks the device to push each punch as it happens rather than
    // batching to the interval — this is what makes CRM attendance live.
    realtime: 1,
    transInterval: 1,
  });

  console.log(`🤝 [iclock] Handshake completed with ${device.serialNumber}`);
  return sendText(res, response);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. DATA PUSH  —  POST /iclock/cdata?SN=...&table=ATTLOG
// ─────────────────────────────────────────────────────────────────────────────
// The endpoint that actually matters. table= tells us what's in the body:
//   ATTLOG    attendance punches            ← the one we care about
//   OPERLOG   device operations/admin events
//   USERINFO  user records enrolled on the device
//   ATTPHOTO  capture photos (binary, ignored)
router.post("/cdata", resolveDevice, async (req, res) => {
  const device = req.biometricDevice;
  const table = String(req.query.table || "").toUpperCase();
  const body = typeof req.body === "string" ? req.body : "";

  // Non-attendance tables are acknowledged and ignored. Not acknowledging them
  // makes the device retry them ahead of real attendance data.
  if (table && table !== "ATTLOG") {
    console.log(`ℹ️  [iclock] Ignoring non-attendance table '${table}' from ${device.serialNumber}`);
    await BiometricDevice.touch(device.serialNumber);
    return sendText(res, AdmsParser.buildPushAck());
  }

  try {
    const { records, invalid } = AdmsParser.parseAttlog(body, DEVICE_TIMEZONE);

    if (invalid.length) {
      console.warn(
        `⚠️  [iclock] ${invalid.length} unparseable line(s) from ${device.serialNumber}:`,
        invalid.slice(0, 3)
      );
    }

    if (!records.length) {
      // Empty pushes are normal — the device pings with no new data.
      await BiometricDevice.touch(device.serialNumber);
      return sendText(res, AdmsParser.buildPushAck(0));
    }

    const summary = await biometricService.processAttlogBatch(device, records);

    console.log(
      `✅ [iclock] ${device.serialNumber}: received=${summary.received} ` +
        `applied=${summary.applied} duplicate=${summary.duplicate} ` +
        `unmapped=${summary.unmapped} skipped=${summary.skipped} ` +
        `failed=${summary.failed} dryRun=${summary.dryRun}`
    );

    if (summary.unmapped > 0) {
      const pins = summary.results
        .filter((r) => r.status === "UNMAPPED")
        .map((r) => r.pin);
      console.warn(
        `⚠️  [iclock] Unmapped device PIN(s): ${[...new Set(pins)].join(", ")} — ` +
          `map them under Admin → Biometric Devices to recover these punches.`
      );
    }

    // Acknowledge the count we accepted. Critically this is still an ACK even
    // when some records were skipped: the device has done its job by delivering
    // them, and asking it to re-send won't change the outcome.
    return sendText(res, AdmsParser.buildPushAck(summary.received));
  } catch (err) {
    // Even a total failure gets an OK. The alternative is an infinite retry
    // loop that blocks every subsequent punch from reaching us.
    console.error(`❌ [iclock] Push processing failed for ${device.serialNumber}:`, err);
    return sendText(res, AdmsParser.buildPushAck());
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. COMMAND POLL  —  GET /iclock/getrequest?SN=...
// ─────────────────────────────────────────────────────────────────────────────
// The device asks "anything for me?" on the Delay interval. Replying "OK" means
// no pending commands. This endpoint MUST exist and MUST return 200 — a device
// that gets 404s here treats the server as unhealthy and can stop pushing.
//
// Future use: return commands here to push users to the device, force a clock
// sync, or trigger a full log re-upload.
router.get("/getrequest", resolveDevice, async (req, res) => {
  await BiometricDevice.touch(req.biometricDevice.serialNumber);
  return sendText(res, "OK");
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. COMMAND ACK  —  POST /iclock/devicecmd?SN=...
// ─────────────────────────────────────────────────────────────────────────────
// The device reports the result of a command it was given. Nothing to do while
// we don't issue commands, but the endpoint must answer 200.
router.post("/devicecmd", resolveDevice, async (req, res) => {
  console.log(`📩 [iclock] devicecmd ack from ${req.biometricDevice.serialNumber}: ${req.body}`);
  await BiometricDevice.touch(req.biometricDevice.serialNumber);
  return sendText(res, "OK");
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. MISC FIRMWARE ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────
// Different firmware revisions ping these. They're harmless, but a 404 can make
// a device decide the server is down, so they're answered explicitly.

router.all("/ping", (_req, res) => sendText(res, "OK"));
router.all("/registry", (_req, res) => sendText(res, "OK"));
router.all("/push", (_req, res) => sendText(res, "OK"));
router.get("/fdata", resolveDevice, (_req, res) => sendText(res, "OK"));
router.post("/fdata", resolveDevice, (_req, res) => sendText(res, "OK"));
router.post("/querydata", resolveDevice, (_req, res) => sendText(res, "OK"));
router.post("/edata", resolveDevice, (_req, res) => sendText(res, "OK"));

// Catch-all: any /iclock/* path we haven't explicitly implemented still gets a
// clean 200 OK rather than the JSON error handler, which a device cannot parse.
router.all("*", (req, res) => {
  console.warn(`❓ [iclock] Unhandled path ${req.method} ${req.originalUrl}`);
  return sendText(res, "OK");
});

// ─────────────────────────────────────────────────────────────────────────────
// ERROR HANDLER (must be last, and must have 4 args to be recognised by Express)
// ─────────────────────────────────────────────────────────────────────────────
// Keeps device traffic away from the app-wide JSON error handler in app.js.
// A 500 with a JSON body would be unparseable to the terminal and would trigger
// an endless retry of the same batch, blocking all subsequent attendance.
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, _next) => {
  console.error(`❌ [iclock] Unhandled error on ${req.method} ${req.originalUrl}:`, err);
  return sendText(res, "OK");
});

module.exports = router;
