// Script to cleanup corrupted work sessions in UserStatus collection
const mongoose = require('mongoose');
const UserStatus = require('../models/UserStatus');

// Load environment variables
require('dotenv').config();

async function cleanupCorruptedSessions() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/tapveracrm');
    console.log('📡 Connected to MongoDB');

    // Get all UserStatus documents
    const allStatuses = await UserStatus.find({});
    console.log(`📊 Found ${allStatuses.length} UserStatus records to check`);

    let totalFixed = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    for (const status of allStatuses) {
      let needsUpdate = false;
      const originalWorkSessions = status.workedSessions?.length || 0;
      const originalBreakSessions = status.breakSessions?.length || 0;

      // Clean work sessions - only keep today's sessions
      if (status.workedSessions && Array.isArray(status.workedSessions)) {
        const cleanWorkSessions = status.workedSessions.filter(session => {
          if (!session || !session.start) return false;
          const sessionStart = new Date(session.start);
          return sessionStart >= today && sessionStart <= todayEnd;
        });

        if (cleanWorkSessions.length !== status.workedSessions.length) {
          status.workedSessions = cleanWorkSessions;
          needsUpdate = true;
          console.log(`🧹 User ${status.userId}: Removed ${originalWorkSessions - cleanWorkSessions.length} old work sessions`);
        }
      }

      // Clean break sessions - only keep today's sessions
      if (status.breakSessions && Array.isArray(status.breakSessions)) {
        const cleanBreakSessions = status.breakSessions.filter(session => {
          if (!session || !session.start) return false;
          const sessionStart = new Date(session.start);
          return sessionStart >= today && sessionStart <= todayEnd;
        });

        if (cleanBreakSessions.length !== status.breakSessions.length) {
          status.breakSessions = cleanBreakSessions;
          needsUpdate = true;
          console.log(`🧹 User ${status.userId}: Removed ${originalBreakSessions - cleanBreakSessions.length} old break sessions`);
        }
      }

      // Recalculate work duration seconds based on clean sessions
      if (needsUpdate) {
        let newWorkDurationSeconds = 0;

        // Calculate from clean work sessions
        if (status.workedSessions && status.workedSessions.length > 0) {
          for (const session of status.workedSessions) {
            if (session.start && session.end) {
              const sessionDuration = (new Date(session.end) - new Date(session.start)) / 1000;
              newWorkDurationSeconds += Math.min(sessionDuration, 86400); // Cap at 24 hours
            } else if (session.start && !session.end && status.currentlyWorking) {
              // Ongoing session
              const ongoingDuration = (Date.now() - new Date(session.start)) / 1000;
              newWorkDurationSeconds += Math.min(ongoingDuration, 86400); // Cap at 24 hours
            }
          }
        }

        const oldWorkDuration = status.workDurationSeconds || 0;
        status.workDurationSeconds = Math.floor(newWorkDurationSeconds);
        status.totalWorkMs = status.workDurationSeconds * 1000;

        // Update work duration string format
        const hours = Math.floor(status.workDurationSeconds / 3600);
        const minutes = Math.floor((status.workDurationSeconds % 3600) / 60);
        status.workDuration = `${hours}h ${minutes}m`;

        console.log(`🔧 User ${status.userId}: Work duration ${(oldWorkDuration/3600).toFixed(1)}h → ${(status.workDurationSeconds/3600).toFixed(1)}h`);

        // Save the updated status
        await status.save();
        totalFixed++;
      }
    }

    console.log(`✅ Cleanup complete! Fixed ${totalFixed} UserStatus records`);
    console.log(`📅 Only sessions from today (${today.toDateString()}) were retained`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the cleanup
if (require.main === module) {
  console.log('🚀 Starting UserStatus session cleanup...');
  cleanupCorruptedSessions();
}

module.exports = cleanupCorruptedSessions;