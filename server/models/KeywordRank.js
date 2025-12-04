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
    keywordLink: {
      type: String,
      trim: true,
    },
    blogLink: {
      type: String,
      trim: true,
    },
    backlink: {
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
    category: {
      type: String,
      enum: ["SEO", "GMB"],
      default: "SEO",
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
// Same keyword can exist with different categories (SEO, GMB)
keywordRankSchema.index({ project: 1, keyword: 1, category: 1 });
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

// Method to get rank at specific date
keywordRankSchema.methods.getRankAtDate = function (targetDate) {
  if (!this.rankHistory || this.rankHistory.length === 0) return null;

  // Find the closest rank record before or on the target date
  const validRecords = this.rankHistory.filter(
    (record) => new Date(record.recordedAt) <= targetDate
  );

  if (validRecords.length === 0) return null;

  // Return the most recent valid record
  return validRecords[validRecords.length - 1];
};

// Method to calculate velocity over a time period (in days)
keywordRankSchema.methods.calculateVelocity = function (days = 7) {
  if (!this.rankHistory || this.rankHistory.length < 2) {
    return { change: 0, velocity: 0, hasData: false };
  }

  const now = new Date();
  const targetDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const currentRank = this.currentRank;
  const pastRank = this.getRankAtDate(targetDate);

  // If we don't have data from the requested time period,
  // use the first and last rank in history as fallback
  if (!currentRank || !pastRank) {
    // Fallback: Compare first and last rank in history
    const firstRank = this.rankHistory[0];
    const lastRank = this.rankHistory[this.rankHistory.length - 1];

    if (!firstRank || !lastRank || firstRank === lastRank) {
      return { change: 0, velocity: 0, hasData: false };
    }

    // Calculate actual time elapsed in days
    const timeElapsed = (new Date(lastRank.recordedAt) - new Date(firstRank.recordedAt)) / (1000 * 60 * 60 * 24);
    const daysElapsed = Math.max(timeElapsed, 0.1); // Minimum 0.1 days to handle same-day updates better

    const change = firstRank.rank - lastRank.rank;
    const velocity = change / daysElapsed;

    return {
      change,
      velocity,
      hasData: true,
      currentRank: lastRank.rank,
      pastRank: firstRank.rank,
      daysAnalyzed: daysElapsed,
      isFallback: true, // Indicate this is based on available data, not requested time period
      requestedDays: days,
    };
  }

  // Positive change means improvement (rank went down in number)
  const change = pastRank.rank - currentRank.rank;
  const velocity = change / days; // Average positions gained per day

  return {
    change,
    velocity,
    hasData: true,
    currentRank: currentRank.rank,
    pastRank: pastRank.rank,
    daysAnalyzed: days,
    isFallback: false,
  };
};

// Check if keyword is stagnant (no movement in X days)
keywordRankSchema.methods.isStagnant = function (days = 30) {
  if (!this.rankHistory || this.rankHistory.length < 2) return false;

  const now = new Date();
  const targetDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const currentRank = this.currentRank;
  const pastRank = this.getRankAtDate(targetDate);

  // If we don't have data from the requested period, use fallback
  if (!currentRank || !pastRank) {
    // Fallback: Compare first and last rank in history
    const firstRank = this.rankHistory[0];
    const lastRank = this.rankHistory[this.rankHistory.length - 1];

    if (!firstRank || !lastRank) return false;

    // Check if keyword has at least 2 different dates
    const firstDate = new Date(firstRank.recordedAt);
    const lastDate = new Date(lastRank.recordedAt);
    const daysDiff = (lastDate - firstDate) / (1000 * 60 * 60 * 24);

    // Only consider stagnant if at least 1 day has passed and rank hasn't changed
    if (daysDiff < 1) return false;

    return firstRank.rank === lastRank.rank;
  }

  // No movement if rank is exactly the same
  return currentRank.rank === pastRank.rank;
};

// Check for rapid decline (drop of X positions in Y days)
keywordRankSchema.methods.hasRapidDecline = function (
  positionDrop = 5,
  days = 7
) {
  const velocity = this.calculateVelocity(days);

  if (!velocity.hasData) return false;

  // Negative change means decline (rank went up in number)
  return velocity.change <= -positionDrop;
};

// Get velocity category
keywordRankSchema.methods.getVelocityCategory = function (days = 7) {
  const velocity = this.calculateVelocity(days);

  if (!velocity.hasData) return "unknown";

  const change = velocity.change;

  if (change >= 10) return "rapid-improvement"; // +10 or more positions
  if (change >= 5) return "strong-improvement"; // +5 to +9 positions
  if (change >= 1) return "improvement"; // +1 to +4 positions
  if (change === 0) return "stable"; // No change
  if (change >= -4) return "slight-decline"; // -1 to -4 positions
  if (change >= -9) return "decline"; // -5 to -9 positions
  return "rapid-decline"; // -10 or worse
};

// Virtual field for 7-day velocity
keywordRankSchema.virtual("velocity7Day").get(function () {
  return this.calculateVelocity(7);
});

// Virtual field for 30-day velocity
keywordRankSchema.virtual("velocity30Day").get(function () {
  return this.calculateVelocity(30);
});

// Virtual field for stagnation check
keywordRankSchema.virtual("isStagnant30Days").get(function () {
  return this.isStagnant(30);
});

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

// Static method to get velocity insights for a project
keywordRankSchema.statics.getVelocityInsights = async function (projectId) {
  const keywords = await this.getProjectKeywords(projectId, true);

  // Calculate velocity for each keyword
  const keywordsWithVelocity = keywords.map((keyword) => {
    const velocity7 = keyword.calculateVelocity(7);
    const velocity30 = keyword.calculateVelocity(30);
    const isStagnant = keyword.isStagnant(30);
    const hasRapidDecline = keyword.hasRapidDecline(5, 7);
    const velocityCategory = keyword.getVelocityCategory(7);

    return {
      keyword: keyword.keyword,
      _id: keyword._id,
      currentRank: keyword.currentRank?.rank || null,
      velocity7Day: velocity7,
      velocity30Day: velocity30,
      isStagnant,
      hasRapidDecline,
      velocityCategory,
      searchEngine: keyword.searchEngine,
      location: keyword.location,
    };
  });

  // Filter and sort for different categories
  const fastestImprovements = keywordsWithVelocity
    .filter((k) => k.velocity7Day.hasData && k.velocity7Day.change > 0)
    .sort((a, b) => b.velocity7Day.change - a.velocity7Day.change)
    .slice(0, 10);

  const rapidDeclines = keywordsWithVelocity
    .filter((k) => k.velocity7Day.hasData && k.hasRapidDecline)
    .sort((a, b) => a.velocity7Day.change - b.velocity7Day.change);

  const stagnantKeywords = keywordsWithVelocity.filter((k) => k.isStagnant);

  // Calculate summary statistics
  const totalKeywords = keywordsWithVelocity.length;
  const improving = keywordsWithVelocity.filter(
    (k) => k.velocity7Day.hasData && k.velocity7Day.change > 0
  ).length;
  const declining = keywordsWithVelocity.filter(
    (k) => k.velocity7Day.hasData && k.velocity7Day.change < 0
  ).length;
  const stable = keywordsWithVelocity.filter(
    (k) => k.velocity7Day.hasData && k.velocity7Day.change === 0
  ).length;

  const averageVelocity7Day =
    keywordsWithVelocity
      .filter((k) => k.velocity7Day.hasData)
      .reduce((sum, k) => sum + k.velocity7Day.change, 0) /
    (keywordsWithVelocity.filter((k) => k.velocity7Day.hasData).length || 1);

  const averageVelocity30Day =
    keywordsWithVelocity
      .filter((k) => k.velocity30Day.hasData)
      .reduce((sum, k) => sum + k.velocity30Day.change, 0) /
    (keywordsWithVelocity.filter((k) => k.velocity30Day.hasData).length || 1);

  return {
    summary: {
      totalKeywords,
      improving,
      declining,
      stable,
      stagnant: stagnantKeywords.length,
      rapidDeclines: rapidDeclines.length,
      averageVelocity7Day: Math.round(averageVelocity7Day * 100) / 100,
      averageVelocity30Day: Math.round(averageVelocity30Day * 100) / 100,
    },
    fastestImprovements,
    rapidDeclines,
    stagnantKeywords,
    allKeywords: keywordsWithVelocity,
  };
};

module.exports = mongoose.model("KeywordRank", keywordRankSchema);
