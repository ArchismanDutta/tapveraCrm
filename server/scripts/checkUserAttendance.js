// scripts/checkUserAttendance.js
// Check actual attendance data for a specific user

const mongoose = require('mongoose');
const User = require('../models/User');
const AttendanceRecord = require('../models/AttendanceRecord');
const Shift = require('../models/Shift'); // Need to load Shift model for populate to work
require('dotenv').config();

async function checkUserAttendance() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get a night shift user
    const user = await User.findOne({ name: /Sanmoy/i }).populate('assignedShift');

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('='  .repeat(100));
    console.log(`👤 Checking attendance for: ${user.name} (${user.email})`);
    console.log('='  .repeat(100));

    // Get effective shift
    const effectiveShift = await user.getEffectiveShift(new Date());
    console.log('\n🕐 User Shift Configuration:');
    console.log(`   Assigned Shift: ${user.assignedShift?.name || 'None'}`);
    console.log(`   Shift Start: ${effectiveShift?.start || 'N/A'}`);
    console.log(`   Shift End: ${effectiveShift?.end || 'N/A'}`);
    console.log(`   Shift Type: ${user.shiftType}`);

    // Get recent attendance records
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 7); // Last 7 days

    const records = await AttendanceRecord.find({
      date: { $gte: recentDate },
      'employees.userId': user._id
    }).sort({ date: -1 });

    console.log(`\n📅 Recent Attendance Records (Last 7 days): ${records.length} found\n`);

    for (const record of records) {
      const employee = record.employees.find(e => e.userId.toString() === user._id.toString());

      if (!employee) continue;

      const dateStr = record.date.toISOString().split('T')[0];
      console.log(`\n${'='.repeat(100)}`);
      console.log(`📅 Date: ${dateStr}`);
      console.log(`${'='.repeat(100)}`);

      // Check what shift was used
      console.log('\n🕐 Shift Used for This Day:');
      console.log(`   Name: ${employee.assignedShift?.name || 'N/A'}`);
      console.log(`   Start Time: ${employee.assignedShift?.startTime || 'N/A'}`);
      console.log(`   End Time: ${employee.assignedShift?.endTime || 'N/A'}`);

      // Check calculated data
      console.log('\n📊 Calculated Data:');
      console.log(`   Arrival Time: ${employee.calculated?.arrivalTime ? new Date(employee.calculated.arrivalTime).toLocaleString() : 'N/A'}`);
      console.log(`   Departure Time: ${employee.calculated?.departureTime ? new Date(employee.calculated.departureTime).toLocaleString() : 'N/A'}`);
      console.log(`   Work Duration: ${employee.calculated?.workDuration || 'N/A'}`);
      console.log(`   Break Duration: ${employee.calculated?.breakDuration || 'N/A'}`);
      console.log(`   Is Present: ${employee.calculated?.isPresent ? '✅' : '❌'}`);
      console.log(`   Is Late: ${employee.calculated?.isLate ? '⚠️  YES' : '✅ NO'}`);
      console.log(`   Is Absent: ${employee.calculated?.isAbsent ? '❌ YES' : '✅ NO'}`);
      console.log(`   Current Status: ${employee.calculated?.currentStatus || 'N/A'}`);

      // Check events
      console.log('\n📜 Events Timeline:');
      if (employee.events && employee.events.length > 0) {
        employee.events.forEach((event, idx) => {
          const time = new Date(event.timestamp);
          const manual = event.manual ? '[MANUAL]' : '';
          console.log(`   ${idx + 1}. ${event.type} - ${time.toLocaleString()} ${manual}`);
        });
      } else {
        console.log('   No events recorded');
      }

      // Late detection analysis
      if (employee.calculated?.isLate && employee.calculated?.arrivalTime && employee.assignedShift?.startTime) {
        console.log('\n🔍 Late Detection Analysis:');
        const arrival = new Date(employee.calculated.arrivalTime);
        const shiftStart = employee.assignedShift.startTime;
        const [hour, min] = shiftStart.split(':').map(Number);
        const expectedStart = new Date(arrival);
        expectedStart.setHours(hour, min, 0, 0);

        console.log(`   Arrival Time: ${arrival.toLocaleString()}`);
        console.log(`   Shift Start: ${shiftStart} (${expectedStart.toLocaleString()})`);
        console.log(`   Late By: ${Math.round((arrival - expectedStart) / 60000)} minutes`);

        if (shiftStart === '20:00' && arrival.getHours() < 20) {
          console.log(`   ⚠️  WARNING: Night shift but arrived before 20:00 - should NOT be late!`);
          console.log(`   ❌ POSSIBLE BUG: Late calculation may be using wrong date`);
        }
      }

      // Check if shift mismatch
      if (employee.assignedShift?.startTime !== effectiveShift?.start) {
        console.log(`\n⚠️  SHIFT MISMATCH DETECTED!`);
        console.log(`   User's Current Shift: ${effectiveShift?.start}`);
        console.log(`   Shift Used in Record: ${employee.assignedShift?.startTime}`);
        console.log(`   This could cause incorrect late detection!`);
      }
    }

    console.log('\n\n');
    console.log('='  .repeat(100));
    console.log('✅ Check Complete');
    console.log('='  .repeat(100));

    // Summary
    const lateCount = records.reduce((count, record) => {
      const emp = record.employees.find(e => e.userId.toString() === user._id.toString());
      return count + (emp?.calculated?.isLate ? 1 : 0);
    }, 0);

    const presentCount = records.reduce((count, record) => {
      const emp = record.employees.find(e => e.userId.toString() === user._id.toString());
      return count + (emp?.calculated?.isPresent ? 1 : 0);
    }, 0);

    console.log('\n📊 Summary:');
    console.log(`   Total Records: ${records.length}`);
    console.log(`   Present Days: ${presentCount}`);
    console.log(`   Late Days: ${lateCount}`);
    console.log(`   Late Percentage: ${records.length > 0 ? ((lateCount / presentCount) * 100).toFixed(1) : 0}%`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

// Run the script
checkUserAttendance();
