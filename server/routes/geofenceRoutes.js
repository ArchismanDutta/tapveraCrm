// server/routes/geofenceRoutes.js
//
// Geofenced login (2026-08-07) — Phase 2.
// See docs/superpowers/specs/2026-08-07-geofenced-login-design.md

const express = require("express");
const router = express.Router();
const geofenceController = require("../controllers/geofenceController");
const { protect, authorize } = require("../middlewares/authMiddleware");

// Super Admin ONLY — and unlike most admin surfaces in this codebase, there is
// deliberately no `can(...)` permission-flag alternative path alongside
// authorize(). Everywhere else that pattern exists to let a Position be
// granted equivalent rights (see shiftRoutes.js, authRoutes.js). Not here:
// whoever can edit a fence can lift their own restriction, so delegating this
// would hand every fenced-but-privileged user the ability to unfence
// themselves — which is the one capability the feature cannot survive.
//
// Note authorize() lets super-admin through any list, so listing "super-admin"
// explicitly is belt-and-braces; the meaningful part is that no other role
// appears.
const superAdminOnly = [protect, authorize("super-admin")];

// ── Locations ──────────────────────────────────────────────────────────────
router.get("/locations", superAdminOnly, geofenceController.listLocations);
router.post("/locations", superAdminOnly, geofenceController.createLocation);
router.put("/locations/:id", superAdminOnly, geofenceController.updateLocation);
router.delete("/locations/:id", superAdminOnly, geofenceController.deleteLocation);

// ── Per-user assignment ────────────────────────────────────────────────────
router.get("/users", superAdminOnly, geofenceController.listAssignableUsers);
router.put("/users/:userId", superAdminOnly, geofenceController.updateUserGeofence);

// ── Denial log ─────────────────────────────────────────────────────────────
router.get("/events", superAdminOnly, geofenceController.listEvents);

// ── Session verification (any authenticated user) ──────────────────────────
// `protect` only: every logged-in user's browser calls these about itself, and
// both are scoped to req.user._id server-side — there is no id parameter to
// tamper with.
router.get("/status", protect, geofenceController.getMyGeofenceStatus);
router.post("/verify", protect, geofenceController.verifySession);

module.exports = router;
