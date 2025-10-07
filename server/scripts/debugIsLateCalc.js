const mongoose = require('mongoose');
const AttendanceRecord = require('../models/AttendanceRecord');
const User = require('../models/User');
const Shift = require('../models/Shift');
const AttendanceService = require('../services/AttendanceService');
require('dotenv').config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

    const attendanceService = new AttendanceService();
    const user = await User.findOne({ name: /Anish/i });

    const record = await AttendanceRecord.findOne({
      date: { $gte: new Date('2025-10-05'), $lt: new Date('2025-10-06') }
    }).lean();

    const emp = record.employees.find(e => e.userId.toString() === user._id.toString());

    console.log('='.repeat(80));
    console.log('🔍 DEBUGGING calculateIsLate');
    console.log('='.repeat(80));

    console.log('\n📅 Record Date:', record.date);
    console.log('   ISO:', new Date(record.date).toISOString());
    console.log('   Local:', new Date(record.date).toLocaleString());

    console.log('\n🕐 Arrival Time:', emp.calculated.arrivalTime);
    console.log('   ISO:', new Date(emp.calculated.arrivalTime).toISOString());
    console.log('   Local:', new Date(emp.calculated.arrivalTime).toLocaleString());

    console.log('\n👔 Shift:', emp.assignedShift.startTime, '-', emp.assignedShift.endTime);

    console.log('\n📊 From DB:');
    console.log('   isLate:', emp.calculated.isLate);

    console.log('\n\n🧮 MANUAL CALCULATION:');

    // Simulate what calculateIsLate should do
    const arrival = new Date(emp.calculated.arrivalTime);
    const [shiftHour, shiftMin] = emp.assignedShift.startTime.split(':').map(Number);
    const baseDate = new Date(record.date);

    console.log('\n   Arrival:', arrival.toISOString(), '(', arrival.toLocaleString(), ')');
    console.log('   Base date for shift start:', baseDate.toISOString(), '(', baseDate.toLocaleString(), ')');

    const shiftStart = new Date(baseDate);
    shiftStart.setHours(shiftHour, shiftMin, 0, 0);

    console.log('   Shift start:', shiftStart.toISOString(), '(', shiftStart.toLocaleString(), ')');

    const diff = Math.round((arrival - shiftStart) / 60000);
    console.log('   Difference:', diff, 'minutes');
    console.log('   Result: arrival > shiftStart?', arrival > shiftStart);
    console.log('   Should be late?', arrival > shiftStart ? 'YES' : 'NO');

    console.log('\n\n⚠️  THE PROBLEM:');
    console.log('   Record date is Oct 5 18:30 UTC (Oct 6 00:00 IST)');
    console.log('   When we do setHours(20, 0, 0, 0), it sets to Oct 6 20:00 LOCAL');
    console.log('   But we need Oct 5 20:00 LOCAL!');

    console.log('\n\n💡 SOLUTION:');
    console.log('   Need to extract just the DATE PART and use it');

    // Correct way - get the date in local timezone
    const recordDateLocal = new Date(record.date);
    const year = recordDateLocal.getFullYear();
    const month = recordDateLocal.getMonth();
    const day = recordDateLocal.getDate();

    const correctShiftStart = new Date(year, month, day, shiftHour, shiftMin, 0, 0);

    console.log('   Correct shift start:', correctShiftStart.toISOString(), '(', correctShiftStart.toLocaleString(), ')');
    const correctDiff = Math.round((arrival - correctShiftStart) / 60000);
    console.log('   Correct difference:', correctDiff, 'minutes');
    console.log('   Correct result:', arrival > correctShiftStart ? 'LATE' : 'NOT LATE');

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
