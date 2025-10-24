const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },

    // Who created/assigned the task
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Users assigned to the task
    assignedTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],

    // Project reference (optional - task can be standalone or part of a project)
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },

    // Status of the task
    status: {
      type: String,
      enum: ["pending", "in-progress", "completed", "rejected"],
      default: "pending",
    },

    // Task due date
    dueDate: { type: Date },

    // Task priority
    priority: {
      type: String,
      enum: ["High", "Medium", "Low"],
      default: "Medium",
    },

    // ✅ New field: When the task was marked completed
    completedAt: { type: Date, default: null },

    // ✅ New field: When the task was rejected
    rejectedAt: { type: Date, default: null },

    // ✅ New field: Rejection reason
    rejectionReason: { type: String, default: null },

    // ✅ Track who last edited the task
    lastEditedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ✅ Employee submission fields
    submissionUrl: { type: String, default: null },
    submissionText: { type: String, default: null },
    submissionRemark: { type: String, default: null },
    submittedAt: { type: Date, default: null },

    // ✅ Admin approval status for submissions
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", "none"],
      default: "none", // "none" for tasks not yet submitted
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: { type: Date, default: null },
    approvalRemark: { type: String, default: null },

    // Remarks on the task
    remarks: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        comment: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // ✅ Status change history
    statusHistory: [
      {
        status: {
          type: String,
          enum: ["pending", "in-progress", "completed", "rejected"],
          required: true,
        },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        changedAt: { type: Date, default: Date.now },
        note: { type: String }, // Optional note for the change (e.g., rejection reason)
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Task", taskSchema);
