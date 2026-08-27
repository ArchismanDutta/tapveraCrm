// routes/biometricAdminRoutes.js
//
// Admin-facing API for the fingerprint integration. Everything here is
// authenticated and role-gated — unlike /iclock, which the hardware reaches
// unauthenticated.
//
// Covers the three things an admin actually needs:
//   1. Map employees to their device PIN (nothing works until this is done)
//   2. See what the device sent and why a punch did or didn't apply
//   3. Confirm the terminal is still alive
//
// Mounted at /api/biometric.
// See docs/biometric-attendance-integration.md
"use strict";

const express = require("express");
const router = express.Router();

const User = require("../models/User");
const BiometricDevice = require("../models/BiometricDevice");
const BiometricPunch = require("../models/BiometricPunch");
const BiometricAttendanceService = require("../services/biometric/BiometricAttendanceService");
const { protect, authorize } = require("../middlewares/authMiddleware");
const { can } = require("../utils/accessControl");

const biometricService = new BiometricAttendanceService();

// Mirrors the pattern already used in newAttendanceRoutes.js: anyone explicitly
// granted attendance management passes, otherwise fall back to role check.
const requireAttendanceManage = async (req, res, next) => {
  if (await can(req.user, "attendance:manage")) return next();
  return authorize("admin", "super-admin", "hr")(req, res, next);
};

router.use(protect, requireAttendanceManage);

// ─────────────────────────────────────────────────────────────────────────────
// PIN MAPPING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/biometric/mappings
 * Every employee alongside their device PIN, so admin can see at a glance who
 * is still unmapped — those employees generate no attendance at all.
 */
router.get("/mappings", async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === "true";
    const query = includeInactive ? {} : { status: "active" };

    const users = await User.find(query)
      .select("name employeeId email department biometricPin status")
      .sort({ name: 1 })
      .lean();

    const mapped = users.filter((u) => u.biometricPin);
    const unmapped = users.filter((u) => !u.biometricPin);

    res.json({
      success: true,
      data: {
        users,
        summary: {
          total: users.length,
          mapped: mapped.length,
          unmapped: unmapped.length,
        },
        unmappedEmployees: unmapped.map((u) => ({
          _id: u._id,
          name: u.name,
          employeeId: u.employeeId,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching biometric mappings:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/biometric/mappings/:userId
 * Assign (or clear, by sending null/"") an employee's device PIN.
 *
 * On a successful new mapping, any punches already received for that PIN are
 * replayed automatically — so enrolling someone on the device before mapping
 * them in the CRM doesn't lose their attendance.
 */
router.put("/mappings/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const raw = req.body.biometricPin;
    const pin = raw === null || raw === undefined || String(raw).trim() === ""
      ? null
      : String(raw).trim();

    if (pin && !/^\d{1,20}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        error: "Device PIN must be numeric (this is the User ID enrolled on the terminal)",
      });
    }

    // Two employees sharing a PIN would silently attribute punches to whichever
    // record was found first. Reject it explicitly.
    if (pin) {
      const clash = await User.findOne({ biometricPin: pin, _id: { $ne: userId } })
        .select("name employeeId")
        .lean();

      if (clash) {
        return res.status(409).json({
          success: false,
          error: `PIN ${pin} is already assigned to ${clash.name} (${clash.employeeId})`,
        });
      }
    }

    const user = await User.findByIdAndUpdate(
      userId,
      pin ? { $set: { biometricPin: pin } } : { $unset: { biometricPin: "" } },
      { new: true }
    ).select("name employeeId biometricPin");

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Recover punches captured before the mapping existed.
    let replay = null;
    if (pin) {
      replay = await biometricService.replayPunches({ pin, status: ["UNMAPPED"] });
    }

    console.log(
      `🔗 Admin ${req.user._id} ${pin ? `mapped PIN ${pin} to` : "cleared PIN for"} ` +
        `${user.name} (${user.employeeId})`
    );

    res.json({
      success: true,
      data: user,
      replay,
      message: pin
        ? `PIN ${pin} mapped to ${user.name}` +
          (replay?.applied ? ` — ${replay.applied} earlier punch(es) recovered` : "")
        : `PIN cleared for ${user.name}`,
    });
  } catch (error) {
    console.error("Error updating biometric mapping:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/biometric/unmapped-pins
 * PINs the device has sent that match no employee. This is the list to work
 * through after enrolling new staff on the terminal.
 */
router.get("/unmapped-pins", async (req, res) => {
  try {
    const rows = await BiometricPunch.aggregate([
      { $match: { status: "UNMAPPED" } },
      {
        $group: {
          _id: { pin: "$pin", serialNumber: "$serialNumber" },
          count: { $sum: 1 },
          firstSeen: { $min: "$punchedAt" },
          lastSeen: { $max: "$punchedAt" },
        },
      },
      { $sort: { lastSeen: -1 } },
      { $limit: 200 },
    ]);

    res.json({
      success: true,
      data: rows.map((r) => ({
        pin: r._id.pin,
        serialNumber: r._id.serialNumber,
        punchCount: r.count,
        firstSeen: r.firstSeen,
        lastSeen: r.lastSeen,
      })),
    });
  } catch (error) {
    console.error("Error fetching unmapped PINs:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// RAW PUNCH LOG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/biometric/punches
 * The audit trail: exactly what the hardware sent and what we did with it.
 * Filter by ?status=, ?userId=, ?pin=, ?serialNumber=, ?from=, ?to=.
 */
router.get("/punches", async (req, res) => {
  try {
    const { status, userId, pin, serialNumber, from, to } = req.query;
    const limit = Math.min(Number(req.query.limit) || 100, 1000);
    const page = Math.max(Number(req.query.page) || 1, 1);

    const query = {};
    if (status) query.status = status.toUpperCase();
    if (userId) query.userId = userId;
    if (pin) query.pin = String(pin).trim();
    if (serialNumber) query.serialNumber = String(serialNumber).toUpperCase();
    if (from || to) {
      query.punchedAt = {};
      if (from) query.punchedAt.$gte = new Date(from);
      if (to) query.punchedAt.$lte = new Date(to);
    }

    const [punches, total] = await Promise.all([
      BiometricPunch.find(query)
        .populate("userId", "name employeeId")
        .sort({ punchedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      BiometricPunch.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: punches,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error fetching biometric punches:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/biometric/replay
 * Re-process punches that failed or were unmapped. The standard fix after
 * correcting a PIN mapping or a shift configuration.
 */
router.post("/replay", async (req, res) => {
  try {
    const { status, since, pin, serialNumber, limit } = req.body || {};
    const summary = await biometricService.replayPunches({ status, since, pin, serialNumber, limit });

    console.log(`♻️  Admin ${req.user._id} replayed biometric punches:`, summary);
    res.json({ success: true, data: summary });
  } catch (error) {
    console.error("Error replaying biometric punches:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DEVICES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/biometric/devices
 * Device list with a derived online/offline verdict. `online` is the first
 * thing to check when attendance stops appearing.
 */
router.get("/devices", async (req, res) => {
  try {
    const devices = await BiometricDevice.find().sort({ createdAt: -1 }).lean();
    const staleAfterMinutes = Number(process.env.BIOMETRIC_STALE_MINUTES || 15);
    const now = Date.now();

    res.json({
      success: true,
      data: devices.map((d) => {
        const minutesSinceSeen = d.lastSeenAt
          ? Math.round((now - new Date(d.lastSeenAt).getTime()) / 60000)
          : null;

        return {
          ...d,
          minutesSinceSeen,
          online: minutesSinceSeen !== null && minutesSinceSeen <= staleAfterMinutes,
        };
      }),
    });
  } catch (error) {
    console.error("Error fetching biometric devices:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/biometric/devices/:id
 * Update a device: name it, relocate it, disable it, or take it out of dry-run
 * once you're satisfied the traffic looks right.
 */
router.put("/devices/:id", async (req, res) => {
  try {
    const allowed = ["name", "location", "enabled", "dryRun", "notes"];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }

    const device = await BiometricDevice.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({ success: false, error: "Device not found" });
    }

    // The ADMS request path caches device lookups (see findEnabledCached in
    // models/BiometricDevice.js). `enabled` and `dryRun` are in that cached
    // document and both are safety switches — disabling a device, or putting
    // it back into dry-run, has to bite immediately, not whenever the entry
    // happens to expire. Dropping the entry here makes the change take effect
    // on the device's very next request.
    BiometricDevice.invalidateCache(device.serialNumber);

    console.log(`🛠️  Admin ${req.user._id} updated device ${device.serialNumber}:`, update);
    res.json({ success: true, data: device });
  } catch (error) {
    console.error("Error updating biometric device:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/biometric/devices
 * Pre-register a device before it is installed — the safer alternative to
 * relying on auto-registration.
 */
router.post("/devices", async (req, res) => {
  try {
    const { serialNumber, name, location, dryRun } = req.body || {};

    if (!serialNumber) {
      return res.status(400).json({ success: false, error: "serialNumber is required" });
    }

    const device = await BiometricDevice.create({
      serialNumber: String(serialNumber).trim().toUpperCase(),
      name: name || "",
      location: location || "",
      enabled: true,
      dryRun: dryRun !== undefined ? Boolean(dryRun) : true,
    });

    // Negative lookups are not cached, so this is belt-and-braces — but it
    // keeps the rule "every write to a device invalidates its cache entry"
    // true without exception, which is what stops the next edit here from
    // quietly reintroducing a stale-flag bug.
    BiometricDevice.invalidateCache(device.serialNumber);

    res.status(201).json({ success: true, data: device });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, error: "That serial number is already registered" });
    }
    console.error("Error creating biometric device:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/biometric/health
 * One-call summary for a dashboard tile.
 */
router.get("/health", async (req, res) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const staleAfterMinutes = Number(process.env.BIOMETRIC_STALE_MINUTES || 15);

    const [devices, last24h, unmappedUsers] = await Promise.all([
      BiometricDevice.find().lean(),
      BiometricPunch.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      User.countDocuments({ status: "active", biometricPin: { $in: [null, undefined] } }),
    ]);

    const byStatus = last24h.reduce((acc, r) => ({ ...acc, [r._id]: r.count }), {});
    const now = Date.now();

    const deviceHealth = devices.map((d) => ({
      serialNumber: d.serialNumber,
      name: d.name,
      enabled: d.enabled,
      dryRun: d.dryRun,
      lastSeenAt: d.lastSeenAt,
      online:
        d.lastSeenAt && (now - new Date(d.lastSeenAt).getTime()) / 60000 <= staleAfterMinutes,
    }));

    res.json({
      success: true,
      data: {
        devices: deviceHealth,
        devicesOnline: deviceHealth.filter((d) => d.online).length,
        devicesTotal: deviceHealth.length,
        last24Hours: {
          applied: byStatus.APPLIED || 0,
          duplicate: byStatus.DUPLICATE || 0,
          unmapped: byStatus.UNMAPPED || 0,
          skipped: byStatus.SKIPPED || 0,
          failed: byStatus.FAILED || 0,
          dryRun: byStatus.DRY_RUN || 0,
        },
        activeEmployeesWithoutPin: unmappedUsers,
        deviceTimezone: process.env.BIOMETRIC_DEVICE_TIMEZONE || "Asia/Kolkata",
      },
    });
  } catch (error) {
    console.error("Error fetching biometric health:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
