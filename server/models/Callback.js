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

    // ── Reminder / alarm state ──────────────────────────────────────────
    //
    // The alarm is DERIVED from these fields on every poll, never pushed as a
    // one-off event. That distinction is the whole design: an event fired at
    // the due moment only reaches someone who happens to be looking, and an
    // agent who was on another call, or had the tab shut, would simply miss
    // it. Because due-ness is recomputed from data, an alarm survives a
    // refresh, shows up in a second tab, and is still waiting when they come
    // back an hour later.
    //
    // Snooze and dismissal live HERE rather than in the browser for the same
    // reason — localStorage snooze would evaporate on reload and re-ring
    // something the agent already dealt with.

    /** Heads-up toast (5 min before) has been shown. */
    reminderSent: {
      type: Boolean,
      default: false,
    },

    reminderSentDate: {
      type: Date,
    },

    /** Alarm suppressed until this moment. Null/past = eligible to ring. */
    snoozedUntil: {
      type: Date,
      default: null,
    },

    /** How many times it has been snoozed — surfaced in the UI so a callback
     *  being avoided all afternoon is visible rather than silently deferred. */
    snoozeCount: {
      type: Number,
      default: 0,
    },

    /**
     * Explicitly dismissed. Stops the alarm without touching `status` —
     * "I've seen this" is not the same as "I completed the call", and
     * conflating them would quietly close callbacks nobody made.
     */
    alarmDismissedAt: {
      type: Date,
      default: null,
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

// Virtual to check if callback is overdue.
//
// The date+time combination is delegated to callbackAlarmService.dueAtFor
// rather than repeated here. Two copies of "when is this due" would be free to
// drift, and the failure would be quiet and confusing: the list badge saying
// a callback is fine while the alarm rings for it, or the reverse.
//
// Required lazily — the service requires this model, so a top-level require
// would be a cycle.
callbackSchema.virtual("isOverdue").get(function () {
  if (this.status === "Completed" || this.status === "Cancelled") {
    return false;
  }
  const { dueAtFor } = require("../services/callbackAlarmService");
  const dueAt = dueAtFor(this);
  // A malformed time is not overdue. Previously this produced an Invalid Date,
  // and `now > InvalidDate` is false — same answer, but by accident rather
  // than on purpose.
  if (!dueAt) return false;
  return new Date() > dueAt;
});

// Ensure virtuals are included in JSON
callbackSchema.set("toJSON", { virtuals: true });
callbackSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Callback", callbackSchema);
