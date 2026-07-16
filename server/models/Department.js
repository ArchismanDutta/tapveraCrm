const mongoose = require("mongoose");

// ======================
// Department Model
// ======================
// Part of the access-management rework (2026-07-03). See:
//   docs/superpowers/specs/2026-07-03-access-management-design.md
//   docs/superpowers/plans/2026-07-03-access-management-rework.md
//
// Replaces the hardcoded department enum on User/Position with a real,
// admin-manageable collection. During the transition, User.department
// (string enum) and Position.department (string enum) continue to work
// unchanged — this collection is additive. See Department.code for the
// mapping back to the legacy enum values.

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true, // e.g. "Tech", "Marketing & Sales"
    },
    // Stable machine key, lowercase, no spaces. Used to bridge to the legacy
    // string enum values on User.department / Position.department while both
    // systems run side by side (e.g. code "tech" <-> legacy "development").
    code: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    // Legacy enum value this department corresponds to, if any. Empty string
    // for departments created after the rework that have no legacy equivalent.
    legacyEnumValue: {
      type: String,
      trim: true,
      default: "",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

departmentSchema.index({ status: 1 });

module.exports = mongoose.model("Department", departmentSchema);
