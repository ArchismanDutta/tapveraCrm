const mongoose = require("mongoose");

const serpApiUsageSchema = new mongoose.Schema({
  month: { type: String, required: true, unique: true }, // "2026-04"
  used:  { type: Number, default: 0 },
  limit: { type: Number, default: 100 },
});

// Get or create the usage document for a given month.
// Syncs the limit from the SERPAPI_MONTHLY_LIMIT env var on every call.
serpApiUsageSchema.statics.getOrCreate = async function (month) {
  const limit = parseInt(process.env.SERPAPI_MONTHLY_LIMIT || "100", 10);
  let doc = await this.findOne({ month });
  if (!doc) {
    doc = await this.create({ month, used: 0, limit });
  } else if (doc.limit !== limit) {
    doc.limit = limit;
    await doc.save();
  }
  return doc;
};

// Atomically increment usage count for a month.
serpApiUsageSchema.statics.increment = async function (month) {
  return this.findOneAndUpdate(
    { month },
    { $inc: { used: 1 } },
    { new: true }
  );
};

module.exports = mongoose.model("SerpApiUsage", serpApiUsageSchema);
