const mongoose = require("mongoose");

const rankHistorySchema = new mongoose.Schema({
  rank: {
    type: Number,
    required: true,
    min: 0,
    // 0   = legacy "not ranked" (manual entries, backward-compat)
    // 101 = auto-detected "not in top 100" (new standard for auto/fetch/scrape)
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false, // false: cron job has no user context
  },
  recordedAt: {
    type: Date,
    default: Date.now,
  },
  notes: {
    type: String,
    trim: true,
  },
  source: {
    type: String,
    enum: ["manual", "auto", "fetch", "scrape"],
    default: "manual",
  },
  device: {
    type: String,
    enum: ["desktop", "mobile"],
    default: "desktop",
  },
  // Top 10 SERP results at time of fetch (for competitor visibility)
  serpSnapshot: [
    {
      position: Number,
      domain: String,
      url: String,
      title: String,
    },
  ],
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
    // Legacy single-string location kept for backward compatibility
    location: {
      type: String,
      default: "Global",
      trim: true,
    },
    // City-level location fields (new)
    city: {
      type: String,
      trim: true,
      default: "",
    },
    country: {
      type: String,
      trim: true,
      default: "Global",
    },
    countryCode: {
      type: String,
      trim: true,
      default: "",
      lowercase: true,
    },
    category: {
      type: String,
      enum: ["SEO", "GMB"],
      default: "SEO",
    },
    priority: {
      type: String,
      enum: ["high", "normal"],
      default: "normal",
    },
    device: {
      type: String,
      enum: ["desktop", "mobile"],
      default: "desktop",
    },
    fetchFrequency: {
      type: String,
      enum: ["daily", "weekly", "monthly"],
      default: "weekly",
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
keywordRankSchema.index({ project: 1, keyword: 1, category: 1 });
keywordRankSchema.index({ createdAt: -1 });

// ─── Virtuals ─────────────────────────────────────────────────────────────────

keywordRankSchema.virtual("currentRank").get(function () {
  if (!this.rankHistory || this.rankHistory.length === 0) return null;
  return this.rankHistory[this.rankHistory.length - 1];
});

keywordRankSchema.virtual("previousRank").get(function () {
  if (!this.rankHistory || this.rankHistory.length < 2) return null;
  return this.rankHistory[this.rankHistory.length - 2];
});

keywordRankSchema.virtual("pastRank").get(function () {
  if (!this.rankHistory || this.rankHistory.length < 3) return null;
  return this.rankHistory[this.rankHistory.length - 3];
});

keywordRankSchema.virtual("rankChange").get(function () {
  if (!this.currentRank || !this.previousRank) return 0;
  return calculateRankChange(this.previousRank.rank, this.currentRank.rank);
});

keywordRankSchema.virtual("rankTrend").get(function () {
  const change = this.rankChange;
  if (change > 0) return "improved";
  if (change < 0) return "declined";
  return "stable";
});

keywordRankSchema.set("toJSON", { virtuals: true });
keywordRankSchema.set("toObject", { virtuals: true });

// ─── Rank change calculation ──────────────────────────────────────────────────

// Treats both legacy 0 and new 101+ as "not ranked"
function isNotRanked(rank) {
  return rank === 0 || rank >= 101;
}

function calculateRankChange(prevRank, currRank) {
  const prevUnranked = isNotRanked(prevRank);
  const currUnranked = isNotRanked(currRank);

  if (prevUnranked && !currUnranked) {
    // Entered rankings: improvement proportional to position achieved
    return 100 - currRank;
  }
  if (!prevUnranked && currUnranked) {
    // Fell out of rankings: steep decline
    return -(100 + prevRank);
  }
  if (prevUnranked && currUnranked) {
    return 0;
  }
  // Normal case: lower number = better, so positive = improvement
  return prevRank - currRank;
}

// ─── Instance methods ─────────────────────────────────────────────────────────

// Add a new rank entry to history
keywordRankSchema.methods.addRank = function (
  rank,
  userId,
  notes = "",
  source = "manual",
  device = "desktop",
  serpSnapshot = []
) {
  this.rankHistory.push({
    rank,
    recordedBy: userId || undefined,
    recordedAt: new Date(),
    notes,
    source,
    device,
    serpSnapshot,
  });
  return this.save();
};

// Get the rank entry closest to a specific date
keywordRankSchema.methods.getRankAtDate = function (targetDate) {
  if (!this.rankHistory || this.rankHistory.length === 0) return null;
  const validRecords = this.rankHistory.filter(
    (record) => new Date(record.recordedAt) <= targetDate
  );
  if (validRecords.length === 0) return null;
  return validRecords[validRecords.length - 1];
};

// Calculate velocity (rank change per day) over a time window
keywordRankSchema.methods.calculateVelocity = function (days = 7) {
  if (!this.rankHistory || this.rankHistory.length < 2) {
    return { change: 0, velocity: 0, hasData: false };
  }

  const now = new Date();
  const targetDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const currentRank = this.currentRank;
  const pastRank = this.getRankAtDate(targetDate);

  if (!currentRank || !pastRank) {
    const firstRank = this.rankHistory[0];
    const lastRank = this.rankHistory[this.rankHistory.length - 1];

    if (!firstRank || !lastRank || firstRank === lastRank) {
      return { change: 0, velocity: 0, hasData: false };
    }

    const timeElapsed =
      (new Date(lastRank.recordedAt) - new Date(firstRank.recordedAt)) /
      (1000 * 60 * 60 * 24);
    const daysElapsed = Math.max(timeElapsed, 0.1);
    const change = calculateRankChange(firstRank.rank, lastRank.rank);
    const velocity = change / daysElapsed;

    return {
      change,
      velocity,
      hasData: true,
      currentRank: lastRank.rank,
      pastRank: firstRank.rank,
      daysAnalyzed: daysElapsed,
      isFallback: true,
      requestedDays: days,
    };
  }

  const change = calculateRankChange(pastRank.rank, currentRank.rank);
  const velocity = change / days;

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

// Check if keyword has not moved in X days
keywordRankSchema.methods.isStagnant = function (days = 30) {
  if (!this.rankHistory || this.rankHistory.length < 2) return false;

  const now = new Date();
  const targetDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const currentRank = this.currentRank;
  const pastRank = this.getRankAtDate(targetDate);

  if (!currentRank || !pastRank) {
    const firstRank = this.rankHistory[0];
    const lastRank = this.rankHistory[this.rankHistory.length - 1];
    if (!firstRank || !lastRank) return false;
    const daysDiff =
      (new Date(lastRank.recordedAt) - new Date(firstRank.recordedAt)) /
      (1000 * 60 * 60 * 24);
    if (daysDiff < 1) return false;
    return firstRank.rank === lastRank.rank;
  }

  return currentRank.rank === pastRank.rank;
};

// Check for a rapid decline over X days
keywordRankSchema.methods.hasRapidDecline = function (positionDrop = 5, days = 7) {
  const velocity = this.calculateVelocity(days);
  if (!velocity.hasData) return false;
  return velocity.change <= -positionDrop;
};

// Bin velocity into a descriptive category
keywordRankSchema.methods.getVelocityCategory = function (days = 7) {
  const velocity = this.calculateVelocity(days);
  if (!velocity.hasData) return "unknown";
  const change = velocity.change;
  if (change >= 10) return "rapid-improvement";
  if (change >= 5)  return "strong-improvement";
  if (change >= 1)  return "improvement";
  if (change === 0) return "stable";
  if (change >= -4) return "slight-decline";
  if (change >= -9) return "decline";
  return "rapid-decline";
};

// ─── Virtual aggregates ───────────────────────────────────────────────────────

keywordRankSchema.virtual("velocity7Day").get(function () {
  return this.calculateVelocity(7);
});

keywordRankSchema.virtual("velocity30Day").get(function () {
  return this.calculateVelocity(30);
});

keywordRankSchema.virtual("isStagnant30Days").get(function () {
  return this.isStagnant(30);
});

// ─── Static methods ───────────────────────────────────────────────────────────

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

keywordRankSchema.statics.getVelocityInsights = async function (projectId) {
  const keywords = await this.getProjectKeywords(projectId, true);

  const keywordsWithVelocity = keywords.map((keyword) => {
    const velocity7  = keyword.calculateVelocity(7);
    const velocity30 = keyword.calculateVelocity(30);
    const isStagnant = keyword.isStagnant(30);
    const hasRapidDecline  = keyword.hasRapidDecline(5, 7);
    const velocityCategory = keyword.getVelocityCategory(7);

    return {
      keyword:        keyword.keyword,
      _id:            keyword._id,
      currentRank:    keyword.currentRank?.rank || null,
      velocity7Day:   velocity7,
      velocity30Day:  velocity30,
      isStagnant,
      hasRapidDecline,
      velocityCategory,
      searchEngine:   keyword.searchEngine,
      location:       keyword.location,
      city:           keyword.city,
      country:        keyword.country,
      priority:       keyword.priority,
      fetchFrequency: keyword.fetchFrequency,
      device:         keyword.device,
    };
  });

  const fastestImprovements = keywordsWithVelocity
    .filter((k) => k.velocity7Day.hasData && k.velocity7Day.change > 0)
    .sort((a, b) => b.velocity7Day.change - a.velocity7Day.change)
    .slice(0, 10);

  const rapidDeclines = keywordsWithVelocity
    .filter((k) => k.velocity7Day.hasData && k.hasRapidDecline)
    .sort((a, b) => a.velocity7Day.change - b.velocity7Day.change);

  const stagnantKeywords = keywordsWithVelocity.filter((k) => k.isStagnant);

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
      stagnant:      stagnantKeywords.length,
      rapidDeclines: rapidDeclines.length,
      averageVelocity7Day:  Math.round(averageVelocity7Day  * 100) / 100,
      averageVelocity30Day: Math.round(averageVelocity30Day * 100) / 100,
    },
    fastestImprovements,
    rapidDeclines,
    stagnantKeywords,
    allKeywords: keywordsWithVelocity,
  };
};

module.exports = mongoose.model("KeywordRank", keywordRankSchema);
