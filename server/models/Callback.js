const mongoose = require("mongoose");

// Callback Schema for Lead Follow-ups
const callbackSchema = new mongoose.Schema(
  {
    callbackId: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
    },

    // Reference to Lead
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
    },

    // Auto-filled from Lead (for quick access)
    clientName: {
      type: String,
      required: true,
      trim: true,
    },

    businessName: {
      type: String,
      required: true,
      trim: true,
    },

    // Callback Schedule
    callbackDate: {
      type: Date,
      required: true,
      index: true,
    },

    callbackTime: {
      type: String,
      required: true,
      trim: true,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:MM"],
    },

    callbackType: {
      type: String,
      enum: ["Call", "Email", "WhatsApp", "Zoom", "In-Person Meeting"],
      default: "Call",
    },

    // Status
    status: {
      type: String,
      enum: ["Pending", "Completed", "Rescheduled", "Not Reachable", "Cancelled"],
      default: "Pending",
      index: true,
    },

    // Assignment
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Notes and Outcome
    remarks: {
      type: String,
      trim: true,
    },

    outcome: {
      type: String,
      trim: true,
    },

    // Completion tracking
    completedDate: {
      type: Date,
    },

    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Rescheduling history
    rescheduledFrom: {
      type: Date,
    },

    rescheduledCount: {
      type: Number,
      default: 0,
    },

    // Priority
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: "Medium",
    },

    // Reminder settings
    reminderSent: {
      type: Boolean,
      default: false,
    },

    reminderSentDate: {
      type: Date,
    },

    // Transfer fields
    transferStatus: {
      type: String,
      enum: ["Not Transferred", "Transferred", "Accepted", "Rejected", "Completed"],
      default: "Not Transferred",
      index: true,
    },

    transferredTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    transferredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    transferredAt: {
      type: Date,
    },

    transferRemarks: {
      type: String,
      trim: true,
    },

    transferCompletedAt: {
      type: Date,
    },

    transferCompletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
callbackSchema.index({ leadId: 1, assignedTo: 1 });
callbackSchema.index({ status: 1, callbackDate: 1 });
callbackSchema.index({ assignedTo: 1, status: 1 });

// Auto-generate callbackId before saving
callbackSchema.pre("save", async function (next) {
  if (!this.callbackId) {
    const count = await mongoose.model("Callback").countDocuments();
    this.callbackId = `CB${String(count + 1).padStart(6, "0")}`;
  }
  next();
});

// Virtual to check if callback is overdue
callbackSchema.virtual("isOverdue").get(function () {
  if (this.status === "Completed" || this.status === "Cancelled") {
    return false;
  }
  const now = new Date();
  const callbackDateTime = new Date(this.callbackDate);
  const [hours, minutes] = this.callbackTime.split(":").map(Number);
  callbackDateTime.setHours(hours, minutes, 0, 0);
  return now > callbackDateTime;
});

// Ensure virtuals are included in JSON
callbackSchema.set("toJSON", { virtuals: true });
callbackSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Callback", callbackSchema);
