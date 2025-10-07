const mongoose = require('mongoose');
const AttendanceRecord = require('../models/AttendanceRecord');
const User = require('../models/User');
require('dotenv').config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

    const user = await User.findOne({ name: /Anish/i });

    // Find the most recent record
    const records = await AttendanceRecord.find({
      'employees.userId': user._id,
      date: { $gte: new Date('2025-10-01') }
    }).sort({ date: -1 }).lean();

    console.log('📊 Anish Jaiswal - Recent Records (Oct 2025):\n');
    console.log('Found', records.length, 'records\n');

    for (const record of records) {
      const emp = record.employees.find(e => e.userId.toString() === user._id.toString());
      if (!emp) continue;

      console.log('='.repeat(80));
      console.log('📅 Record Date:', new Date(record.date).toISOString().split('T')[0]);
      console.log('👤 Shift:', emp.assignedShift?.name || 'N/A', '(', emp.assignedShift?.startTime, '-', emp.assignedShift?.endTime, ')');
      console.log('🕐 Arrival:', emp.calculated?.arrivalTime ? new Date(emp.calculated.arrivalTime).toLocaleString() : 'N/A');
      console.log('⚠️  Is Late (from DB):', emp.calculated?.isLate ? 'YES' : 'NO');

      // Manual calculation to see what frontend might be doing
      if (emp.calculated?.arrivalTime && emp.assignedShift?.startTime) {
        const arrival = new Date(emp.calculated.arrivalTime);
        const [h, m] = emp.assignedShift.startTime.split(':').map(Number);

        // WRONG WAY (what frontend might be doing - using arrival date)
        const shiftStartWrong = new Date(arrival);
        shiftStartWrong.setHours(h, m, 0, 0);
        const diffWrong = Math.round((arrival - shiftStartWrong) / 60000);

        // RIGHT WAY (using record date)
        const shiftStartRight = new Date(record.date);
        shiftStartRight.setHours(h, m, 0, 0);
        const diffRight = Math.round((arrival - shiftStartRight) / 60000);

        console.log('\n🧮 Late Calculation:');
        console.log('   Using arrival date:', diffWrong, 'minutes', diffWrong > 0 ? '(LATE)' : '(NOT LATE)');
        console.log('   Using record date:', diffRight, 'minutes', diffRight > 0 ? '(LATE)' : '(NOT LATE)');
        console.log('   ⚡ Correct method should use RECORD DATE');
      }

      console.log('\n📝 Events:', emp.events?.length || 0);
      if (emp.events && emp.events.length > 0) {
        emp.events.forEach((e, idx) => {
          console.log('   ', idx+1, e.type, '-', new Date(e.timestamp).toLocaleString(), e.manual ? '(MANUAL)' : '(AUTO)');
        });
      }
      console.log('');
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
