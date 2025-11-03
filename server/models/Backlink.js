const mongoose = require("mongoose");

const backlinkSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ["Social Media", "Others"],
      required: true,
    },
    platform: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
backlinkSchema.index({ project: 1, category: 1 });
backlinkSchema.index({ createdAt: -1 });

// Static method to get all backlinks for a project
backlinkSchema.statics.getProjectBacklinks = async function (
  projectId,
  activeOnly = true
) {
  const filter = { project: projectId };
  if (activeOnly) filter.isActive = true;

  return this.find(filter)
    .populate("addedBy", "name email employeeId")
    .sort({ createdAt: -1 });
};

module.exports = mongoose.model("Backlink", backlinkSchema);
