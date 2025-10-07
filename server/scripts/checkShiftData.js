const mongoose = require('mongoose');
const AttendanceRecord = require('../models/AttendanceRecord');
require('dotenv').config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

    const record = await AttendanceRecord.findOne({
      date: { $gte: new Date('2025-10-05'), $lt: new Date('2025-10-06') }
    }).lean();

    const nightShiftEmp = record.employees.find(e =>
      e.assignedShift.startTime === '20:00' &&
      e.calculated.arrivalTime &&
      new Date(e.calculated.arrivalTime).getHours() === 20
    );

    if (nightShiftEmp) {
      console.log('Night shift employee data structure:');
      console.log(JSON.stringify({
        assignedShift: nightShiftEmp.assignedShift,
        effectiveShift: nightShiftEmp.effectiveShift,
        expectedStartTime: nightShiftEmp.expectedStartTime
      }, null, 2));
    } else {
      console.log('No night shift employee found who punched in at 8:48 PM');
      console.log('\nAll night shift employees:');
      record.employees.filter(e => e.assignedShift.startTime === '20:00').forEach(e => {
        console.log({
          arrivalTime: e.calculated.arrivalTime,
          assignedShift: e.assignedShift
        });
      });
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
