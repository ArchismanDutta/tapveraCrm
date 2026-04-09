const mongoose = require("mongoose");

let isConnected = false;

async function connectDB() {
  if (isConnected && mongoose.connection.readyState === 1) return;
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });
  isConnected = true;
  console.log("[Lambda] MongoDB connected");
}

// ── SerpApiUsage ──────────────────────────────────────────────────────────────

const serpApiUsageSchema = new mongoose.Schema({
  month: { type: String, required: true, unique: true },
  used:  { type: Number, default: 0 },
  limit: { type: Number, default: 100 },
});

const SerpApiUsage = mongoose.models.SerpApiUsage
  || mongoose.model("SerpApiUsage", serpApiUsageSchema);

SerpApiUsage.getOrCreate = async function (month) {
  const limit = parseInt(process.env.SERPAPI_MONTHLY_LIMIT || "100", 10);
  let doc = await SerpApiUsage.findOne({ month });
  if (!doc) {
    doc = await SerpApiUsage.create({ month, used: 0, limit });
  } else if (doc.limit !== limit) {
    doc.limit = limit;
    await doc.save();
  }
  return doc;
};

SerpApiUsage.increment = async function (month) {
  return SerpApiUsage.findOneAndUpdate(
    { month },
    { $inc: { used: 1 } },
    { new: true }
  );
};

// ── KeywordRank (minimal — only fields Lambda needs) ──────────────────────────

const keywordRankSchema = new mongoose.Schema(
  {
    project:        { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
    keyword:        String,
    targetUrl:      String,
    searchEngine:   String,
    fetchFrequency: String,
    isActive:       Boolean,
    city:           { type: String, default: "" },
    country:        { type: String, default: "Global" },
    countryCode:    { type: String, default: "" },
    device:         { type: String, default: "desktop" },
    priority:       { type: String, default: "normal" },
    rankHistory: [{
      rank:         Number,
      recordedAt:   { type: Date, default: Date.now },
      notes:        String,
      source:       String,
      device:       String,
      serpSnapshot: mongoose.Schema.Types.Mixed,
    }],
  },
  { strict: false }
);

const KeywordRank = mongoose.models.KeywordRank
  || mongoose.model("KeywordRank", keywordRankSchema);

// ── Project (minimal — for notification population) ───────────────────────────

const projectSchema = new mongoose.Schema(
  { projectName: String, assignedTo: [mongoose.Schema.Types.ObjectId] },
  { strict: false }
);

mongoose.models.Project || mongoose.model("Project", projectSchema);

module.exports = { connectDB, SerpApiUsage, KeywordRank };
