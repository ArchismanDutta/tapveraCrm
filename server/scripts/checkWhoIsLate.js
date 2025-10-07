const mongoose = require('mongoose');
const AttendanceRecord = require('../models/AttendanceRecord');
const User = require('../models/User');
require('dotenv').config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

    // Get all recent records
    const records = await AttendanceRecord.find({
      date: { $gte: new Date('2025-10-01') }
    }).sort({ date: -1 }).lean();

    console.log('📊 ALL EMPLOYEES WITH isLate: true\n');

    for (const record of records) {
      const lateEmps = record.employees.filter(e => e.calculated?.isLate);

      if (lateEmps.length > 0) {
        const dateStr = new Date(record.date).toISOString().split('T')[0];
        console.log('='.repeat(80));
        console.log('📅 Date:', dateStr);
        console.log('   Record Date (full):', record.date);

        for (const emp of lateEmps) {
          const user = await User.findById(emp.userId).lean();
          const arrival = new Date(emp.calculated.arrivalTime);
          const [h, m] = emp.assignedShift.startTime.split(':').map(Number);

          // Calculate late minutes the CORRECT way (using date components)
          const recordDate = new Date(record.date);
          const shiftStart = new Date(
            recordDate.getFullYear(),
            recordDate.getMonth(),
            recordDate.getDate(),
            h, m, 0, 0
          );

          const lateMins = Math.round((arrival - shiftStart) / 60000);

          console.log('\n   👤', user?.name || 'Unknown');
          console.log('      Shift:', emp.assignedShift.name, '(', emp.assignedShift.startTime, '-', emp.assignedShift.endTime, ')');
          console.log('      Arrival Time:', arrival.toISOString(), '(', arrival.toLocaleString(), ')');
          console.log('      Record Date:', recordDate.toISOString(), '(', recordDate.toLocaleString(), ')');
          console.log('      Shift Start:', shiftStart.toISOString(), '(', shiftStart.toLocaleString(), ')');
          console.log('      Late Minutes:', lateMins);
          console.log('      Is Late (DB):', emp.calculated.isLate);

          if (lateMins > 600) {
            console.log('      ⚠️  WARNING: Showing 600+ minutes late!');
          }
          if (lateMins < 0) {
            console.log('      ❌ ERROR: Negative late time but marked as late!');
          }
        }
        console.log('');
      }
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
