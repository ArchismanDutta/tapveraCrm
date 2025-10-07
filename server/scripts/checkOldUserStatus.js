// scripts/checkOldUserStatus.js
// Check OLD UserStatus model for attendance data

const mongoose = require('mongoose');
const User = require('../models/User');
const UserStatus = require('../models/UserStatus');
require('dotenv').config();

async function checkOldUserStatus() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get a night shift user
    const user = await User.findOne({ name: /Sanmoy/i });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('='  .repeat(100));
    console.log(`👤 Checking OLD UserStatus records for: ${user.name} (${user.email})`);
    console.log('='  .repeat(100));

    // Get user's shift
    const effectiveShift = await user.getEffectiveShift(new Date());
    console.log('\n🕐 User Shift Configuration:');
    console.log(`   Shift Start: ${effectiveShift?.start || 'N/A'}`);
    console.log(`   Shift End: ${effectiveShift?.end || 'N/A'}`);

    // Get recent UserStatus records
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 7); // Last 7 days

    const statuses = await UserStatus.find({
      userId: user._id,
      today: { $gte: recentDate }
    }).sort({ today: -1 });

    console.log(`\n📅 UserStatus Records (Last 7 days): ${statuses.length} found\n`);

    if (statuses.length === 0) {
      console.log('❌ No UserStatus records found in last 7 days');
      console.log('   This user may not have punched in recently, OR');
      console.log('   The system is already using the new AttendanceRecord model');
      return;
    }

    for (const status of statuses) {
      const dateStr = status.today.toISOString().split('T')[0];
      console.log(`\n${'='.repeat(100)}`);
      console.log(`📅 Date: ${dateStr}`);
      console.log(`${'='.repeat(100)}`);

      console.log('\n📊 Status Data:');
      console.log(`   Arrival Time: ${status.arrivalTime ? new Date(status.arrivalTime).toLocaleString() : 'N/A'}`);
      console.log(`   Currently Working: ${status.currentlyWorking ? '✅' : '❌'}`);
      console.log(`   On Break: ${status.onBreak ? '⚠️' : '✅'}`);
      console.log(`   Work Duration: ${status.workDuration || 'N/A'}`);
      console.log(`   Break Duration: ${status.breakDuration || 'N/A'}`);
      console.log(`   Is Late: ${status.isLate ? '⚠️  YES' : '✅ NO'}`);
      console.log(`   Is Half Day: ${status.isHalfDay ? '⚠️  YES' : '✅ NO'}`);
      console.log(`   Is Absent: ${status.isAbsent ? '❌ YES' : '✅ NO'}`);

      // Check timeline
      console.log('\n📜 Timeline:');
      if (status.timeline && status.timeline.length > 0) {
        status.timeline.forEach((event, idx) => {
          const time = new Date(event.time);
          console.log(`   ${idx + 1}. ${event.type} - ${time.toLocaleString()}`);
        });
      } else {
        console.log('   No timeline events');
      }

      // Late detection analysis
      if (status.isLate && status.arrivalTime) {
        console.log('\n🔍 Late Detection Analysis (OLD SYSTEM):');
        const arrival = new Date(status.arrivalTime);
        const shiftStart = effectiveShift?.start || '09:00';
        const [hour, min] = shiftStart.split(':').map(Number);
        const expectedStart = new Date(arrival);
        expectedStart.setHours(hour, min, 0, 0);

        console.log(`   Arrival Time: ${arrival.toLocaleString()}`);
        console.log(`   Expected Shift Start: ${shiftStart} (${expectedStart.toLocaleString()})`);
        console.log(`   Late By: ${Math.round((arrival - expectedStart) / 60000)} minutes`);

        if (shiftStart === '20:00') {
          console.log(`   ⚠️  This is a NIGHT SHIFT user (starts at 20:00)`);
          if (arrival.getHours() < 20) {
            console.log(`   ❌ BUG DETECTED: Arrived before 20:00 but marked as late!`);
            console.log(`   This suggests the OLD system was using wrong shift time`);
          }
        }
      }
    }

    console.log('\n\n');
    console.log('='  .repeat(100));
    console.log('✅ Check Complete');
    console.log('='  .repeat(100));

    // Summary
    const lateCount = statuses.filter(s => s.isLate).length;
    const presentCount = statuses.filter(s => !s.isAbsent).length;

    console.log('\n📊 Summary (OLD UserStatus):');
    console.log(`   Total Records: ${statuses.length}`);
    console.log(`   Present Days: ${presentCount}`);
    console.log(`   Late Days: ${lateCount}`);
    console.log(`   Late Percentage: ${presentCount > 0 ? ((lateCount / presentCount) * 100).toFixed(1) : 0}%`);

    console.log('\n💡 Note: This is from the OLD UserStatus model.');
    console.log('   The NEW system should be using AttendanceRecord instead.');
    console.log('   If you see high late percentages here, it was an issue with the old system.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

// Run the script
checkOldUserStatus();
