// server/models/GeofenceEvent.js
//
// Geofenced login (2026-08-07) — Phase 1.
// See docs/superpowers/specs/2026-08-07-geofenced-login-design.md
//
// Append-only record of every geofence decision that was not a plain allow:
// denials at login, denials on the periodic session re-check, and the
// "location unavailable" cases. Same append-only-by-convention pattern as
// AccessAuditLog.js.
//
// Why this exists rather than just a console log: a fence that silently
// refuses people generates support tickets ("it says I'm not at the office
// and I'm sitting at my desk"), and the only way to answer those is to see
// the coordinates and accuracy radius the browser actually reported at the
// time. Without that, the admin's only tool is to widen the radius blindly
// until complaints stop. This turns "the app is broken" into "your phone
// reported a 900m accuracy circle from inside the building, use wifi".
//
// Successful, in-fence logins are deliberately NOT recorded. They would be by
// far the highest-volume write in the system, they are the uninteresting case,
// and a per-login location history of every employee is a surveillance
// dataset this feature does not need in order to work.

const mongoose = require("mongoose");

const geofenceEventSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    email: { type: String, trim: true },

    // login       — blocked at the door
    // recheck     — was inside, has since left; session terminated
    // no-location — client could not or would not supply coordinates
    outcome: {
      type: String,
      enum: ["login-denied", "recheck-denied", "no-location"],
      required: true,
      index: true,
    },

    // Null for "no-location", where by definition we have nothing.
    coordinates: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      // The browser's own 95%-confidence error radius, in metres. The single
      // most useful field here when diagnosing a false denial — see the
      // support-ticket note above.
      accuracy: { type: Number, default: null },
    },

    // Distance in metres to the NEAREST assigned fence's edge, and which one.
    // "You were 40m outside Kolkata HQ" is actionable; "denied" is not.
    nearestLocation: { type: mongoose.Schema.Types.ObjectId, ref: "GeofenceLocation", default: null },
    distanceMeters: { type: Number, default: null },

    reason: { type: String, trim: true, default: "" },
    ipAddress: { type: String, trim: true, default: "" },
    userAgent: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

geofenceEventSchema.index({ userId: 1, createdAt: -1 });
geofenceEventSchema.index({ createdAt: -1 });

module.exports = mongoose.model("GeofenceEvent", geofenceEventSchema);
