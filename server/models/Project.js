// models/Project.js
const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    projectName: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["Website", "SEO", "Google Marketing", "SMO", "Hosting", "Invoice App"],
    },
    assignedTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },
    budget: {
      type: Number,
      min: 0,
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },
    status: {
      type: String,
      enum: ["Active", "Inactive", "Completed"],
      default: "Active",
    },
    completedDate: {
      type: Date,
    },
    milestones: [
      {
        title: String,
        description: String,
        dueDate: Date,
        completed: {
          type: Boolean,
          default: false,
        },
        completedDate: Date,
      },
    ],
    attachments: [
      {
        filename: String,
        url: String,
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    notes: [
      {
        content: String,
        createdBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual for computing project status based on end date
projectSchema.virtual("computedStatus").get(function () {
  const today = new Date();
  const endDate = new Date(this.endDate);

  if (this.status === "Completed") return "Completed";
  if (this.status === "Inactive") return "Inactive";
  if (endDate < today) return "Needs Renewal";
  if (this.status === "Active") return "Active";
  return "Inactive";
});

// Index for better query performance
projectSchema.index({ type: 1, status: 1 });
projectSchema.index({ assignedTo: 1 });
projectSchema.index({ client: 1 });
projectSchema.index({ endDate: 1 });

module.exports = mongoose.model("Project", projectSchema);