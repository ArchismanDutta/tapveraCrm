const mongoose = require("mongoose");

const screenshotSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    fileSize: {
      type: Number, // in bytes
    },
    mimeType: {
      type: String,
    },
    tags: [{
      type: String,
      trim: true,
    }],
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
screenshotSchema.index({ project: 1, createdAt: -1 });
screenshotSchema.index({ uploadedBy: 1 });

// Static method to get all screenshots for a project
screenshotSchema.statics.getProjectScreenshots = async function (
  projectId,
  activeOnly = true
) {
  const filter = { project: projectId };
  if (activeOnly) filter.isActive = true;

  return this.find(filter)
    .populate("uploadedBy", "name email employeeId")
    .sort({ createdAt: -1 });
};

module.exports = mongoose.model("Screenshot", screenshotSchema);
