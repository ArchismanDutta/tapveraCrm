// scripts/testNewAttendanceSystem.js
// Simple test script for the new date-centric attendance system

const mongoose = require('mongoose');
require('dotenv').config();

const AttendanceService = require('../services/AttendanceService');
const User = require('../models/User');

async function testNewAttendanceSystem() {
  try {
    console.log('🧪 Testing New Date-Centric Attendance System\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✓ Connected to database');

    const attendanceService = new AttendanceService();

    // Get a test user (first user in database)
    const testUser = await User.findOne();
    if (!testUser) {
      console.log('❌ No users found in database. Please create a user first.');
      return;
    }

    console.log(`✓ Using test user: ${testUser.name} (${testUser.email})`);

    const userId = testUser._id;
    const today = new Date();

    // Test 1: Punch In
    console.log('\n📍 Test 1: Punch In');
    try {
      const punchInResult = await attendanceService.recordPunchEvent(userId, 'PUNCH_IN', {
        location: 'Test Office',
        ipAddress: '192.168.1.100',
        device: 'Test Device'
      });
      console.log('✓ Punch in successful');
      console.log(`   Status: ${punchInResult.employee.calculated.currentStatus}`);
      console.log(`   Work Duration: ${punchInResult.employee.calculated.workDuration}`);
    } catch (error) {
      console.log(`❌ Punch in failed: ${error.message}`);
    }

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: Break Start
    console.log('\n☕ Test 2: Break Start');
    try {
      const breakStartResult = await attendanceService.recordPunchEvent(userId, 'BREAK_START', {
        location: 'Break Room'
      });
      console.log('✓ Break start successful');
      console.log(`   Status: ${breakStartResult.employee.calculated.currentStatus}`);
      console.log(`   Work Duration: ${breakStartResult.employee.calculated.workDuration}`);
    } catch (error) {
      console.log(`❌ Break start failed: ${error.message}`);
    }

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 3: Break End
    console.log('\n🔄 Test 3: Break End');
    try {
      const breakEndResult = await attendanceService.recordPunchEvent(userId, 'BREAK_END', {
        location: 'Office Desk'
      });
      console.log('✓ Break end successful');
      console.log(`   Status: ${breakEndResult.employee.calculated.currentStatus}`);
      console.log(`   Break Duration: ${breakEndResult.employee.calculated.breakDuration}`);
    } catch (error) {
      console.log(`❌ Break end failed: ${error.message}`);
    }

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 4: Punch Out
    console.log('\n📤 Test 4: Punch Out');
    try {
      const punchOutResult = await attendanceService.recordPunchEvent(userId, 'PUNCH_OUT', {
        location: 'Office Exit'
      });
      console.log('✓ Punch out successful');
      console.log(`   Status: ${punchOutResult.employee.calculated.currentStatus}`);
      console.log(`   Total Work: ${punchOutResult.employee.calculated.workDuration}`);
      console.log(`   Total Break: ${punchOutResult.employee.calculated.breakDuration}`);
    } catch (error) {
      console.log(`❌ Punch out failed: ${error.message}`);
    }

    // Test 5: Get Employee Attendance
    console.log('\n📊 Test 5: Get Employee Attendance');
    try {
      const attendance = await attendanceService.getEmployeeAttendance(userId, today, today);
      console.log('✓ Retrieved attendance data');
      console.log(`   Today's status: ${attendance.data[0]?.currentStatus || 'No data'}`);
      console.log(`   Events recorded: ${attendance.data[0]?.events?.length || 0}`);
    } catch (error) {
      console.log(`❌ Get attendance failed: ${error.message}`);
    }

    // Test 6: Get Daily Report
    console.log('\n📋 Test 6: Get Daily Report');
    try {
      const dailyReport = await attendanceService.getDailyReport(today);
      console.log('✓ Retrieved daily report');
      console.log(`   Total employees: ${dailyReport.stats.totalEmployees}`);
      console.log(`   Present: ${dailyReport.stats.present}`);
      console.log(`   Absent: ${dailyReport.stats.absent}`);
      console.log(`   Average work hours: ${dailyReport.stats.averageWorkHours.toFixed(2)}`);
    } catch (error) {
      console.log(`❌ Get daily report failed: ${error.message}`);
    }

    console.log('\n✅ All tests completed successfully!');
    console.log('\n📝 Next Steps:');
    console.log('1. Run the migration script to convert your existing data');
    console.log('2. Update your frontend to use the new API endpoints');
    console.log('3. Test thoroughly before switching from the old system');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('\n✓ Database connection closed');
    }
  }
}

// Run if called directly
if (require.main === module) {
  testNewAttendanceSystem().catch(console.error);
}

module.exports = testNewAttendanceSystem;