const mongoose = require("mongoose");

const clientRemarkSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    section: {
      type: String,
      enum: ["keywords", "blogs", "backlinks", "screenshots"],
      required: true,
      index: true,
    },
    remark: {
      type: String,
      required: [true, "Remark text is required"],
      trim: true,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "addedByModel",
      required: true,
    },
    addedByModel: {
      type: String,
      enum: ["User", "Client"],
      default: "Client",
    },
    addedByRole: {
      type: String,
      enum: ["client"],
      required: true,
      default: "client",
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
clientRemarkSchema.index({ project: 1, section: 1, createdAt: -1 });

module.exports = mongoose.model("ClientRemark", clientRemarkSchema);
