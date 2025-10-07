// Check ACTUAL attendance records in database
const mongoose = require('mongoose');
const AttendanceRecord = require('../models/AttendanceRecord');
const User = require('../models/User');
const Shift = require('../models/Shift');
require('dotenv').config();

async function checkActualAttendance() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get recent attendance records (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const records = await AttendanceRecord.find({
      date: { $gte: sevenDaysAgo }
    }).sort({ date: -1 }).lean();

    console.log('='  .repeat(100));
    console.log(`📅 ATTENDANCE RECORDS (Last 7 days): ${records.length} found`);
    console.log('='  .repeat(100));

    if (records.length === 0) {
      console.log('\n❌ No attendance records found in last 7 days');
      return;
    }

    for (const record of records) {
      const dateStr = new Date(record.date).toISOString().split('T')[0];

      console.log(`\n\n${'='.repeat(100)}`);
      console.log(`📅 DATE: ${dateStr}`);
      console.log(`${'='.repeat(100)}`);
      console.log(`   Total employees: ${record.employees.length}`);

      for (const emp of record.employees) {
        const user = await User.findById(emp.userId).lean();
        const userName = user?.name || 'Unknown User';

        console.log(`\n   👤 ${userName}`);
        console.log(`      User ID: ${emp.userId}`);
        console.log(`      Assigned Shift: ${emp.assignedShift?.startTime || 'N/A'} - ${emp.assignedShift?.endTime || 'N/A'}`);
        console.log(`      Shift Name: ${emp.assignedShift?.name || 'N/A'}`);
        console.log(`      Arrival: ${emp.calculated?.arrivalTime ? new Date(emp.calculated.arrivalTime).toLocaleString() : 'N/A'}`);
        console.log(`      Departure: ${emp.calculated?.departureTime ? new Date(emp.calculated.departureTime).toLocaleString() : 'N/A'}`);
        console.log(`      Is Late: ${emp.calculated?.isLate ? '⚠️  YES' : '✅ NO'}`);

        if (emp.calculated?.isLate) {
          // Calculate actual late time
          const arrival = new Date(emp.calculated.arrivalTime);
          const [shiftHour, shiftMin] = (emp.assignedShift?.startTime || '09:00').split(':').map(Number);
          const shiftStart = new Date(arrival);
          shiftStart.setHours(shiftHour, shiftMin, 0, 0);
          const minutesLate = Math.round((arrival - shiftStart) / 60000);

          console.log(`      ❌ LATE BY: ${minutesLate} minutes`);

          // Check if this is a night shift issue
          const isNightShift = emp.assignedShift?.endTime < emp.assignedShift?.startTime;
          if (isNightShift) {
            console.log(`      🌙 NIGHT SHIFT DETECTED!`);
            console.log(`      ⚠️  This might be using WRONG DATE for shift start calculation`);
            console.log(`      Arrival: ${arrival.toLocaleString()}`);
            console.log(`      Shift start calculated as: ${shiftStart.toLocaleString()}`);
            console.log(`      Expected shift start: ${dateStr} at ${emp.assignedShift.startTime}`);
          }
        }

        console.log(`      Work Duration: ${emp.calculated?.workDuration || 'N/A'}`);
        console.log(`      Events: ${emp.events?.length || 0}`);

        if (emp.events && emp.events.length > 0) {
          console.log(`      Event Timeline:`);
          emp.events.forEach((event, idx) => {
            console.log(`         ${idx + 1}. ${event.type} - ${new Date(event.timestamp).toLocaleString()}`);
          });
        }
      }
    }

    console.log('\n\n' + '='.repeat(100));
    console.log('✅ Check Complete');
    console.log('='.repeat(100));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

checkActualAttendance();
