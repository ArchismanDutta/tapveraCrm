const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

async function debugEarlyPunchIn() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const User = require('../models/User');
    const Shift = require('../models/Shift');
    const AttendanceService = require('../services/AttendanceService');

    const service = new AttendanceService();

    // Find users with early morning shifts (5:30 AM shift)
    const shifts = await Shift.find({}).lean();
    console.log('=== ALL SHIFTS IN DATABASE ===\n');
    shifts.forEach(shift => {
      console.log(`Shift: ${shift.name}`);
      console.log(`  Start: ${shift.start}, End: ${shift.end}`);
      console.log(`  Type: ${shift.type || 'standard'}`);
      console.log(`  Duration: ${shift.durationHours} hours`);
      console.log('');
    });

    // Find the early morning shift
    const earlyShift = shifts.find(s => s.start === '05:30' || s.start === '5:30');

    if (!earlyShift) {
      console.log('❌ No 5:30 AM shift found in database!');
      console.log('\nAvailable shift start times:', shifts.map(s => s.start).join(', '));
    } else {
      console.log('✅ Found 5:30 AM shift:', earlyShift.name);
      console.log('');
    }

    // Find users assigned to early morning shift
    const earlyMorningUsers = await User.find({
      assignedShift: earlyShift?._id,
      status: 'active'
    }).select('name email employeeId assignedShift shiftType').lean();

    console.log('\n=== USERS WITH 5:30 AM SHIFT ===\n');
    console.log(`Found ${earlyMorningUsers.length} users with early morning shift`);
    earlyMorningUsers.forEach(user => {
      console.log(`- ${user.name} (${user.employeeId}) - ${user.email}`);
    });

    if (earlyMorningUsers.length === 0) {
      console.log('\n⚠️  No users found with 5:30 AM shift!');
    }

    // Test punch-in validation at different times
    console.log('\n=== TESTING PUNCH-IN VALIDATION ===\n');

    if (earlyShift) {
      const testShiftObj = {
        startTime: earlyShift.start,
        endTime: earlyShift.end,
        isFlexible: false,
        name: earlyShift.name
      };

      // Test various punch-in times
      const testTimes = [
        { time: '01:00', desc: '1:00 AM (4.5 hours early)' },
        { time: '02:00', desc: '2:00 AM (3.5 hours early)' },
        { time: '02:30', desc: '2:30 AM (3 hours early - should be allowed)' },
        { time: '03:00', desc: '3:00 AM (2.5 hours early)' },
        { time: '04:00', desc: '4:00 AM (1.5 hours early)' },
        { time: '05:00', desc: '5:00 AM (30 mins early)' },
        { time: '05:30', desc: '5:30 AM (exact shift time)' },
        { time: '06:00', desc: '6:00 AM (30 mins late)' }
      ];

      const today = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000; // 5:30 in milliseconds

      for (const test of testTimes) {
        const [hour, minute] = test.time.split(':').map(Number);

        // Create a UTC timestamp that when converted to IST will show the desired IST time
        // IST = UTC + 5:30, so if we want 2:00 AM IST, we need (2:00 - 5:30) UTC = 20:30 UTC previous day
        // First create an IST date object
        const istMoment = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour, minute, 0);

        // Convert to UTC by subtracting 5:30 hours (IST offset)
        const utcTimestamp = istMoment.getTime() - istOffset;
        const utcDate = new Date(utcTimestamp);

        console.log(`\nTesting: ${test.desc}`);
        console.log(`  IST time intended: ${hour}:${minute}`);
        console.log(`  UTC timestamp: ${utcDate.toISOString()}`);

        try {
          service.validateEarlyPunchIn(utcDate, testShiftObj);
          console.log(`  ✅ RESULT: ALLOWED\n`);
        } catch (error) {
          console.log(`  ❌ RESULT: BLOCKED`);
          console.log(`  Error: ${error.message}\n`);
        }
      }
    }

    // Check the actual EARLY_PUNCH_IN_WINDOW_MINUTES constant
    console.log('\n=== ATTENDANCE SERVICE CONFIG ===\n');
    console.log(`Early punch-in window: ${service.CONSTANTS.EARLY_PUNCH_IN_WINDOW_MINUTES} minutes (${service.CONSTANTS.EARLY_PUNCH_IN_WINDOW_MINUTES / 60} hours)`);
    console.log(`Early punch-in allowed: ${service.CONSTANTS.EARLY_PUNCH_IN_ALLOWED}`);
    console.log('');

    // Check if there are any users without assigned shifts
    const usersWithoutShift = await User.find({
      status: 'active',
      $or: [
        { assignedShift: null },
        { assignedShift: { $exists: false } }
      ]
    }).select('name email employeeId role').lean();

    if (usersWithoutShift.length > 0) {
      console.log('\n=== USERS WITHOUT ASSIGNED SHIFT ===\n');
      console.log(`Found ${usersWithoutShift.length} active users without assigned shift:`);
      usersWithoutShift.forEach(user => {
        console.log(`- ${user.name} (${user.employeeId}) - ${user.role}`);
      });
    }

    mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

debugEarlyPunchIn();
