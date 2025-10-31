const mongoose = require("mongoose");

const rankHistorySchema = new mongoose.Schema({
  rank: {
    type: Number,
    required: true,
    min: 0,
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  recordedAt: {
    type: Date,
    default: Date.now,
  },
  notes: {
    type: String,
    trim: true,
  },
});

const keywordRankSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    keyword: {
      type: String,
      required: true,
      trim: true,
    },
    targetUrl: {
      type: String,
      trim: true,
    },
    searchEngine: {
      type: String,
      enum: ["Google", "Bing", "Yahoo"],
      default: "Google",
    },
    location: {
      type: String,
      default: "Global",
      trim: true,
    },
    rankHistory: [rankHistorySchema],
    isActive: {
      type: Boolean,
      default: true,
    },
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

// Index for faster queries
keywordRankSchema.index({ project: 1, keyword: 1 });
keywordRankSchema.index({ createdAt: -1 });

// Virtual for current rank
keywordRankSchema.virtual("currentRank").get(function () {
  if (!this.rankHistory || this.rankHistory.length === 0) return null;
  return this.rankHistory[this.rankHistory.length - 1];
});

// Virtual for previous rank
keywordRankSchema.virtual("previousRank").get(function () {
  if (!this.rankHistory || this.rankHistory.length < 2) return null;
  return this.rankHistory[this.rankHistory.length - 2];
});

// Virtual for past rank (3rd most recent)
keywordRankSchema.virtual("pastRank").get(function () {
  if (!this.rankHistory || this.rankHistory.length < 3) return null;
  return this.rankHistory[this.rankHistory.length - 3];
});

// Virtual for rank change (difference between current and previous)
keywordRankSchema.virtual("rankChange").get(function () {
  if (!this.currentRank || !this.previousRank) return 0;
  // Negative means improvement (lower rank number is better)
  return this.previousRank.rank - this.currentRank.rank;
});

// Virtual for rank trend (improved, declined, stable)
keywordRankSchema.virtual("rankTrend").get(function () {
  const change = this.rankChange;
  if (change > 0) return "improved";
  if (change < 0) return "declined";
  return "stable";
});

// Ensure virtuals are included in JSON
keywordRankSchema.set("toJSON", { virtuals: true });
keywordRankSchema.set("toObject", { virtuals: true });

// Method to add new rank
keywordRankSchema.methods.addRank = function (rank, userId, notes = "") {
  this.rankHistory.push({
    rank,
    recordedBy: userId,
    recordedAt: new Date(),
    notes,
  });
  return this.save();
};

// Static method to get all keywords for a project
keywordRankSchema.statics.getProjectKeywords = async function (
  projectId,
  activeOnly = true
) {
  const filter = { project: projectId };
  if (activeOnly) filter.isActive = true;

  return this.find(filter)
    .populate("createdBy", "name email employeeId")
    .populate("rankHistory.recordedBy", "name email employeeId")
    .sort({ createdAt: -1 });
};

module.exports = mongoose.model("KeywordRank", keywordRankSchema);
