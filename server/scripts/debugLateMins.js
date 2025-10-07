const mongoose = require('mongoose');
const AttendanceRecord = require('../models/AttendanceRecord');
const User = require('../models/User');
require('dotenv').config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

    const user = await User.findOne({ name: /Anish/i });

    const record = await AttendanceRecord.findOne({
      date: { $gte: new Date('2025-10-05'), $lt: new Date('2025-10-06') },
      'employees.userId': user._id
    }).lean();

    if (!record) {
      console.log('No record found for Oct 5');
      await mongoose.connection.close();
      return;
    }

    const emp = record.employees.find(e => e.userId.toString() === user._id.toString());

    console.log('='.repeat(80));
    console.log('📊 DEBUGGING LATE MINUTES CALCULATION');
    console.log('='.repeat(80));
    console.log('\n📅 Record Details:');
    console.log('   Record Date:', new Date(record.date).toISOString());
    console.log('   Record Date (local):', new Date(record.date).toLocaleString());

    console.log('\n👤 Employee Details:');
    console.log('   Name:', user.name);
    console.log('   Shift:', emp.assignedShift?.startTime, '-', emp.assignedShift?.endTime);
    console.log('   Shift Name:', emp.assignedShift?.name);

    console.log('\n🕐 Calculated Data from DB:');
    console.log('   Arrival Time (ISO):', emp.calculated?.arrivalTime);
    console.log('   Arrival Time (local):', new Date(emp.calculated?.arrivalTime).toLocaleString());
    console.log('   Is Late (from DB):', emp.calculated?.isLate);

    console.log('\n🧮 FRONTEND CALCULATION SIMULATION:');

    // OLD WAY (WRONG)
    console.log('\n❌ OLD WAY (using arrival date):');
    const arrivalDate = new Date(emp.calculated.arrivalTime);
    const [h1, m1] = emp.assignedShift.startTime.split(':').map(Number);
    const expectedDateOld = new Date(arrivalDate);
    expectedDateOld.setHours(h1, m1, 0, 0);
    const lateMinutesOld = Math.round((arrivalDate - expectedDateOld) / 60000);
    console.log('   Arrival:', arrivalDate.toISOString(), '(', arrivalDate.toLocaleString(), ')');
    console.log('   Expected Start:', expectedDateOld.toISOString(), '(', expectedDateOld.toLocaleString(), ')');
    console.log('   Late Minutes:', lateMinutesOld);
    console.log('   Is Late?', lateMinutesOld > 0 ? 'YES' : 'NO');

    // NEW WAY (CORRECT)
    console.log('\n✅ NEW WAY (using record date):');
    const [h2, m2] = emp.assignedShift.startTime.split(':').map(Number);
    const expectedDateNew = new Date(record.date);
    expectedDateNew.setHours(h2, m2, 0, 0);
    const lateMinutesNew = Math.round((arrivalDate - expectedDateNew) / 60000);
    console.log('   Arrival:', arrivalDate.toISOString(), '(', arrivalDate.toLocaleString(), ')');
    console.log('   Expected Start:', expectedDateNew.toISOString(), '(', expectedDateNew.toLocaleString(), ')');
    console.log('   Late Minutes:', lateMinutesNew);
    console.log('   Is Late?', lateMinutesNew > 0 ? 'YES' : 'NO');

    console.log('\n📊 COMPARISON:');
    console.log('   Old calculation:', lateMinutesOld, 'minutes', lateMinutesOld > 0 ? '(LATE)' : '(NOT LATE)');
    console.log('   New calculation:', lateMinutesNew, 'minutes', lateMinutesNew > 0 ? '(LATE)' : '(NOT LATE)');
    console.log('   Difference:', Math.abs(lateMinutesOld - lateMinutesNew), 'minutes');

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
