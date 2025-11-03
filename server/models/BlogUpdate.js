const mongoose = require("mongoose");

const blogUpdateSchema = new mongoose.Schema(
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
    url: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      enum: ["Blog Post", "Article", "News", "Tutorial", "Case Study", "Other"],
      default: "Blog Post",
    },
    status: {
      type: String,
      enum: ["Published", "Draft", "Updated", "Archived"],
      default: "Published",
    },
    publishedDate: {
      type: Date,
      default: Date.now,
    },
    wordCount: {
      type: Number,
      min: 0,
    },
    targetKeywords: [
      {
        type: String,
        trim: true,
      },
    ],
    metrics: {
      views: {
        type: Number,
        default: 0,
      },
      shares: {
        type: Number,
        default: 0,
      },
      backlinks: {
        type: Number,
        default: 0,
      },
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
blogUpdateSchema.index({ project: 1, createdAt: -1 });
blogUpdateSchema.index({ project: 1, publishedDate: -1 });

// Static method to get all blog updates for a project
blogUpdateSchema.statics.getProjectBlogUpdates = async function (
  projectId,
  activeOnly = true
) {
  const filter = { project: projectId };
  if (activeOnly) filter.isActive = true;

  return this.find(filter)
    .populate("addedBy", "name email employeeId")
    .sort({ publishedDate: -1, createdAt: -1 });
};

module.exports = mongoose.model("BlogUpdate", blogUpdateSchema);
