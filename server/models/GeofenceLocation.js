// server/models/GeofenceLocation.js
//
// Geofenced login (2026-08-07) — Phase 1.
// See docs/superpowers/specs/2026-08-07-geofenced-login-design.md
//
// A reusable, named circular fence — "Kolkata HQ, 300m" — defined once by the
// Super Admin and then assigned to any number of users. This mirrors how
// Shift.js already works in this codebase: the shape is defined centrally and
// referenced from User, rather than copied onto each user. That matters here
// more than it does for shifts, because a fence is a physical fact about a
// building: when the office moves, one document changes and every assigned
// employee follows. Coordinates duplicated per-user would drift the first time
// someone edited one of them.
//
// Circles rather than polygons, deliberately. A polygon fence is more precise
// on paper, but it needs a map-drawing UI to be usable, and consumer GPS is
// accurate to roughly 10-50m outdoors and considerably worse indoors — which
// is the regime this runs in, since employees are inside the building being
// fenced. At that error scale the extra precision of a polygon is noise, and
// "a point and a radius" is something an admin can enter, verify and reason
// about from a phone.

const mongoose = require("mongoose");

const geofenceLocationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Location name is required"],
      trim: true,
      unique: true,
      index: true,
    },

    // Free-text, purely for humans reading the admin list. Nothing resolves
    // this to coordinates — the lat/lng below are the only thing enforcement
    // ever reads, so a stale address can mislead an admin but can never
    // change who gets in.
    address: { type: String, trim: true, default: "" },

    latitude: {
      type: Number,
      required: [true, "Latitude is required"],
      min: [-90, "Latitude must be between -90 and 90"],
      max: [90, "Latitude must be between -90 and 90"],
    },

    longitude: {
      type: Number,
      required: [true, "Longitude is required"],
      min: [-180, "Longitude must be between -180 and 180"],
      max: [180, "Longitude must be between -180 and 180"],
    },

    // Metres from the centre point.
    //
    // The 50m floor is not arbitrary and is not a UI nicety — it is a
    // correctness guard. A fence tighter than typical GPS error would reject
    // people who are genuinely standing inside it, at random, depending on
    // satellite geometry and whether they are near a window. An admin who
    // types 10m here has not built a stricter fence; they have built one that
    // fails unpredictably. See ACCURACY_GRACE_METERS in utils/geofence.js for
    // the other half of this.
    radiusMeters: {
      type: Number,
      required: [true, "Radius is required"],
      min: [50, "Radius must be at least 50 metres — GPS is not accurate enough for a tighter fence"],
      max: [100000, "Radius cannot exceed 100km"],
      default: 200,
    },

    // Soft-delete. A location referenced by even one user must never be hard
    // deleted: the reference would dangle, and evaluate() treats a user with
    // zero *resolvable* fences as "cannot be anywhere", which would lock them
    // out with no visible cause. geofenceController.deleteLocation enforces
    // this — it refuses to delete an assigned location and points the admin at
    // the assignees instead.
    isActive: { type: Boolean, default: true, index: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("GeofenceLocation", geofenceLocationSchema);
