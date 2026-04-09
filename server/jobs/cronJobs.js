// jobs/cronJobs.js
const cron = require("node-cron");
const { cleanupOldMedia } = require("../services/mediaCleanupService");
const dailyChatNotificationService = require("../services/dailyChatNotificationService");
const vicidialService  = require("../services/vicidialService");
const callAnalysisService = require("../services/callAnalysisService");
const KeywordRank      = require("../models/KeywordRank");
const hybridRankService = require("../services/hybridRankService");

// ─── Keyword rank fetch ────────────────────────────────────────────────────────

/**
 * Fetch and update ranks for all active Google keywords matching a given frequency tier.
 * @param {"daily"|"weekly"|"monthly"} frequency
 */
async function runKeywordRankFetch(frequency) {
  try {
    const keywords = await KeywordRank.find({
      isActive:       true,
      searchEngine:   "Google",
      fetchFrequency: frequency,
    });

    if (keywords.length === 0) {
      console.log(`[KeywordRank] No active ${frequency} keywords found.`);
      return { serp: 0, scrape: 0, cached: 0, skipped: 0, errors: 0, noTargetUrl: 0 };
    }

    console.log(`[KeywordRank] ${frequency} fetch started — ${keywords.length} keywords.`);
    const stats = await hybridRankService.fetchBatch(keywords, null);
    console.log(
      `[KeywordRank] ${frequency} fetch complete — ` +
      `SerpAPI: ${stats.serp}, Scraped: ${stats.scrape}, ` +
      `Cached: ${stats.cached}, Skipped: ${stats.skipped}, ` +
      `Errors: ${stats.errors}, No URL: ${stats.noTargetUrl}`
    );
    return stats;
  } catch (err) {
    console.error(`[KeywordRank] ${frequency} fetch failed:`, err.message);
    return { serp: 0, scrape: 0, cached: 0, skipped: 0, errors: 1, noTargetUrl: 0 };
  }
}

/**
 * Fetch ALL active Google keywords regardless of their frequency tier.
 * Used for the bi-monthly scheduled runs (15th and 27th of each month).
 */
async function runAllKeywordsFetch() {
  try {
    const keywords = await KeywordRank.find({
      isActive:     true,
      searchEngine: "Google",
    });

    if (keywords.length === 0) {
      console.log("[KeywordRank] Bi-monthly fetch — no active keywords found.");
      return { serp: 0, scrape: 0, cached: 0, skipped: 0, errors: 0, noTargetUrl: 0 };
    }

    console.log(`[KeywordRank] Bi-monthly fetch started — ${keywords.length} keywords.`);
    const stats = await hybridRankService.fetchBatch(keywords, null);
    console.log(
      `[KeywordRank] Bi-monthly fetch complete — ` +
      `SerpAPI: ${stats.serp}, Scraped: ${stats.scrape}, ` +
      `Cached: ${stats.cached}, Skipped: ${stats.skipped}, ` +
      `Errors: ${stats.errors}, No URL: ${stats.noTargetUrl}`
    );
    return stats;
  } catch (err) {
    console.error("[KeywordRank] Bi-monthly fetch failed:", err.message);
    return { serp: 0, scrape: 0, cached: 0, skipped: 0, errors: 1, noTargetUrl: 0 };
  }
}

// ─── Initialize all cron jobs ─────────────────────────────────────────────────

function initializeCronJobs() {
  console.log("Initializing cron jobs...");

  // Media cleanup — daily at 2:00 AM
  cron.schedule("0 2 * * *", async () => {
    console.log("Running scheduled media cleanup...");
    await cleanupOldMedia();
  });

  // Chat notification cleanup — daily at 3:00 AM
  cron.schedule("0 3 * * *", async () => {
    console.log("Running scheduled chat notification cleanup...");
    await dailyChatNotificationService.cleanupOldNotifications();
  });

  // Vicidial recording sync — every 2 hours at :00
  cron.schedule("0 */2 * * *", async () => {
    try {
      if (vicidialService.isConfigured()) {
        console.log("Running scheduled Vicidial recording sync...");
        const result = await vicidialService.syncRecordings();
        console.log(`Vicidial sync complete: ${result.synced} synced, ${result.skipped} skipped, ${result.errors} errors`);
      }
    } catch (error) {
      console.error("Vicidial sync failed:", error.message);
    }
  });

  // AI call analysis — every 2 hours at :30
  cron.schedule("30 */2 * * *", async () => {
    try {
      if (callAnalysisService.isConfigured()) {
        console.log("Running scheduled call analysis processing...");
        const result = await callAnalysisService.processPendingRecordings(10);
        console.log(`Analysis complete: ${result.processed} processed, ${result.failed} failed`);
      }
    } catch (error) {
      console.error("Call analysis processing failed:", error.message);
    }
  });

  // Keyword rank — 15th of every month at 6:00 AM
  cron.schedule("0 6 15 * *", async () => {
    console.log("[KeywordRank] Bi-monthly fetch triggered (15th)...");
    await runAllKeywordsFetch();
  });

  // Keyword rank — 27th of every month at 6:00 AM
  cron.schedule("0 6 27 * *", async () => {
    console.log("[KeywordRank] Bi-monthly fetch triggered (27th)...");
    await runAllKeywordsFetch();
  });

  console.log("Cron jobs initialized successfully!");
  console.log("   - Media cleanup:                  Daily at 2:00 AM");
  console.log("   - Chat notification cleanup:       Daily at 3:00 AM");
  console.log("   - Vicidial recording sync:         Every 2 hours at :00");
  console.log("   - Call analysis processing:        Every 2 hours at :30");
  console.log("   - Keyword rank fetch (bi-monthly): 15th and 27th at 6:00 AM");
}

// ─── Manual triggers (for testing / admin routes) ─────────────────────────────

async function runManualCleanup() {
  console.log("Running manual media cleanup...");
  return await cleanupOldMedia();
}

module.exports = {
  initializeCronJobs,
  runManualCleanup,
  runKeywordRankFetch,
  runAllKeywordsFetch,
};
