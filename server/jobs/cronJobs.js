// jobs/cronJobs.js
const cron = require("node-cron");
const { cleanupOldMedia } = require("../services/mediaCleanupService");

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

  console.log("✅ Cron jobs initialized successfully!");
  console.log("   - Media cleanup: Daily at 2:00 AM");
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
