/**
 * Internal webhook routes — called by AWS Lambda, not the frontend.
 * All routes are protected by a shared secret header (x-internal-secret).
 * Mount at: app.use("/api/internal", internalRoutes)
 */
const express             = require("express");
const router              = express.Router();
const notificationService = require("../services/notificationService");

function verifySecret(req, res, next) {
  const secret = process.env.INTERNAL_WEBHOOK_SECRET;
  if (!secret || req.headers["x-internal-secret"] !== secret) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

// POST /api/internal/rank-alert
// Called by the keyword-rank-fetcher Lambda when a keyword drops ≥ 3 positions.
router.post("/rank-alert", verifySecret, async (req, res) => {
  const { keywordId, keyword, projectName, assignedTo, prevRank, newRank, drop, city, country } = req.body;

  if (!keyword || !Array.isArray(assignedTo)) {
    return res.status(400).json({ message: "Invalid payload" });
  }

  const location = city || country || "Global";
  const title    = `Rank Drop Alert: "${keyword}"`;
  const body     = `"${keyword}" dropped ${drop} positions (${prevRank} → ${newRank}) in ${location}. Priority auto-set to HIGH.`;

  const results = await Promise.allSettled(
    assignedTo.map((userId) =>
      notificationService.createAndSend({
        userId,
        type:     "rank_drop_alert",
        channel:  "keyword_rank",
        title,
        body,
        priority: "high",
        relatedData: { keywordId, projectName, keyword, prevRank, newRank, drop },
      })
    )
  );

  const sent   = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  console.log(`[Internal] rank-alert for "${keyword}": sent=${sent}, failed=${failed}`);
  res.json({ success: true, sent, failed });
});

module.exports = router;
