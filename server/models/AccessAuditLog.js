// server/models/AccessAuditLog.js
//
// Role & Department Hierarchy Revamp v2 (2026-07-27) — Phase 1, Task 1.2.
// See docs/superpowers/specs/2026-07-27-role-hierarchy-revamp-design.md
//      docs/superpowers/plans/2026-07-27-role-hierarchy-revamp-plan.md
//
// Records every delegated access change made by anyone other than Super
// Admin (grant, revoke, position reassignment, position creation) via
// server/utils/accessControl.js's logAccessChange(). This is the shipped
// answer to "who gave X this access and when" — surfaced as a "recent
// changes" panel on the existing Access Overview tab
// (client/src/pages/admin/AccessManagementPage.jsx), the same way that tab
// already answers "what can X access right now."
//
// Append-only by convention: nothing in this codebase updates or deletes an
// AccessAuditLog entry after creation.

const mongoose = require("mongoose");

const accessAuditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: {
      type: String,
      enum: ["grant", "revoke", "assign-position", "create-position"],
      required: true,
    },
    flagOrPositionName: { type: String, trim: true },
    previousValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

accessAuditLogSchema.index({ targetUserId: 1, createdAt: -1 });

module.exports = mongoose.model("AccessAuditLog", accessAuditLogSchema);
