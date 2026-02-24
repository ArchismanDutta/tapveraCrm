// jobs/cronJobs.js
const cron = require("node-cron");
const { cleanupOldMedia } = require("../services/mediaCleanupService");
const dailyChatNotificationService = require("../services/dailyChatNotificationService");
const vicidialService = require("../services/vicidialService");
const callAnalysisService = require("../services/callAnalysisService");

/**
 * Initialize all cron jobs
 */
function initializeCronJobs() {
  console.log("📅 Initializing cron jobs...");

  // Run media cleanup daily at 2:00 AM
  // Cron format: minute hour day month weekday
  // "0 2 * * *" = Every day at 2:00 AM
  cron.schedule("0 2 * * *", async () => {
    console.log("⏰ Running scheduled media cleanup...");
    await cleanupOldMedia();
  });

  // Run chat notification cleanup daily at 3:00 AM
  // Removes notifications older than 30 days
  cron.schedule("0 3 * * *", async () => {
    console.log("⏰ Running scheduled chat notification cleanup...");
    await dailyChatNotificationService.cleanupOldNotifications();
  });

  // Sync recordings from Vicidial every 2 hours
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

  // Process pending AI analysis every 2 hours (30 min offset from sync)
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

  console.log("Cron jobs initialized successfully!");
  console.log("   - Media cleanup: Daily at 2:00 AM");
  console.log("   - Chat notification cleanup: Daily at 3:00 AM");
  console.log("   - Vicidial recording sync: Every 2 hours at :00");
  console.log("   - Call analysis processing: Every 2 hours at :30");
}

/**
 * Run cleanup immediately (for testing or manual trigger)
 */
async function runManualCleanup() {
  console.log("🔧 Running manual media cleanup...");
  return await cleanupOldMedia();
}

module.exports = {
  initializeCronJobs,
  runManualCleanup,
};
