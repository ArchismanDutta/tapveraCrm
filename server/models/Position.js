const mongoose = require("mongoose");

// Position schema for managing organizational positions
const positionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    level: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 50
    },
    department: {
      type: String,
      enum: ["executives", "development", "marketingAndSales", "humanResource", "all", ""],
      default: "all"
    },
    // ====== ACCESS-MANAGEMENT REWORK (2026-07-03) ======
    // Additive reference fields — see docs/superpowers/specs/2026-07-03-access-management-design.md
    // `department` (string enum, above) is left untouched for backward compatibility.
    // New code should prefer `departmentRef`; `department` is populated from it via
    // migrateToPositionRefs.js and kept in sync going forward.
    departmentRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
      index: true
    },
    // Explicit hierarchy chain, e.g. Agent.parentPosition -> Team Lead -> Supervisor -> ...
    // Lets two department-scoped positions share a level/name pattern (e.g. "Team Lead — Tech"
    // and "Team Lead — Marketing & Sales") without inferring the chain purely from numeric
    // level + department match.
    parentPosition: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Position",
      default: null
    },
    description: {
      type: String,
      trim: true,
      default: ""
    },
    permissions: {
      // User Management
      canManageUsers: { type: Boolean, default: false },

      // Client & Project Management
      canManageClients: { type: Boolean, default: false },
      canManageProjects: { type: Boolean, default: false },
      canAssignTasks: { type: Boolean, default: false },

      // HR Permissions
      canApproveLeaves: { type: Boolean, default: false },
      canApproveShifts: { type: Boolean, default: false },
      canViewReports: { type: Boolean, default: false },
      canManageAttendance: { type: Boolean, default: false },

      // Hierarchical Data Access
      canViewSubordinateLeads: { type: Boolean, default: false },
      canViewSubordinateCallbacks: { type: Boolean, default: false },
      canViewSubordinateTasks: { type: Boolean, default: false },
      canViewSubordinateProjects: { type: Boolean, default: false },
      canEditSubordinateLeads: { type: Boolean, default: false },
      canEditSubordinateCallbacks: { type: Boolean, default: false },
      canAssignToSubordinates: { type: Boolean, default: false },

      // Department-wide Access
      canViewDepartmentLeads: { type: Boolean, default: false },
      canViewDepartmentCallbacks: { type: Boolean, default: false },
      canViewDepartmentTasks: { type: Boolean, default: false },

      // Access-management rework (2026-07-03): permissions for the Access
      // Management page itself. Super-admin bypasses these as it bypasses
      // everything; these exist so "Admin" (or any other position) can be
      // granted them explicitly instead of relying on a hardcoded bypass.
      canManageDepartments: { type: Boolean, default: false },
      canManagePositions: { type: Boolean, default: false }
    },

    // Hierarchical access configuration
    hierarchicalAccess: {
      // Can access data of positions with level less than this
      accessLowerLevels: { type: Boolean, default: false },

      // Minimum level difference required (e.g., 10 means can access positions 10+ levels below)
      minimumLevelGap: { type: Number, default: 0 },

      // Specific positions this position can access (by name)
      canAccessPositions: [{ type: String, trim: true }],

      // Data scope: "own", "team", "department", "all"
      dataScope: {
        type: String,
        enum: ["own", "team", "department", "all"],
        default: "own"
      }
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active"
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  {
    timestamps: true
  }
);

// Indexes for better performance
positionSchema.index({ level: -1 });
positionSchema.index({ status: 1 });
positionSchema.index({ department: 1 });
positionSchema.index({ departmentRef: 1 });
positionSchema.index({ parentPosition: 1 });

module.exports = mongoose.model("Position", positionSchema);
