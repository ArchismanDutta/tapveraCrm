// Test with TODAY's date
const mongoose = require('mongoose');
const User = require('../models/User');
const AttendanceService = require('../services/AttendanceService');
require('dotenv').config();

async function testRealTime() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const attendanceService = new AttendanceService();

    // Find a night shift user
    const user = await User.findOne({ name: /Sanmoy/i });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('='  .repeat(100));
    console.log(`👤 Testing for: ${user.name}`);
    console.log('='  .repeat(100));

    // Get user's shift for TODAY
    const today = new Date();
    const userShift = await attendanceService.getUserShift(user._id, today);

    console.log('\n🕐 User Shift Configuration:');
    console.log(`   Shift: ${userShift?.startTime} - ${userShift?.endTime}`);
    console.log(`   Name: ${userShift?.name}`);
    console.log(`   Type: ${userShift?.type}`);

    // SIMULATE: Punch in at 6 PM today (2 hours before 8 PM night shift)
    const now = new Date();
    now.setHours(18, 0, 0, 0); // 6 PM today

    console.log('\n\n' + '='.repeat(100));
    console.log('🧪 SIMULATING PUNCH IN:');
    console.log(`   Current time: ${now.toLocaleString()}`);
    console.log(`   Expected: Employee punching in at 6 PM for 8 PM night shift → NOT late`);
    console.log('='  .repeat(100));

    console.log('\n\n📅 STEP 1: Determine attendance date');
    const attendanceDate = attendanceService.getAttendanceDateForPunch(now, userShift);
    console.log(`   Punch time: ${now.toLocaleString()}`);
    console.log(`   Assigned to date: ${attendanceDate.toISOString().split('T')[0]}`);

    console.log('\n\n🕐 STEP 2: Calculate if late');
    const isLate = attendanceService.calculateIsLate(now, userShift);
    console.log(`   Arrival: ${now.toLocaleString()}`);
    console.log(`   Shift start: ${userShift?.startTime}`);
    console.log(`   Is late: ${isLate}`);

    if (isLate) {
      console.log('\n\n❌ BUG: Employee punching in at 6 PM for 8 PM shift shows as LATE');
    } else {
      console.log('\n\n✅ CORRECT: Employee punching in at 6 PM for 8 PM shift shows as NOT LATE');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

testRealTime();
