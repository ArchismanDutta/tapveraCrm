// server/controllers/geofenceController.js
//
// Geofenced login (2026-08-07) — Phase 2.
// See docs/superpowers/specs/2026-08-07-geofenced-login-design.md
//
// Two distinct surfaces in one controller:
//
//   • Super-Admin management — define named locations, assign them to users,
//     read the denial log. Gated at the route layer (routes/geofenceRoutes.js).
//   • Session verification — the periodic re-check that any logged-in user's
//     browser calls to prove it is still inside the fence.

const mongoose = require("mongoose");
const User = require("../models/User");
const GeofenceLocation = require("../models/GeofenceLocation");
const GeofenceEvent = require("../models/GeofenceEvent");
const { isSubjectToGeofence, evaluate } = require("../utils/geofence");
const { recordGeofenceEvent, clientIp } = require("./authController");

// ===========================================================================
// Locations (Super Admin)
// ===========================================================================

exports.listLocations = async (req, res) => {
  try {
    const locations = await GeofenceLocation.find()
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    // Assignee counts in one aggregate rather than a findById per location —
    // the admin list shows "4 users" against every row, and doing that with a
    // query per row is the N+1 this codebase has been bitten by before.
    const counts = await User.aggregate([
      { $match: { "geofence.locations": { $exists: true, $ne: [] } } },
      { $unwind: "$geofence.locations" },
      { $group: { _id: "$geofence.locations", count: { $sum: 1 } } },
    ]);
    const countByLocation = new Map(counts.map((c) => [String(c._id), c.count]));

    res.json(
      locations.map((loc) => ({
        ...loc,
        assignedUserCount: countByLocation.get(String(loc._id)) || 0,
      }))
    );
  } catch (err) {
    console.error("listLocations error:", err);
    res.status(500).json({ message: "Failed to load geofence locations." });
  }
};

exports.createLocation = async (req, res) => {
  try {
    const { name, address, latitude, longitude, radiusMeters } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Location name is required." });
    }
    if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
      return res.status(400).json({ message: "Valid latitude and longitude are required." });
    }

    const location = await GeofenceLocation.create({
      name: String(name).trim(),
      address: address ? String(address).trim() : "",
      latitude: Number(latitude),
      longitude: Number(longitude),
      radiusMeters: Number(radiusMeters) || 200,
      createdBy: req.user._id,
    });

    res.status(201).json(location);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "A location with that name already exists." });
    }
    if (err.name === "ValidationError") {
      // Surface mongoose's own message — the radius floor in particular
      // explains *why* it is refusing, which a generic 400 would throw away.
      return res.status(400).json({ message: Object.values(err.errors)[0]?.message || "Invalid location." });
    }
    console.error("createLocation error:", err);
    res.status(500).json({ message: "Failed to create geofence location." });
  }
};

exports.updateLocation = async (req, res) => {
  try {
    const { name, address, latitude, longitude, radiusMeters, isActive } = req.body;
    const update = {};

    if (name !== undefined) update.name = String(name).trim();
    if (address !== undefined) update.address = String(address).trim();
    if (latitude !== undefined) update.latitude = Number(latitude);
    if (longitude !== undefined) update.longitude = Number(longitude);
    if (radiusMeters !== undefined) update.radiusMeters = Number(radiusMeters);
    if (isActive !== undefined) update.isActive = Boolean(isActive);

    const location = await GeofenceLocation.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true, // or the radius floor and lat/lng ranges are silently skipped on update
    });

    if (!location) return res.status(404).json({ message: "Location not found." });
    res.json(location);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "A location with that name already exists." });
    }
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: Object.values(err.errors)[0]?.message || "Invalid location." });
    }
    console.error("updateLocation error:", err);
    res.status(500).json({ message: "Failed to update geofence location." });
  }
};

exports.deleteLocation = async (req, res) => {
  try {
    // Referential integrity, enforced here because Mongo will not do it for us.
    //
    // Deleting an assigned location would leave dangling refs on those users.
    // evaluate() resolves zero active fences to NO_ACTIVE_FENCE, which fails
    // closed — so a careless delete would lock out everyone attached to it,
    // with a cause that is invisible from the user record. Refusing, and
    // naming who is in the way, makes the admin unassign deliberately.
    const assignedCount = await User.countDocuments({ "geofence.locations": req.params.id });
    if (assignedCount > 0) {
      return res.status(409).json({
        message: `This location is still assigned to ${assignedCount} user${
          assignedCount === 1 ? "" : "s"
        }. Unassign them first, or deactivate the location instead of deleting it.`,
        assignedUserCount: assignedCount,
      });
    }

    const location = await GeofenceLocation.findByIdAndDelete(req.params.id);
    if (!location) return res.status(404).json({ message: "Location not found." });

    res.json({ message: "Location deleted." });
  } catch (err) {
    console.error("deleteLocation error:", err);
    res.status(500).json({ message: "Failed to delete geofence location." });
  }
};

// ===========================================================================
// Per-user assignment (Super Admin)
// ===========================================================================

/**
 * Everyone who can be fenced, with their current assignment.
 *
 * Excludes clients structurally — they live in a separate Client collection
 * that this never queries — and filters out super-admins, who are exempt by
 * design (see isSubjectToGeofence). Showing a super-admin row with a toggle
 * that silently does nothing would be worse than not showing it.
 */
exports.listAssignableUsers = async (req, res) => {
  try {
    const users = await User.find({
      role: { $nin: ["super-admin", "superadmin"] },
      status: "active",
    })
      .select("name email employeeId role department position avatar geofence")
      .populate("geofence.locations", "name radiusMeters isActive")
      .populate("geofence.assignedBy", "name")
      .sort({ name: 1 })
      .lean();

    res.json(users);
  } catch (err) {
    console.error("listAssignableUsers error:", err);
    res.status(500).json({ message: "Failed to load users." });
  }
};

exports.updateUserGeofence = async (req, res) => {
  try {
    const { enabled, locations } = req.body;
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    // Rejected rather than silently ignored. A super-admin toggling this on
    // and seeing it "save" — while enforcement quietly exempts them anyway —
    // is exactly the sort of thing that erodes trust in whether ANY of these
    // toggles do what they say.
    const targetRole = String(user.role || "").toLowerCase();
    if (targetRole === "super-admin" || targetRole === "superadmin") {
      return res.status(400).json({
        message:
          "Super Admins cannot be geofenced — they are the only account able to lift a geofence, so fencing them out would be unrecoverable.",
      });
    }

    const ids = Array.isArray(locations) ? locations : [];
    const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length !== ids.length) {
      return res.status(400).json({ message: "One or more location IDs were malformed." });
    }

    // Verify every referenced location exists before writing. Otherwise a
    // typo'd ID produces a user with an unresolvable fence — which fails
    // closed and locks them out, for a reason invisible on their record.
    if (validIds.length) {
      const found = await GeofenceLocation.countDocuments({ _id: { $in: validIds } });
      if (found !== validIds.length) {
        return res.status(400).json({ message: "One or more locations no longer exist." });
      }
    }

    // Guard the footgun directly: enabling with no location assigned means
    // "restricted to nowhere", and fails closed on the next login attempt.
    // Nobody means this, so it is refused rather than obeyed.
    if (enabled === true && !validIds.length) {
      return res.status(400).json({
        message: "Select at least one location before enabling the geofence for this user.",
      });
    }

    // findByIdAndUpdate on the single `geofence` path, NOT user.save().
    //
    // save() validates the entire document, so a legacy record that predates a
    // now-required field — or holds a contact number that no longer matches the
    // current regex — would refuse to save, and the admin would get a
    // validation error about a phone number while trying to set a geofence.
    // This is a long-lived CRM; such records exist. Scoping the write to the
    // one path being changed means editing a geofence cannot be blocked by
    // unrelated historical data.
    //
    // It also skips the User pre-save hook, which does a Shift lookup and
    // rewrites shift fields — work that has nothing to do with this change and
    // should not be triggered as a side effect of it.
    await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          geofence: {
            enabled: Boolean(enabled),
            locations: validIds,
            assignedBy: req.user._id,
            assignedAt: new Date(),
          },
        },
      },
      { runValidators: true }
    );

    const updated = await User.findById(userId)
      .select("name email employeeId role geofence")
      .populate("geofence.locations", "name radiusMeters isActive")
      .populate("geofence.assignedBy", "name")
      .lean();

    res.json(updated);
  } catch (err) {
    console.error("updateUserGeofence error:", err);
    res.status(500).json({ message: "Failed to update user geofence." });
  }
};

// ===========================================================================
// Denial log (Super Admin)
// ===========================================================================

exports.listEvents = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const page = Math.max(Number(req.query.page) || 1, 1);

    const filter = {};
    if (req.query.userId && mongoose.Types.ObjectId.isValid(req.query.userId)) {
      filter.userId = req.query.userId;
    }

    const [events, total] = await Promise.all([
      GeofenceEvent.find(filter)
        .populate("userId", "name email employeeId")
        .populate("nearestLocation", "name")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      GeofenceEvent.countDocuments(filter),
    ]);

    res.json({ events, total, page, totalPages: Math.ceil(total / limit) || 1 });
  } catch (err) {
    console.error("listEvents error:", err);
    res.status(500).json({ message: "Failed to load geofence events." });
  }
};

// ===========================================================================
// Session verification (any authenticated user)
// ===========================================================================

/**
 * GET /api/geofence/status — "am I fenced, and how often should I re-check?"
 *
 * Called once after login so the client knows whether to start the watcher at
 * all. Without it every session would poll for a location it may not need,
 * which on mobile means waking the GPS every few minutes for nothing.
 */
exports.getMyGeofenceStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("role geofence")
      .populate("geofence.locations", "name isActive")
      .lean();

    if (!user) return res.status(404).json({ message: "User not found." });

    const subject = isSubjectToGeofence(user, req.user.userType || "User");

    res.json({
      enforced: subject,
      // Names only — never coordinates. Same reasoning as the login refusal
      // payload: handing out fence centres makes spoofing to them trivial.
      locationNames: subject
        ? (user.geofence.locations || []).filter((l) => l.isActive !== false).map((l) => l.name)
        : [],
      // Configurable so the re-check can be tested without editing source.
      // At the 10-minute default a single test cycle takes ten minutes, which
      // is enough friction that the obvious workaround is to hardcode a
      // shorter value "just for now" — and that is exactly the sort of edit
      // that gets committed and shipped. Set GEOFENCE_RECHECK_INTERVAL_MS=30000
      // in a dev .env instead, and production keeps the default untouched.
      //
      // Floored at 30s: anything tighter wakes the GPS hard enough to be felt
      // in phone battery life, for a gap it barely narrows.
      recheckIntervalMs: Math.max(
        Number(process.env.GEOFENCE_RECHECK_INTERVAL_MS) || 10 * 60 * 1000,
        30 * 1000
      ),
    });
  } catch (err) {
    console.error("getMyGeofenceStatus error:", err);
    res.status(500).json({ message: "Failed to load geofence status." });
  }
};

/**
 * POST /api/geofence/verify — the periodic re-check.
 *
 * Closes the "log in at the office, then leave" gap that a login-only check
 * leaves wide open. Runs on the same evaluate() the login door uses.
 *
 * Fails OPEN on internal error, which is the opposite of everywhere else in
 * this feature and is intentional: this endpoint's failure mode is tearing
 * down the sessions of people who are working. A transient database blip must
 * not sign out the entire company mid-task. The login door stays fail-closed,
 * so the worst case here is that an already-authenticated session survives a
 * few extra minutes until the next successful check.
 */
exports.verifySession = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("email role geofence").lean();
    if (!user) return res.status(401).json({ message: "User not found." });

    if (!isSubjectToGeofence(user, req.user.userType || "User")) {
      return res.json({ allowed: true, enforced: false });
    }

    const locations = await GeofenceLocation.find({
      _id: { $in: user.geofence.locations },
    }).lean();

    const result = evaluate(locations, req.body?.coordinates);

    if (result.allowed) {
      return res.json({ allowed: true, enforced: true });
    }

    await recordGeofenceEvent({
      userId: user._id,
      email: user.email,
      outcome: result.code === "NO_LOCATION" ? "no-location" : "recheck-denied",
      coordinates: result.coordinates || { latitude: null, longitude: null, accuracy: null },
      nearestLocation: result.nearest?.id || null,
      distanceMeters: result.nearest?.distanceMeters ?? null,
      reason: result.reason,
      ipAddress: clientIp(req),
      userAgent: req.headers["user-agent"] || "",
    });

    // 403 for both cases here, unlike login's 428/403 split. Once a session
    // exists, "I can't get a location" and "I'm out of bounds" have the same
    // remedy — the session ends — so there is nothing for the client to
    // usefully do differently. `code` is still returned so the sign-out
    // message can explain which happened.
    return res.status(403).json({
      allowed: false,
      enforced: true,
      code: result.code,
      message: result.reason,
    });
  } catch (err) {
    console.error("verifySession error:", err);
    return res.json({ allowed: true, enforced: true, degraded: true });
  }
};
