// Test night shift late detection with FIX
// This script tests the exact scenario the user described

const mongoose = require('mongoose');
const User = require('../models/User');
const Shift = require('../models/Shift');
const AttendanceService = require('../services/AttendanceService');
require('dotenv').config();

async function testNightShiftScenario() {
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
    console.log(`👤 Testing for: ${user.name} (${user.email})`);
    console.log('='  .repeat(100));

    // Get user's shift
    const userShift = await attendanceService.getUserShift(user._id, new Date());
    console.log('\n🕐 User Shift Configuration:');
    console.log(`   Shift: ${userShift?.startTime} - ${userShift?.endTime}`);

    // TEST SCENARIO 1: Night shift employee working on Sept 10
    // Shift: 20:00 (Sept 10) → 05:00 (Sept 11)
    // Employee punches in at 18:00 (Sept 10) - 2 hours EARLY

    console.log('\n\n' + '='.repeat(100));
    console.log('🧪 TEST SCENARIO 1:');
    console.log('   Night shift: 20:00 (Sept 10) → 05:00 (Sept 11)');
    console.log('   Employee punches in: 18:00 (Sept 10) - 2 hours EARLY');
    console.log('   EXPECTED: NOT late');
    console.log('='.repeat(100));

    // Create a test date: Sept 10, 2024 at 18:00 (6 PM)
    const punchTime = new Date('2024-09-10T18:00:00');

    console.log('\n\n📅 STEP 1: Determine attendance date');
    console.log('   Punch time:', punchTime.toLocaleString());

    const attendanceDate = attendanceService.getAttendanceDateForPunch(punchTime, userShift);
    console.log('   Assigned to date:', attendanceDate.toISOString().split('T')[0]);

    console.log('\n\n🕐 STEP 2: Calculate if late (WITH ATTENDANCE DATE)');
    console.log('   Arrival time:', punchTime.toLocaleString());
    console.log('   Shift start time:', userShift?.startTime);
    console.log('   Attendance date:', attendanceDate.toISOString().split('T')[0]);

    const isLate = attendanceService.calculateIsLate(punchTime, userShift, attendanceDate);
    console.log('   Result: isLate =', isLate);

    if (isLate) {
      console.log('\n\n❌ BUG STILL EXISTS!');
      console.log('   Employee punched in at 18:00 (6 PM)');
      console.log('   Shift starts at 20:00 (8 PM)');
      console.log('   System says: LATE ❌');
      console.log('   Should say: NOT LATE ✅');
    } else {
      console.log('\n\n✅ WORKING CORRECTLY!');
      console.log('   Employee punched in at 18:00 (6 PM)');
      console.log('   Shift starts at 20:00 (8 PM)');
      console.log('   System says: NOT LATE ✅');
    }

    // TEST SCENARIO 2: Punch at 22:00 (actually late)
    console.log('\n\n' + '='.repeat(100));
    console.log('🧪 TEST SCENARIO 2:');
    console.log('   Night shift: 20:00 (Sept 10) → 05:00 (Sept 11)');
    console.log('   Employee punches in: 22:00 (Sept 10) - 2 hours LATE');
    console.log('   EXPECTED: LATE');
    console.log('='.repeat(100));

    const punchTime2 = new Date('2024-09-10T22:00:00');

    console.log('\n\n📅 STEP 1: Determine attendance date');
    console.log('   Punch time:', punchTime2.toLocaleString());

    const attendanceDate2 = attendanceService.getAttendanceDateForPunch(punchTime2, userShift);
    console.log('   Assigned to date:', attendanceDate2.toISOString().split('T')[0]);

    console.log('\n\n🕐 STEP 2: Calculate if late (WITH ATTENDANCE DATE)');
    console.log('   Arrival time:', punchTime2.toLocaleString());
    console.log('   Shift start time:', userShift?.startTime);
    console.log('   Attendance date:', attendanceDate2.toISOString().split('T')[0]);

    const isLate2 = attendanceService.calculateIsLate(punchTime2, userShift, attendanceDate2);
    console.log('   Result: isLate =', isLate2);

    if (isLate2) {
      console.log('\n\n✅ WORKING CORRECTLY!');
      console.log('   Employee punched in at 22:00 (10 PM)');
      console.log('   Shift starts at 20:00 (8 PM)');
      console.log('   System says: LATE ✅');
    } else {
      console.log('\n\n❌ BUG!');
      console.log('   Employee punched in at 22:00 (10 PM)');
      console.log('   Shift starts at 20:00 (8 PM)');
      console.log('   System says: NOT LATE ❌');
      console.log('   Should say: LATE ✅');
    }

    // TEST SCENARIO 3: Early morning punch (02:00 AM) - THE CRITICAL FIX
    console.log('\n\n' + '='.repeat(100));
    console.log('🧪 TEST SCENARIO 3: (CRITICAL - Night shift spanning midnight)');
    console.log('   Night shift: 20:00 (Sept 10) → 05:00 (Sept 11)');
    console.log('   Employee punches in: 02:00 (Sept 11) - During shift');
    console.log('   EXPECTED: LATE (arrived 6 hours after shift start)');
    console.log('='.repeat(100));

    const punchTime3 = new Date('2024-09-11T02:00:00');

    console.log('\n\n📅 STEP 1: Determine attendance date');
    console.log('   Punch time:', punchTime3.toLocaleString());

    const attendanceDate3 = attendanceService.getAttendanceDateForPunch(punchTime3, userShift);
    console.log('   Assigned to date:', attendanceDate3.toISOString().split('T')[0]);

    console.log('\n\n🕐 STEP 2: Calculate if late (WITH ATTENDANCE DATE - THIS IS THE FIX!)');
    console.log('   Arrival time:', punchTime3.toLocaleString());
    console.log('   Shift start time:', userShift?.startTime);
    console.log('   Attendance date:', attendanceDate3.toISOString().split('T')[0]);
    console.log('   ⚡ The fix: Using attendance date (Sept 10) not punch date (Sept 11)');

    const isLate3 = attendanceService.calculateIsLate(punchTime3, userShift, attendanceDate3);
    console.log('   Result: isLate =', isLate3);

    if (isLate3) {
      console.log('\n\n✅ FIX WORKING!');
      console.log('   Employee punched in at 02:00 AM (Sept 11)');
      console.log('   Shift started at 20:00 (Sept 10)');
      console.log('   System correctly calculates shift start as Sept 10 20:00');
      console.log('   System says: LATE ✅');
    } else {
      console.log('\n\n❌ FIX NOT WORKING!');
      console.log('   Employee punched in at 02:00 AM (Sept 11)');
      console.log('   Shift started at 20:00 (Sept 10)');
      console.log('   System says: NOT LATE ❌');
      console.log('   Should say: LATE (6 hours late) ✅');
    }

    // SUMMARY
    console.log('\n\n' + '='.repeat(100));
    console.log('📊 TEST SUMMARY:');
    console.log('='.repeat(100));
    console.log(`   Test 1 (Punch early): ${isLate ? '❌ FAIL' : '✅ PASS'}`);
    console.log(`   Test 2 (Punch late): ${isLate2 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Test 3 (After midnight): ${isLate3 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`\n   Overall: ${!isLate && isLate2 && isLate3 ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

// Run the test
testNightShiftScenario();
